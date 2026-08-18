import {
  ArrowRightIcon,
  BoxesIcon,
  FolderKanbanIcon,
  PencilIcon,
  PlusIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Can } from "@/components/common/can"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { QueryBoundary } from "@/components/common/query-boundary"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAllApplications } from "@/features/applications/hooks"
import { useAllProjectMembers } from "@/features/project-members/hooks"
import { useAllRoles } from "@/features/roles/hooks"
import {
  useActiveProjectId,
  useMemberships,
  usePermissions,
  useSwitchProject,
} from "@/features/session/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { fullName } from "@/lib/format"
import { ENTITLEMENTS } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type { Project } from "@/types/models"
import type { UserMembership } from "@/types/session"
import { AssignManagerDialog } from "./components/assign-manager-dialog"
import { ProjectFormDialog } from "./components/project-form-dialog"

const MANAGER_ROLE_CODE = "PROJECT_MANAGER"

/**
 * Every project the user can enter, and the controls to add more.
 *
 * This is a platform admin's home. It is built from `GET /me/memberships` rather than
 * `GET /projects`, because that endpoint already answers the harder question: which
 * projects can this person actually *enter*, whether through an organization-scoped role
 * or an explicit membership. Listing projects instead would show a manager rows they
 * cannot open.
 *
 * Clicking a card switches the active project, so the existing screens take over from
 * there — a manager lands in the project's dashboard rather than a separate cross-project
 * view of everything.
 */
export function ProjectsPage() {
  const membershipsQuery = useMemberships()
  const activeProjectId = useActiveProjectId()
  const switchProject = useSwitchProject()
  const { can } = usePermissions()

  const canCreate = can(ENTITLEMENTS.PROJECTS, "create")
  const canManageMembers = can(ENTITLEMENTS.PROJECT_MEMBERS, "create")

  const [editing, setEditing] = useState<Project | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [assigning, setAssigning] = useState<UserMembership | null>(null)

  const memberships = useMemo(
    () =>
      [...(membershipsQuery.data ?? [])].sort((a, b) =>
        (a.project?.name ?? "").localeCompare(b.project?.name ?? "")
      ),
    [membershipsQuery.data]
  )
  const projectIds = useMemo(
    () => memberships.map((membership) => membership.projectId),
    [memberships]
  )

  // Three page-scoped queries feed every card's stats, rather than one per card: with a
  // dozen projects that difference is 3 requests against 36.
  const applicationsQuery = useAllApplications(
    { where: { projectId: { $in: projectIds } }, limit: 500 },
    { enabled: projectIds.length > 0 }
  )
  const membersQuery = useAllProjectMembers(
    {
      where: { projectId: { $in: projectIds }, status: "active" },
      limit: 1000,
    },
    { enabled: projectIds.length > 0 }
  )
  const rolesQuery = useAllRoles(
    { where: { projectId: { $in: projectIds }, roleCode: MANAGER_ROLE_CODE } },
    { enabled: projectIds.length > 0 }
  )

  const managerRoleIds = useMemo(
    () => new Set((rolesQuery.data ?? []).map((role) => role._id)),
    [rolesQuery.data]
  )

  const managerUserIds = useMemo(
    () =>
      Array.from(
        new Set(
          (membersQuery.data ?? [])
            .filter((member) =>
              member.roleIds.some((roleId) => managerRoleIds.has(roleId))
            )
            .map((member) => member.userId)
        )
      ),
    [membersQuery.data, managerRoleIds]
  )

  const usersQuery = useAllUsers(
    { where: { _id: { $in: managerUserIds } }, limit: 200 },
    { enabled: managerUserIds.length > 0 }
  )
  const userById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user._id, user])),
    [usersQuery.data]
  )

  const statsFor = (projectId: Id) => {
    const members = (membersQuery.data ?? []).filter(
      (member) => member.projectId === projectId
    )

    return {
      applications: (applicationsQuery.data ?? []).filter(
        (application) => application.projectId === projectId
      ).length,
      members: members.length,
      managers: members
        .filter((member) =>
          member.roleIds.some((roleId) => managerRoleIds.has(roleId))
        )
        .map((member) => userById.get(member.userId))
        .filter((user) => Boolean(user)),
    }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Projects"
        description="Every project you can open. A project holds the applications a team ships together."
        actions={
          <Can entitlement={ENTITLEMENTS.PROJECTS} action="create">
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <PlusIcon /> New project
            </Button>
          </Can>
        }
      />

      <QueryBoundary
        isLoading={membershipsQuery.isLoading}
        error={membershipsQuery.error}
        isEmpty={memberships.length === 0}
        onRetry={membershipsQuery.refetch}
        empty={
          <EmptyState
            icon={FolderKanbanIcon}
            title={canCreate ? "No projects yet" : "You are not in any project"}
            body={
              canCreate
                ? "Create the first project, then assign a manager to run it."
                : "A platform admin has to add you to a project before you can work in one."
            }
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {memberships.map((membership) => {
            const stats = statsFor(membership.projectId)
            const isActive = membership.projectId === activeProjectId

            return (
              <article
                key={membership.projectId}
                className={cn(
                  "group flex flex-col rounded-xl border bg-card p-4 transition-colors",
                  isActive
                    ? "border-primary ring-1 ring-primary/20"
                    : "hover:border-foreground/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {membership.project?.name ?? "Unknown project"}
                    </h2>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {membership.project?.code}
                    </p>
                  </div>
                  {isActive ? <Badge>Current</Badge> : null}
                </div>

                {membership.project?.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {membership.project.description}
                  </p>
                ) : null}

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <BoxesIcon className="size-3" />
                    <dd className="tabular-nums">{stats.applications}</dd>
                    <dt>apps</dt>
                  </div>
                  <div className="flex items-center gap-1">
                    <UsersIcon className="size-3" />
                    <dd className="tabular-nums">{stats.members}</dd>
                    <dt>members</dt>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">
                      {membership.project?.supportedLanguages.length ?? 0}
                    </span>
                    <dt>languages</dt>
                  </div>
                </dl>

                <div className="mt-3 flex min-h-8 items-center gap-2 border-t pt-3">
                  {stats.managers.length > 0 ? (
                    <>
                      <span className="text-[11px] text-muted-foreground">
                        Manager
                      </span>
                      <div className="flex items-center gap-1.5">
                        {stats.managers.slice(0, 2).map((manager) => (
                          <span
                            key={manager?._id}
                            className="flex items-center gap-1.5"
                            title={manager?.email}
                          >
                            <UserAvatar user={manager} className="size-5" />
                            <span className="text-xs">{fullName(manager)}</span>
                          </span>
                        ))}
                        {stats.managers.length > 2 ? (
                          <span className="text-[11px] text-muted-foreground">
                            +{stats.managers.length - 2}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    // An unmanaged project is the state worth surfacing: nobody can add
                    // members to it, so it will quietly stay empty.
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      No manager assigned
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={isActive ? "secondary" : "default"}
                    onClick={() => switchProject(membership)}
                  >
                    {isActive ? "Current project" : "Open"}
                    {isActive ? null : <ArrowRightIcon />}
                  </Button>

                  {canManageMembers ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAssigning(membership)}
                    >
                      <UserCogIcon /> Manager
                    </Button>
                  ) : null}

                  <Can entitlement={ENTITLEMENTS.PROJECTS} action="update">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${membership.project?.name}`}
                      onClick={() => {
                        setEditing((membership.project as Project) ?? null)
                        setFormOpen(true)
                      }}
                    >
                      <PencilIcon />
                    </Button>
                  </Can>

                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {membership.via === "organization"
                      ? "org access"
                      : membership.roles
                          .map((role) => role.roleName)
                          .join(", ")}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      </QueryBoundary>

      <ProjectFormDialog
        open={isFormOpen}
        onOpenChange={setFormOpen}
        project={editing ?? undefined}
      />

      <AssignManagerDialog
        membership={assigning}
        onOpenChange={(open) => (open ? undefined : setAssigning(null))}
      />
    </div>
  )
}
