import { createFileRoute } from '@tanstack/react-router'

import { contentIslandClient } from '#/common/api/content-island-client'
import { getSnapshotKey, getStoredSnapshotVersion } from '#/server/snapshot-store'

/**
 * Diagnostics. `local` is the snapshot this instance is serving from memory;
 * `remote` is what Redis currently publishes. They differ for at most one
 * check interval after a refresh — that gap is the consistency window.
 */
export const Route = createFileRoute('/api/content-island/snapshot-info')({
  server: {
    handlers: {
      GET: async () => {
        const [local, remoteVersion] = await Promise.all([
          contentIslandClient.getSnapshotInfo(),
          getStoredSnapshotVersion(),
        ])

        return Response.json({
          redisKey: getSnapshotKey(),
          local,
          remoteVersion,
          inSync: local.exportedAt === remoteVersion,
        })
      },
    },
  },
})
