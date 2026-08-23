import { RESP_TYPES, createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

let client: RedisClient | undefined
let bufferClient: ReturnType<RedisClient['withTypeMapping']> | undefined
let connectionPromise: Promise<unknown> | undefined

function readRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured')
  }

  return redisUrl
}

// The client is created on first use, not at module load: a missing REDIS_URL
// must fail the request that needs Redis, not the bundle evaluation.
function getClient(): RedisClient {
  if (!client) {
    client = createClient({ url: readRedisUrl() })

    // node-redis emits 'error' on every reconnect attempt. Without a listener
    // Node treats it as an unhandled 'error' event and kills the process.
    client.on('error', (error) => {
      console.error('[redis] connection error', error)
    })
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
