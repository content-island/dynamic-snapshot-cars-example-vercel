import { contentIslandClient } from '#/common/api/content-island-client'

import { getStoredSnapshotVersion } from './snapshot-store'

const DEFAULT_CHECK_INTERVAL_MS = 300_000
const ERROR_RETRY_INTERVAL_MS = 30_000

// Upper bounds on how long a request may wait on Redis. Without them an
// unreachable Redis makes every request hang until node-redis gives up, which
// on a serverless platform is billed function time and a stalled page.
const VERSION_CHECK_TIMEOUT_MS = 1_000
const INITIAL_LOAD_TIMEOUT_MS = 10_000

const configuredInterval = Number(process.env.SNAPSHOT_CHECK_INTERVAL_MS)

const CHECK_INTERVAL_MS =
  Number.isFinite(configuredInterval) && configuredInterval > 0
    ? configuredInterval
    : DEFAULT_CHECK_INTERVAL_MS

// Module scope, so this state belongs to ONE serverless instance. Every
// instance tracks its own copy and its own next check independently.
let localVersion: string | undefined
let nextCheckAt = 0

let initializationPromise: Promise<void> | undefined
let checkPromise: Promise<void> | undefined

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })

  return Promise.race([operation, timeout]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>
}

async function adoptSnapshot(
  reason: string,
  timeoutMs: number,
): Promise<void> {
  const result = await withTimeout(
    contentIslandClient.refreshSnapshot(),
    timeoutMs,
    'snapshot refresh',
  )

  // `version` in Redis is the snapshot's own `meta.exportedAt`, so the value we
  // get back here is exactly what we will compare against on the next poll.
  localVersion = result.meta.exportedAt
  nextCheckAt = Date.now() + CHECK_INTERVAL_MS

  console.log(
    `[snapshot] ${reason}: ${result.status} (version ${result.meta.exportedAt})`,
  )
}

async function checkCurrentVersion(): Promise<void> {
  const remoteVersion = await withTimeout(
    getStoredSnapshotVersion(),
    VERSION_CHECK_TIMEOUT_MS,
    'Redis version check',
  )

  if (!remoteVersion) {
    throw new Error('There is no snapshot version in Redis')
  }

  if (remoteVersion === localVersion) {
    nextCheckAt = Date.now() + CHECK_INTERVAL_MS
    return
  }

  // refreshSnapshot() runs the loader again, validates the JSON, rejects a
  // snapshot from another project or view, and only swaps it in when it is
  // strictly newer than the active one.
  await adoptSnapshot('new version detected', INITIAL_LOAD_TIMEOUT_MS)
}

export async function ensureFreshSnapshot(): Promise<void> {
  if (localVersion === undefined) {
    // The first request on a cold instance must wait for the whole download.
    // Concurrent requests share this single promise instead of each pulling
    // their own copy out of Redis.
    initializationPromise ??= adoptSnapshot(
      'initial load',
      INITIAL_LOAD_TIMEOUT_MS,
    ).catch((error) => {
      initializationPromise = undefined
      throw error
    })

    await initializationPromise
    return
  }

  if (Date.now() < nextCheckAt) {
    return
  }

  checkPromise ??= checkCurrentVersion()
    .catch((error) => {
      nextCheckAt = Date.now() + ERROR_RETRY_INTERVAL_MS
      // We already hold a valid snapshot in memory. A transient Redis failure
      // must not take the site down; keep serving and retry sooner.
      console.error(
        '[snapshot] could not check Redis; keeping the in-memory snapshot',
        error,
      )
    })
    .finally(() => {
      checkPromise = undefined
    })

  await checkPromise
}
