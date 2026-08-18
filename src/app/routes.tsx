import {
  Outlet,
  createRootRoute,
  createRoute,
  redirect,
} from "@tanstack/react-router"
import {
  BoxesIcon,
  DownloadIcon,
  FileCode2Icon,
  KeyRoundIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  UploadIcon,
} from "lucide-react"

import { PlannedPage } from "@/components/common/planned-page"
import { AppShell } from "@/components/layout/app-shell"
import { LoginPage } from "@/features/auth/login-page"
import { MembersPage } from "@/features/project-members/members-page"
import { RolesPage } from "@/features/roles/roles-page"
import { TranslationsPage } from "@/features/translations/translations-page"
import { useSessionStore } from "@/stores/session.store"

/**
 * The route tree.
 *
 * Authentication is enforced in `beforeLoad` rather than inside a component: a redirect
 * during navigation never renders the protected screen at all, whereas a component-level
 * check flashes it first.
 */

/**
 * A redirect to a path defined later in this tree.
 *
 * `redirect({ to })` is typed against the tree as it exists at that line, so a route
 * declared below is not yet a legal target. `href` is the supported string form: a
 * relative value stays a client-side navigation (only an absolute URL triggers a full
 * document load), and the router still resolves it through the tree at runtime.
 *
 * Redirects that point *backwards* — to `/login` from a guard below it — keep the typed
 * `to` form and remain checked.
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
  component: LoginPage,
  beforeLoad: () => {
    if (useSessionStore.getState().accessToken) {
      redirectForward("/translations")
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
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      })
    }
  },
})

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  beforeLoad: () => redirectForward("/translations"),
})

const page = (path: string, component: () => React.JSX.Element) =>
  createRoute({ getParentRoute: () => appRoute, path, component })

export const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    indexRoute,
    page("/dashboard", () => (
      <PlannedPage
        icon={LayoutDashboardIcon}
        title="Dashboard"
        description="Project health at a glance."
        summary="Coverage per language and application, keys awaiting review or publish, recent activity, and the jobs currently running."
      />
    )),
    page("/translations", TranslationsPage),
    page("/applications", () => (
      <PlannedPage
        icon={BoxesIcon}
        title="Applications"
        description="Each app owns its keys, languages and export format."
        summary="A card grid of the project's applications with type, language coverage and key counts, plus create and edit forms."
      />
    )),
    page("/languages", () => (
      <PlannedPage
        icon={LanguagesIcon}
        title="Languages"
        description="Languages are global; each project enables a subset."
        summary="The global language catalogue with native names and RTL flags, and per-project enablement."
      />
    )),
    page("/members", MembersPage),
    page("/roles", RolesPage),
    page("/api-tokens", () => (
      <PlannedPage
        icon={KeyRoundIcon}
        title="API Tokens"
        description="Read-only tokens for the consumption API."
        summary="Token list with prefix, scope and last use, plus a create flow that shows the plaintext token exactly once."
      />
    )),
    page("/templates", () => (
      <PlannedPage
        icon={FileCode2Icon}
        title="Templates"
        description="How translations are read from and written to files."
        summary="Template list by file type, with the import and export config editors and a live preview of the generated file."
      />
    )),
    page("/import", () => (
      <PlannedPage
        icon={UploadIcon}
        title="Import"
        description="Bring translations in from a file."
        summary="Upload wizard: pick application, language and template, preview the diff, then apply. Job history with per-row errors."
      />
    )),
    page("/export", () => (
      <PlannedPage
        icon={DownloadIcon}
        title="Export"
        description="Generate translation bundles."
        summary="Pick application, languages and template, then track the job to a download link."
      />
    )),
    page("/audit", () => (
      <PlannedPage
        icon={ScrollTextIcon}
        title="Audit Log"
        description="Who changed what, and when."
        summary="Infinite-scrolling activity feed with filters by actor, entity type and date range."
      />
    )),
    page("/settings", () => (
      <PlannedPage
        icon={SettingsIcon}
        title="Settings"
        description="Project configuration."
        summary="Project metadata, default and supported languages, and the machine-translation / API-access toggles."
      />
    )),
  ]),
])
