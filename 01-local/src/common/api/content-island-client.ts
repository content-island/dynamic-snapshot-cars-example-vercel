import { createClient } from '@content-island/api-client'

import { loadSnapshotJson } from '#/server/snapshot-store'

const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN ?? ''

export const contentIslandClient = createClient({
  accessToken,
  mode: 'snapshot',
  // Loader-only on purpose. Passing `snapshotPath` as well would make the
  // client read that file on first load and ignore the loader entirely, so
  // Redis would never be consulted.
  snapshotLoader: loadSnapshotJson,
})
