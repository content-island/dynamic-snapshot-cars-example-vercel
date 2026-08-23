import { createHash, timingSafeEqual } from 'node:crypto'

import { exportSnapshot } from '@content-island/api-client'
import { createFileRoute } from '@tanstack/react-router'

import { saveSnapshot } from '#/server/snapshot-store'

/**
 * Hashing both sides first gives timingSafeEqual two equal-length buffers, so
 * the comparison leaks neither the secret's content nor its length.
 */
function isValidSecret(received: string | null): boolean {
  const expected = process.env.SNAPSHOT_REFRESH_SECRET

  if (!expected || !received) {
    return false
  }

  const expectedHash = createHash('sha256').update(expected).digest()
  const receivedHash = createHash('sha256').update(received).digest()

  return timingSafeEqual(expectedHash, receivedHash)
}

export const Route = createFileRoute('/api/snapshot/refresh')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isValidSecret(request.headers.get('x-refresh-secret'))) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN

        if (!accessToken) {
          return Response.json(
            { error: 'CONTENT_ISLAND_ACCESS_TOKEN is not configured' },
            { status: 500 },
          )
        }

        try {
          // exportSnapshot() hits Content Island, validates the shape and the
          // schema version, and resolves with the parsed snapshot. If it throws
          // we never touch Redis, so the previous version stays published.
          const snapshot = await exportSnapshot({ accessToken })

          const metadata = await saveSnapshot(
            snapshot,
            snapshot.meta.exportedAt,
          )

          console.log(
            `[snapshot] stored version ${metadata.version} ` +
              `(${metadata.compressedSize} B gzip / ${metadata.uncompressedSize} B raw)`,
          )

          return Response.json({ status: 'updated', ...metadata })
        } catch (error) {
          console.error('[snapshot] refresh failed', error)

          return Response.json(
            { error: 'Snapshot refresh failed' },
            { status: 500 },
          )
        }
      },
    },
  },
})
