import {
  Outlet,
  createRootRoute,
  createRoute,
  redirect,
} from "@tanstack/react-router"

import { AppShell } from "@/components/layout/app-shell"
import { useSessionStore } from "@/stores/session.store"
import { lazyPage } from "./lazy-page"

/**
 * The route tree.
 *
 * Authentication is enforced in `beforeLoad` rather than inside a component: a redirect
 * during navigation never renders the protected screen at all, whereas a component-level
 * check flashes it first.
 *
 * Pages are code-split via `lazyPage`, so the initial bundle carries only the shell.
 * That does *not* fix the router's type cycle: `AppShell` is still imported statically and
 * renders `Link`, so the registered router type is computed from a half-built tree and
 * path literals collapse. See `components/common/app-link.tsx` for how links live with
 * that, and `redirectForward` below for redirects.
 */

/**
 * A redirect to a path defined later in this tree.
 *
 * Within this module `redirect({ to })` is still typed against the tree as it exists at
 * that line, so a route declared below is not yet a legal target. `href` is the supported
 * string form: a relative value stays a client-side navigation (only an absolute URL
 * triggers a full document load), and the router resolves it through the tree at runtime.
 *
 * Redirects that point *backwards* — to `/login` from a guard below it — keep the typed
 * `to` form and stay checked.
 */
const redirectForward = (href: string): never => {
  throw redirect({ href })
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazyPage(
    () => import("@/features/auth/login-page"),
    (module) => module.LoginPage
  ),
  beforeLoad: () => {
    if (useSessionStore.getState().accessToken) {
      redirectForward("/dashboard")
    }
  },
})

/** Pathless layout route: everything under it requires a session and renders in the shell. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
  beforeLoad: ({ location }) => {
    if (!useSessionStore.getState().accessToken) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
  },
})

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  beforeLoad: () => redirectForward("/dashboard"),
})

const page = (path: string, component: () => React.JSX.Element) =>
  createRoute({ getParentRoute: () => appRoute, path, component })

export const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    indexRoute,
    page(
      "/dashboard",
      lazyPage(
        () => import("@/features/dashboard/dashboard-page"),
        (module) => module.DashboardPage
      )
    ),
    page(
      "/translations",
      lazyPage(
        () => import("@/features/translations/translations-page"),
        (module) => module.TranslationsPage
      )
    ),
    page(
      "/applications",
      lazyPage(
        () => import("@/features/applications/applications-page"),
        (module) => module.ApplicationsPage
      )
    ),
    page(
      "/languages",
      lazyPage(
        () => import("@/features/languages/languages-page"),
        (module) => module.LanguagesPage
      )
    ),
    page(
      "/members",
      lazyPage(
        () => import("@/features/project-members/members-page"),
        (module) => module.MembersPage
      )
    ),
    page(
      "/roles",
      lazyPage(
        () => import("@/features/roles/roles-page"),
        (module) => module.RolesPage
      )
    ),
    page(
      "/api-tokens",
      lazyPage(
        () => import("@/features/api-tokens/api-tokens-page"),
        (module) => module.ApiTokensPage
      )
    ),
    page(
      "/templates",
      lazyPage(
        () => import("@/features/templates/templates-page"),
        (module) => module.TemplatesPage
      )
    ),
    page(
      "/import",
      lazyPage(
        () => import("@/features/import-jobs/import-page"),
        (module) => module.ImportPage
      )
    ),
    page(
      "/export",
      lazyPage(
        () => import("@/features/export-jobs/export-page"),
        (module) => module.ExportPage
      )
    ),
    page(
      "/audit",
      lazyPage(
        () => import("@/features/activity-logs/audit-page"),
        (module) => module.AuditPage
      )
    ),
    page(
      "/settings",
      lazyPage(
        () => import("@/features/settings/settings-page"),
        (module) => module.SettingsPage
      )
    ),
  ]),
])
