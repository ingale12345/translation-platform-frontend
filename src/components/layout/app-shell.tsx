import { Outlet, useNavigate } from "@tanstack/react-router"
import { ShieldAlertIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useActiveProjectId,
  useIsAuthenticated,
  useMemberships,
  usePermissions,
  useSwitchProject,
} from "@/features/session/hooks"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

const COLLAPSE_KEY = "lmp.sidebar-collapsed"

/**
 * The authenticated frame: sidebar, topbar, page.
 *
 * It also owns tenant bootstrap. Everything below depends on an active project — the
 * sidebar is permission-filtered, and permissions are per project — so the shell picks a
 * project before rendering any page, rather than each page handling "no project yet".
 *
 * And it owns the *exit*. The route guard runs in `beforeLoad`, which only fires on
 * navigation, so signing out while a page is mounted left the user sitting on it with no
 * token: every query failed and the shell fell through to "No project access", which reads
 * as a permissions problem rather than as being signed out. Watching the session here
 * catches both ways it can end — the sign-out button, and a 401 revoking it underneath.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "true"
  )

  const isAuthenticated = useIsAuthenticated()
  const navigate = useNavigate()
  const activeProjectId = useActiveProjectId()
  const { data: memberships, isLoading: membershipsLoading } = useMemberships()
  const switchProject = useSwitchProject()
  const { isLoading: permissionsLoading, isMember } = usePermissions()

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed))
  }, [collapsed])

  // `replace` so the browser Back button does not return to a page this session can no
  // longer load. No `redirect` search param either: signing out is not an interruption to
  // resume, unlike the guard's redirect when an unauthenticated user asks for a page.
  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({ to: "/login", replace: true })
    }
  }, [isAuthenticated, navigate])

  /**
   * Is the stored project still one of ours?
   *
   * `activeProjectId` is persisted, so it outlives the project it names — a project that
   * was deleted, access that was revoked, or a database that was reseeded underneath a
   * tab left open. The id then rides along on every request as `X-Project-Id` and every
   * screen fails at once.
   */
  const isStale =
    Boolean(memberships?.length) &&
    !memberships?.some((membership) => membership.projectId === activeProjectId)

  // Land in a project on first sign-in, and recover if the stored one is no longer ours.
  useEffect(() => {
    if (memberships?.length && isStale) {
      switchProject(memberships[0])
    }
  }, [memberships, isStale, switchProject])

  // Nothing below is meaningful without a session, and rendering it for one frame is what
  // produced the "No project access" flash on the way out.
  if (!isAuthenticated) {
    return null
  }

  // Hold the shell closed until the active project is known-good. The effect above fixes
  // it within a frame, but rendering the page first means every child fires its queries
  // with the stale id — a burst of 404s, and an error state the user sees before the
  // correction lands. Waiting is invisible; failing is not.
  if (membershipsLoading || isStale) {
    return <ShellSkeleton />
  }

  if (!memberships?.length) {
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <EmptyState
          icon={ShieldAlertIcon}
          title="No project access"
          body="Your account is not a member of any project yet. Ask a project admin to invite you."
        />
      </div>
    )
  }

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto">
          {permissionsLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : isMember ? (
            <Outlet />
          ) : (
            <div className="p-5">
              <EmptyState
                icon={ShieldAlertIcon}
                title="No access to this project"
                body="Your membership here is not active. Switch to another project, or ask an admin to restore your access."
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ShellSkeleton() {
  return (
    <div className="flex h-svh">
      <div className="w-60 shrink-0 border-r p-3">
        <Skeleton className="mb-4 h-8 w-full" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="mb-1.5 h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 p-5">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
