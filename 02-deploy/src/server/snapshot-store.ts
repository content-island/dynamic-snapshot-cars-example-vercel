import { promisify } from 'node:util'
import { gzip, gunzip } from 'node:zlib'

import { exportSnapshot } from '@content-island/api-client'

import { ensureRedisReady, getBufferClient, getRedis } from './redis'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * One Redis hash holds the whole published state. Namespacing by project id is
 * what keeps a Preview deployment pointing at a different Content Island
 * project from overwriting Production's snapshot when both share one Redis.
 * With a single project the default key is enough.
 */
export function getSnapshotKey(): string {
  const projectId = process.env.CONTENT_ISLAND_PROJECT_ID

  return projectId
    ? `content-island:${projectId}:snapshot`
    : 'content-island:snapshot'
}

export interface StoredSnapshotMetadata {
  version: string
  encoding: 'gzip'
  compressedSize: number
  uncompressedSize: number
  updatedAt: string
}

export async function saveSnapshot(
  snapshot: unknown,
  version: string,
): Promise<StoredSnapshotMetadata> {
  await ensureRedisReady()

  const json = JSON.stringify(snapshot)
  const uncompressedSize = Buffer.byteLength(json)

  // Level 4 is the sweet spot here: near-level-9 ratio on JSON at a fraction of
  // the CPU. This runs once per publication, so it is never on the read path.
  const compressedSnapshot = await gzipAsync(Buffer.from(json), { level: 4 })

  const metadata: StoredSnapshotMetadata = {
    version,
    encoding: 'gzip',
    compressedSize: compressedSnapshot.byteLength,
    uncompressedSize,
    updatedAt: new Date().toISOString(),
  }

  // A single HSET writes every field atomically, so a reader can never observe
  // the new version number alongside the previous snapshot bytes.
  await getRedis().hSet(getSnapshotKey(), {
    version: metadata.version,
    encoding: metadata.encoding,
    snapshot: compressedSnapshot,
    compressedSize: metadata.compressedSize.toString(),
    uncompressedSize: metadata.uncompressedSize.toString(),
    updatedAt: metadata.updatedAt,
  })

  return metadata
}

/**
 * The cheap poll. Reads one short string, not the megabytes next to it.
 */
export async function getStoredSnapshotVersion(): Promise<string | null> {
  await ensureRedisReady()

  return getRedis().hGet(getSnapshotKey(), 'version')
}

/**
 * Rebuilds the published state straight from Content Island and repopulates
 * Redis. This is the recovery path for an empty key — a first boot, or a Redis
 * plan without persistence that restarted. Without it the whole site would
 * answer 503 until somebody called the refresh endpoint by hand.
 *
 * No distributed lock: if several instances start at once against an empty
 * Redis, each exports its own copy. exportSnapshot() is idempotent and the HSET
 * is atomic, so the result is correct — just wasteful.
 */
async function bootstrapSnapshotJson(): Promise<string> {
  const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error(
      'Redis holds no snapshot and CONTENT_ISLAND_ACCESS_TOKEN is not configured',
    )
  }

  console.warn('[snapshot] Redis is empty, rebuilding from Content Island')

  const snapshot = await exportSnapshot({ accessToken })
  const metadata = await saveSnapshot(snapshot, snapshot.meta.exportedAt)

  console.log(`[snapshot] Redis repopulated with version ${metadata.version}`)

  return JSON.stringify(snapshot)
}

export async function loadSnapshotJson(): Promise<string> {
  await ensureRedisReady()

  const [encodingBuffer, snapshotBuffer] = await getBufferClient().hmGet(
    getSnapshotKey(),
    ['encoding', 'snapshot'],
  )

  if (!snapshotBuffer) {
    return bootstrapSnapshotJson()
  }

  const encoding = encodingBuffer?.toString('utf8')

  if (encoding !== 'gzip') {
    throw new Error(`Unsupported snapshot encoding: ${encoding}`)
  }

  const jsonBuffer = await gunzipAsync(snapshotBuffer)

  return jsonBuffer.toString('utf8')
}
