import {
  CircleDotIcon,
  CopyIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { QueryBoundary } from "@/components/common/query-boundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllEntitlements } from "@/features/entitlements/hooks"
import {
  permissionMapToRole,
  roleToPermissionMap,
  useProjectRoles,
  useRemoveRole,
  useUpdateRole,
} from "@/features/roles/hooks"
import { useProjectMemberRows } from "@/features/project-members/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS, countGrants } from "@/lib/rbac"
import type { PermissionAction, PermissionMap } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import { PermissionMatrix } from "./components/permission-matrix"
import { RoleFormDialog } from "./components/role-form-dialog"
import type { RoleDialogMode } from "./components/role-form-dialog"

/**
 * Roles and their permission matrices.
 *
 * A master/detail layout: the role list is the navigation, the matrix is the document.
 * Edits are staged locally and saved explicitly, because toggling 15 entitlements × 7
 * actions one PATCH at a time would be both slow and impossible to cancel.
 */
export function RolesPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canUpdate = can(ENTITLEMENTS.ROLES, "update")
  const canCreate = can(ENTITLEMENTS.ROLES, "create")
  const canDelete = can(ENTITLEMENTS.ROLES, "delete")

  const rolesQuery = useProjectRoles(projectId)
  const entitlementsQuery = useAllEntitlements({
    where: { status: "active" },
    sortAsc: "displayOrder",
  })
  const updateRole = useUpdateRole()
  const removeRole = useRemoveRole()
  const { rows: memberRows } = useProjectMemberRows(projectId)

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data])
  const entitlements = useMemo(
    () => entitlementsQuery.data ?? [],
    [entitlementsQuery.data]
  )

  // The selection is *derived*: a requested id that no longer exists (project switched,
  // role deleted) simply falls back to the first role, so there is no window where the
  // page holds a stale id and renders nothing.
  const [requestedId, setRequestedId] = useState<Id | null>(null)
  const selected = roles.find((role) => role._id === requestedId) ?? roles[0]
  const selectedId = selected?._id ?? null

  /**
   * The staged matrix, reset whenever the underlying role changes — including after a
   * save, when `updatedAt` moves. Carrying a half-edited matrix across a role switch
   * would silently write it to the wrong role.
   *
   * Adjusted during render rather than in an effect: an effect would render one frame of
   * the previous role's grants against the new role's name.
   */
  const draftKey = selected
    ? `${selected._id}:${selected.updatedAt ?? ""}:${entitlements.length}`
    : null
  const [lastDraftKey, setLastDraftKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<PermissionMap | null>(null)

  if (draftKey !== lastDraftKey) {
    setLastDraftKey(draftKey)
    setDraft(selected ? roleToPermissionMap(selected, entitlements) : null)
  }

  const isSystem = selected?.isSystem ?? false
  const editable = canUpdate && !isSystem
  const saved = selected ? roleToPermissionMap(selected, entitlements) : null
  const isDirty = Boolean(
    draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)
  )

  const [dialog, setDialog] = useState<{ mode: RoleDialogMode } | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)

  /** How many members would lose this role — the number that makes a delete real. */
  const holderCount = selected
    ? memberRows.filter((row) => row.member.roleIds.includes(selected._id))
        .length
    : 0

  const deleteRole = () => {
    if (!selected) {
      return
    }

    removeRole.mutate(selected._id, {
      onSuccess: () => {
        toast.success(`${selected.roleName} deleted`)
        setPendingDelete(false)
        setRequestedId(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const toggle = (entitlementCode: string, action: PermissionAction) => {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        [entitlementCode]: {
          ...current[entitlementCode],
          [action]: !current[entitlementCode]?.[action],
        },
      }
    })
  }

  const save = () => {
    if (!selected || !draft) {
      return
    }

    updateRole.mutate(
      {
        id: selected._id,
        data: {
          entitlementPermissions: permissionMapToRole(draft, entitlements),
        },
      },
      {
        onSuccess: () => toast.success(`${selected.roleName} saved`),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 overflow-y-auto border-r bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Roles
          </p>
          {canCreate ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="New role"
              onClick={() => setDialog({ mode: "create" })}
            >
              <PlusIcon />
            </Button>
          ) : null}
        </div>

        {rolesQuery.isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : roles.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            No roles defined for this project.
          </p>
        ) : (
          <div className="space-y-0.5">
            {roles.map((role) => {
              const grants = countGrants(
                roleToPermissionMap(role, entitlements)
              )
              const isSelected = role._id === selectedId

              return (
                <button
                  key={role._id}
                  onClick={() => setRequestedId(role._id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors",
                    isSelected ? "bg-accent" : "hover:bg-accent/60"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {role.roleName}
                    </span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {grants} grants
                    </span>
                  </span>
                  <ShieldIcon
                    className={cn(
                      "size-4 shrink-0",
                      isSelected
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                    )}
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <QueryBoundary
          isLoading={rolesQuery.isLoading || entitlementsQuery.isLoading}
          error={rolesQuery.error ?? entitlementsQuery.error}
          isEmpty={!selected}
          onRetry={rolesQuery.refetch}
          empty={
            <EmptyState
              icon={ShieldIcon}
              title="No roles yet"
              body="Roles are project-scoped. Create one, then choose what it grants in the matrix."
              action={
                canCreate ? (
                  <Button
                    size="sm"
                    onClick={() => setDialog({ mode: "create" })}
                  >
                    <PlusIcon /> New role
                  </Button>
                ) : undefined
              }
            />
          }
        >
          {selected && draft ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {selected.roleName}
                    </h2>
                    {isSystem ? (
                      <Badge variant="secondary">
                        <CircleDotIcon /> System role
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selected.description ??
                      "Toggle what this role can do. Dashes mark actions the feature does not offer — they can never be granted."}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {canCreate ? (
                    <Button
                      variant="outline"
                      onClick={() => setDialog({ mode: "duplicate" })}
                    >
                      <CopyIcon /> Duplicate
                    </Button>
                  ) : null}

                  {canUpdate && !isSystem ? (
                    <Button
                      variant="outline"
                      aria-label="Rename role"
                      onClick={() => setDialog({ mode: "edit" })}
                    >
                      <PencilIcon />
                    </Button>
                  ) : null}

                  {canDelete && !isSystem ? (
                    <Button
                      variant="outline"
                      className="text-destructive"
                      aria-label="Delete role"
                      onClick={() => setPendingDelete(true)}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}

                  {editable ? (
                    <Button
                      onClick={save}
                      disabled={!isDirty || updateRole.isPending}
                    >
                      {updateRole.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {isSystem ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                  System roles are read-only. Duplicate this role to create an
                  editable variant.
                </div>
              ) : null}

              {!canUpdate && !isSystem ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                  You can view roles but not change them.
                </div>
              ) : null}

              <PermissionMatrix
                entitlements={entitlements}
                permissions={draft}
                editable={editable}
                onToggle={toggle}
              />
            </>
          ) : null}
        </QueryBoundary>
      </div>

      <RoleFormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => (open ? undefined : setDialog(null))}
        mode={dialog?.mode ?? "create"}
        role={dialog?.mode === "create" ? undefined : selected}
        onCreated={(created) => setRequestedId(created._id)}
      />

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete ${selected?.roleName}?`}
        description={
          holderCount > 0
            ? `${holderCount} member${holderCount === 1 ? "" : "s"} hold this role and will lose everything it grants. Members left with no role keep access to the project but can do nothing in it.`
            : "No member holds this role, so nobody loses access."
        }
        confirmLabel="Delete role"
        destructive
        isPending={removeRole.isPending}
        onConfirm={deleteRole}
      />
    </div>
  )
}
