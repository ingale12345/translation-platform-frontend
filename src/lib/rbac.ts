import { PERMISSION_ACTIONS } from "@/types/models"
import type { PermissionAction } from "@/types/models"
import type { PermissionMap } from "@/types/session"

export { PERMISSION_ACTIONS }
export type { PermissionAction, PermissionMap }

/**
 * Client-side permission reads.
 *
 * These gate *presentation only* — hiding a button the user cannot use. The server
 * re-checks every request, so a client that lies to itself gets a 403, not access.
 */

/** Entitlement codes, seeded by `day0/entitlements.json`. */
export const ENTITLEMENTS = {
  DASHBOARD: "DASHBOARD",
  ORGANIZATIONS: "ORGANIZATIONS",
  PROJECTS: "PROJECTS",
  APPLICATIONS: "APPLICATIONS",
  LANGUAGES: "LANGUAGES",
  PROJECT_MEMBERS: "PROJECT_MEMBERS",
  ROLES: "ROLES",
  TRANSLATIONS: "TRANSLATIONS",
  TRANSLATION_COMMENTS: "TRANSLATION_COMMENTS",
  IMPORT: "IMPORT",
  EXPORT: "EXPORT",
  TEMPLATES: "TEMPLATES",
  API_TOKENS: "API_TOKENS",
  AUDIT_LOGS: "AUDIT_LOGS",
  SETTINGS: "SETTINGS",
} as const

export type EntitlementCode = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS]

export const ACTION_LABEL: Record<PermissionAction, string> = {
  read: "Read",
  create: "Create",
  update: "Update",
  delete: "Delete",
  download: "Download",
  approve: "Approve",
  publish: "Publish",
}

/** Single letters for the matrix header, where a full label would not fit. */
export const ACTION_SHORT: Record<PermissionAction, string> = {
  read: "R",
  create: "C",
  update: "U",
  delete: "D",
  download: "W",
  approve: "A",
  publish: "P",
}

/** Does the user hold `action` on `entitlement` in the current project? */
export const can = (
  permissions: PermissionMap | undefined,
  entitlement: EntitlementCode | string,
  action: PermissionAction
): boolean => permissions?.[entitlement]?.[action] === true

/** True when *any* of the pairs is granted — for a control with several ways in. */
export const canAny = (
  permissions: PermissionMap | undefined,
  pairs: Array<[EntitlementCode | string, PermissionAction]>
): boolean =>
  pairs.some(([entitlement, action]) => can(permissions, entitlement, action))

/** True only when *every* pair is granted — for a flow that needs all of them. */
export const canAll = (
  permissions: PermissionMap | undefined,
  pairs: Array<[EntitlementCode | string, PermissionAction]>
): boolean =>
  pairs.every(([entitlement, action]) => can(permissions, entitlement, action))

/** Every action granted on one entitlement — used to summarise a role. */
export const grantedActions = (
  permissions: PermissionMap | undefined,
  entitlement: EntitlementCode | string
): PermissionAction[] =>
  PERMISSION_ACTIONS.filter((action) => can(permissions, entitlement, action))

/** Total grants across the whole matrix, for the "N grants" label on a role. */
export const countGrants = (permissions: PermissionMap | undefined): number => {
  if (!permissions) {
    return 0
  }

  return Object.values(permissions).reduce(
    (total, actions) =>
      total + PERMISSION_ACTIONS.filter((action) => actions[action]).length,
    0
  )
}

/** An all-`false` row, so a matrix always has a cell to render. */
export const emptyActions = (): Record<PermissionAction, boolean> =>
  Object.fromEntries(
    PERMISSION_ACTIONS.map((action) => [action, false])
  ) as Record<PermissionAction, boolean>
