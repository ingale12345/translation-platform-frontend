import { ChevronDownIcon, PlusIcon, UsersIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Can } from "@/components/common/can"
import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  toggleRoleId,
  useProjectMemberRows,
  useUpdateProjectMember,
} from "@/features/project-members/hooks"
import type { ProjectMemberRow } from "@/features/project-members/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { formatDate, fullName } from "@/lib/format"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { Id } from "@/types/api"
import type { ProjectMemberStatus, Role } from "@/types/models"

const STATUS_VARIANT: Record<
  ProjectMemberStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  invited: "secondary",
  inactive: "outline",
  removed: "destructive",
}

/**
 * Project membership and role assignment.
 *
 * A member can hold several roles and their permissions are the union, so roles are
 * checkboxes rather than a single-select — the model allows "translator plus reviewer",
 * and a dropdown that picks one would quietly make that unrepresentable.
 */
export function MembersPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canManage = can(ENTITLEMENTS.PROJECT_MEMBERS, "update")

  const { rows, roles, isLoading, error, refetch } =
    useProjectMemberRows(projectId)
  const updateMember = useUpdateProjectMember()
  const [pendingId, setPendingId] = useState<Id | null>(null)

  const toggleRole = (row: ProjectMemberRow, role: Role) => {
    const next = toggleRoleId(row.member.roleIds, role._id)

    if (next === row.member.roleIds) {
      toast.error(
        "A member must keep at least one role. Remove them to revoke access."
      )
      return
    }

    setPendingId(row.member._id)
    updateMember.mutate(
      { id: row.member._id, data: { roleIds: next } },
      {
        onSuccess: () => toast.success("Roles updated"),
        onError: (mutationError) => toast.error(errorMessage(mutationError)),
        onSettled: () => setPendingId(null),
      }
    )
  }

  const columns: DataTableColumn<ProjectMemberRow>[] = [
    {
      id: "member",
      header: "Member",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar user={row.user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{fullName(row.user)}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {row.user?.email ?? row.member.userId}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.length > 0 ? (
            row.roles.map((role) => (
              <Badge key={role._id} variant="secondary">
                {role.roleName}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">no roles</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={STATUS_VARIANT[row.member.status]}>
          {row.member.status}
        </Badge>
      ),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.member.joinedAt)}
        </span>
      ),
    },
    {
      id: "manage",
      header: "Manage",
      align: "right",
      cell: (row) =>
        canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === row.member._id}
                >
                  Roles <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Assign roles</DropdownMenuLabel>
              {roles.map((role) => (
                <label
                  key={role._id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={row.member.roleIds.includes(role._id)}
                    onCheckedChange={() => toggleRole(row, role)}
                  />
                  <span className="flex-1">{role.roleName}</span>
                </label>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-xs text-muted-foreground">read-only</span>
        ),
    },
  ]

  return (
    <div className="p-5">
      <PageHeader
        title="Members"
        description="A user can hold several roles here; their permissions are the union of all of them."
        actions={
          <Can entitlement={ENTITLEMENTS.PROJECT_MEMBERS} action="create">
            <Button disabled>
              <PlusIcon /> Invite member
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.member._id}
        isLoading={isLoading}
        error={error}
        empty={
          <EmptyState
            icon={UsersIcon}
            title="No members yet"
            body="Invite someone to give them access to this project."
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh
              </Button>
            }
          />
        }
      />
    </div>
  )
}
