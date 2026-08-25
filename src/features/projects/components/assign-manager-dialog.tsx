import { CheckIcon, UserCogIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { QueryBoundary } from "@/components/common/query-boundary"
import { SearchInput } from "@/components/common/search-input"
import { UserAvatar } from "@/components/common/user-avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useAllProjectMembers,
  useInviteProjectMember,
  useUpdateProjectMember,
} from "@/features/project-members/hooks"
import { useAllRoles } from "@/features/roles/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { fullName } from "@/lib/format"
import { errorMessage } from "@/lib/http/errors"
import { contains } from "@/lib/http/params"
import { cn } from "@/lib/utils"
import type { UserMembership } from "@/types/session"

const MANAGER_ROLE_CODE = "PROJECT_MANAGER"

interface AssignManagerDialogProps {
  membership: UserMembership | null
  onOpenChange: (open: boolean) => void
}

/**
 * Puts someone in charge of a project.
 *
 * A manager is not a separate concept — it is a project member holding the
 * `PROJECT_MANAGER` role, which grants members, roles and settings for that project. This
 * dialog exists because that is the one assignment a platform admin has to make before a
 * project can be staffed by anyone else, and burying it inside the Members screen means
 * entering the project first, which is exactly what they cannot do until it has a manager.
 *
 * The same person can manage several projects: this adds a membership, it does not move
 * one.
 */
export function AssignManagerDialog({
  membership,
  onOpenChange,
}: AssignManagerDialogProps) {
  const [search, setSearch] = useState("")
  const createMember = useInviteProjectMember()
  const updateMember = useUpdateProjectMember()

  const projectId = membership?.projectId
  const open = Boolean(membership)

  const rolesQuery = useAllRoles(
    { where: { projectId: projectId ?? "", roleCode: MANAGER_ROLE_CODE } },
    { enabled: Boolean(projectId) }
  )
  const managerRole = rolesQuery.data?.[0]

  const membersQuery = useAllProjectMembers(
    { where: { projectId: projectId ?? "" }, limit: 500 },
    { enabled: Boolean(projectId) }
  )

  const usersQuery = useAllUsers(
    {
      where: search.trim() ? { email: contains(search.trim()) } : {},
      sortAsc: "firstName",
      limit: 50,
    },
    { enabled: open }
  )

  const memberByUserId = useMemo(
    () =>
      new Map(
        (membersQuery.data ?? []).map((member) => [member.userId, member])
      ),
    [membersQuery.data]
  )

  const users = usersQuery.data ?? []

  const assign = (userId: string) => {
    if (!membership || !managerRole) {
      return
    }

    const existing = memberByUserId.get(userId)
    const handlers = {
      onSuccess: () => {
        toast.success("Manager assigned")
        void membersQuery.refetch()
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    }

    // Already in the project as something else — add the role rather than replacing the
    // membership, so a developer who takes over a project keeps their other roles.
    if (existing) {
      if (existing.roleIds.includes(managerRole._id)) {
        return
      }

      updateMember.mutate(
        {
          id: existing._id,
          data: {
            roleIds: [...existing.roleIds, managerRole._id],
            status: "active",
          },
        },
        handlers
      )
      return
    }

    createMember.mutate(
      {
        organizationId: membership.organizationId,
        projectId: membership.projectId,
        userId,
        roleIds: [managerRole._id],
        status: "active",
        joinedAt: new Date().toISOString(),
      },
      handlers
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCogIcon className="size-4" /> Manager of{" "}
            {membership?.project?.name}
          </DialogTitle>
          <DialogDescription>
            A manager runs this project: they add its members, edit its roles
            and change its settings. One person can manage several projects.
          </DialogDescription>
        </DialogHeader>

        {!managerRole && !rolesQuery.isLoading ? (
          <Alert variant="destructive">
            <AlertDescription>
              This project has no {MANAGER_ROLE_CODE} role, so nobody can be
              made its manager. It was created before the platform seeded system
              roles per project — re-running the install seed repairs it.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search people by email…"
          />

          <QueryBoundary
            isLoading={usersQuery.isLoading}
            error={usersQuery.error}
            isEmpty={users.length === 0}
            onRetry={usersQuery.refetch}
            empty={
              <EmptyState
                title="Nobody found"
                body="Try a different email, or create the account first."
              />
            }
          >
            <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {users.map((user) => {
                const member = memberByUserId.get(user._id)
                const isManager = Boolean(
                  managerRole && member?.roleIds.includes(managerRole._id)
                )

                return (
                  <li
                    key={user._id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <UserAvatar user={user} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {fullName(user)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {user.email}
                      </p>
                    </div>

                    {member && !isManager ? (
                      <span className="text-[11px] text-muted-foreground">
                        already a member
                      </span>
                    ) : null}

                    <Button
                      size="sm"
                      variant={isManager ? "secondary" : "outline"}
                      disabled={
                        isManager ||
                        !managerRole ||
                        createMember.isPending ||
                        updateMember.isPending
                      }
                      onClick={() => assign(user._id)}
                      className={cn(isManager && "pointer-events-none")}
                    >
                      {isManager ? (
                        <>
                          <CheckIcon /> Manager
                        </>
                      ) : (
                        "Make manager"
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </QueryBoundary>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
