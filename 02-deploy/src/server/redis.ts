import { attachDatabasePool } from '@vercel/functions'
import { RESP_TYPES, createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

/**
 * Managed Redis providers inject the connection string under their own name.
 * Redis Cloud on Vercel sets `REDIS_URL`; the others are accepted so a change of
 * provider is configuration rather than a code edit.
 */
const REDIS_URL_ENV_VARS = ['REDIS_URL', 'REDIS_TLS_URL', 'KV_URL'] as const

let client: RedisClient | undefined
let bufferClient: ReturnType<RedisClient['withTypeMapping']> | undefined
let connectionPromise: Promise<unknown> | undefined

function readRedisUrl(): { url: string; source: string } {
  for (const name of REDIS_URL_ENV_VARS) {
    const url = process.env[name]

    if (url) {
      return { url, source: name }
    }
  }

  throw new Error(
    `No Redis connection string found. Set one of: ${REDIS_URL_ENV_VARS.join(', ')}`,
  )
}

// The client is created on first use, not at module load: a missing connection
// string must fail the request that needs Redis, not the bundle evaluation.
function getClient(): RedisClient {
  if (!client) {
    const { url, source } = readRedisUrl()

    client = createClient({ url })

    // node-redis emits 'error' on every reconnect attempt. Without a listener
    // Node treats it as an unhandled 'error' event and kills the process.
    client.on('error', (error) => {
      console.error('[redis] connection error', error)
    })

    // Keeps the Vercel instance alive long enough to release idle connections
    // before it is suspended. A suspended instance never fires its own timers,
    // so its socket would linger until the server times it out — and Redis
    // Cloud's free tier only allows 30 of them. No-op outside Vercel.
    attachDatabasePool(client)

    // Never log the URL itself: it carries the password.
    console.log(`[redis] using ${source} (tls: ${url.startsWith('rediss://')})`)
  }

  return client
}

/**
 * Same connection, but Blob Strings come back as Buffer instead of string.
 * That is what lets us store the gzipped snapshot as raw bytes, with no Base64
 * round-trip and no UTF-8 corruption.
 */
export function getBufferClient() {
  if (!bufferClient) {
    bufferClient = getClient().withTypeMapping({
      [RESP_TYPES.BLOB_STRING]: Buffer,
    })
  }

  return bufferClient
}

export function getRedis(): RedisClient {
  return getClient()
}

export async function ensureRedisReady(): Promise<void> {
  const redis = getClient()

  if (redis.isReady) {
    return
  }

  // isOpen true + isReady false means node-redis is already reconnecting on its
  // own; it queues our commands, so there is nothing to do here. Only when the
  // socket is fully closed do we drop the stale promise and dial again.
  if (!redis.isOpen) {
    connectionPromise = undefined
  }

  connectionPromise ??= redis.connect().catch((error) => {
    connectionPromise = undefined
    throw error
  })

  await connectionPromise
}
