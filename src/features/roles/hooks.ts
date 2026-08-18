import { useMemo } from "react"

import { createResourceHooks } from "@/lib/query/resource-hooks"
import { PERMISSION_ACTIONS } from "@/lib/rbac"
import type { PermissionMap } from "@/lib/rbac"
import { rolesService } from "@/services"
import type { Id } from "@/types/api"
import type {
  Entitlement,
  Role,
  RoleEntitlementPermission,
} from "@/types/models"

export const roleQueries = createResourceHooks(rolesService)

export const {
  keys: roleKeys,
  useList: useRolesQuery,
  useListAll: useAllRoles,
  useOne: useRole,
  useCreate: useCreateRole,
  useUpdate: useUpdateRole,
  useRemove: useRemoveRole,
} = roleQueries

/** Every role defined for a project, ordered so system roles read first. */
export const useProjectRoles = (projectId: Id | null | undefined) =>
  useAllRoles(
    {
      where: { projectId: projectId ?? "", status: "active" },
      sortAsc: "roleName",
    },
    { enabled: Boolean(projectId) }
  )

/* -------------------------------------------------------------------------- *
 * Matrix conversion
 * -------------------------------------------------------------------------- */

/**
 * A role stores grants as a sparse list keyed by entitlement; the matrix editor wants a
 * dense `entitlement × action` grid. These two functions are the only place that
 * translation happens, so the editor never has to reason about the wire format.
 */
export const roleToPermissionMap = (
  role: Pick<Role, "entitlementPermissions"> | undefined,
  entitlements: Entitlement[]
): PermissionMap => {
  const granted = new Map(
    (role?.entitlementPermissions ?? []).map((grant) => [
      grant.entitlementCode,
      grant.permissions,
    ])
  )

  return Object.fromEntries(
    entitlements.map((entitlement) => {
      const grant = granted.get(entitlement.entitlementCode)

      return [
        entitlement.entitlementCode,
        Object.fromEntries(
          PERMISSION_ACTIONS.map((action) => [
            action,
            // A grant only counts where the entitlement offers the action. Stale grants
            // for actions that were later withdrawn must not show as checked.
            entitlement.applicablePermissions[action]?.enabled === true &&
              grant?.[action]?.isAllowed === true,
          ])
        ),
      ]
    })
  ) as PermissionMap
}

/** The inverse — the payload shape `PATCH /roles/:id` expects. */
export const permissionMapToRole = (
  permissions: PermissionMap,
  entitlements: Entitlement[]
): RoleEntitlementPermission[] =>
  entitlements.map((entitlement) => ({
    entitlementCode: entitlement.entitlementCode,
    permissions: Object.fromEntries(
      PERMISSION_ACTIONS.map((action) => [
        action,
        {
          isAllowed:
            entitlement.applicablePermissions[action]?.enabled === true &&
            permissions[entitlement.entitlementCode]?.[action] === true,
        },
      ])
    ) as RoleEntitlementPermission["permissions"],
  }))

/** Memoised matrix for one role — recomputed only when the role or catalogue changes. */
export const useRolePermissionMap = (
  role: Role | undefined,
  entitlements: Entitlement[] | undefined
): PermissionMap =>
  useMemo(
    () => roleToPermissionMap(role, entitlements ?? []),
    [role, entitlements]
  )
