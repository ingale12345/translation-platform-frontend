import { Outlet } from "@tanstack/react-router"
import { ShieldAlertIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useActiveProjectId,
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
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "true"
  )

  const activeProjectId = useActiveProjectId()
  const { data: memberships, isLoading: membershipsLoading } = useMemberships()
  const switchProject = useSwitchProject()
  const { isLoading: permissionsLoading, isMember } = usePermissions()

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed))
  }, [collapsed])

  // Land in a project on first sign-in, and recover if the stored one is no longer ours.
  useEffect(() => {
    if (!memberships?.length) {
      return
    }

    const stored = memberships.find(
      (membership) => membership.projectId === activeProjectId
    )

    if (!stored) {
      switchProject(memberships[0])
    }
  }, [memberships, activeProjectId, switchProject])

  if (membershipsLoading) {
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
