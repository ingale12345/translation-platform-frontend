import { createRouter } from "@tanstack/react-router"

import { routeTree } from "./routes"

/**
 * The router instance, and the type registration that makes `Link` and `redirect`
 * path-aware across the app.
 */
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
