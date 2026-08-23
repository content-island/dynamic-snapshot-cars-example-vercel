import { promisify } from 'node:util'
import { gzip, gunzip } from 'node:zlib'

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

export async function loadSnapshotJson(): Promise<string> {
  await ensureRedisReady()

  const [encodingBuffer, snapshotBuffer] = await getBufferClient().hmGet(
    getSnapshotKey(),
    ['encoding', 'snapshot'],
  )

  if (!snapshotBuffer) {
    throw new Error('There is no snapshot stored in Redis')
  }

  const encoding = encodingBuffer?.toString('utf8')

  if (encoding !== 'gzip') {
    throw new Error(`Unsupported snapshot encoding: ${encoding}`)
  }

  const jsonBuffer = await gunzipAsync(snapshotBuffer)

  return jsonBuffer.toString('utf8')
}
