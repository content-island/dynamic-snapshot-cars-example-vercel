import { createFileRoute } from '@tanstack/react-router'

import { contentIslandClient } from '#/common/api/content-island-client'

export const Route = createFileRoute('/api/content-island/snapshot-info')({
  server: {
    handlers: {
      GET: async () => {
        const info = await contentIslandClient.getSnapshotInfo()
        return Response.json(info) // { schemaVersion, exportedAt, projectId, view }
      },
    },
  },
})