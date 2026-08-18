import type { ReactNode } from "react"

import { usePermissions } from "@/features/session/hooks"
import type { EntitlementCode, PermissionAction } from "@/lib/rbac"

interface CanProps {
  entitlement: EntitlementCode | string
  action: PermissionAction
  children: ReactNode
  /** Shown when the permission is missing. Usually nothing — hide, do not disable. */
  fallback?: ReactNode
}

/**
 * Renders `children` only if the current user holds the permission in the active project.
 *
 * This is presentation, not enforcement: the server checks every request independently.
 * The point is that a user is never shown a control that would 403 — which is also why
 * the default fallback is nothing rather than a disabled button.
 */
export function Can({
  entitlement,
  action,
  children,
  fallback = null,
}: CanProps) {
  const { can } = usePermissions()

  return <>{can(entitlement, action) ? children : fallback}</>
}
