import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

import { ensureFreshSnapshot } from '#/server/snapshot-manager'

const REFRESH_ENDPOINT = '/api/snapshot/refresh'

const snapshotMiddleware = createMiddleware().server(
  async ({ pathname, next }) => {
    // The refresh endpoint is the one thing that must work while Redis is still
    // empty; it is what fills it. Gating it behind the snapshot would deadlock.
    if (pathname === REFRESH_ENDPOINT) {
      return next()
    }

    try {
      await ensureFreshSnapshot()
    } catch (error) {
      console.error('[snapshot] unavailable', error)

      return new Response('Content is temporarily unavailable', {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'retry-after': '30',
        },
      })
    }

    return next()
  },
)

// TanStack Start installs a default CSRF middleware ONLY while no start entry
// exports a `startInstance`. The moment this file exists that default is
// dropped, so we have to re-add it by hand or server functions lose the check.
const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, snapshotMiddleware],
}))
