import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Show a route's `pendingComponent` as soon as its loader takes longer than
    // 150ms, and keep it on screen for at least 400ms so it never flashes.
    defaultPendingMs: 150,
    defaultPendingMinMs: 400,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
