import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ACTION_LABEL, ACTION_SHORT, PERMISSION_ACTIONS, can } from "@/lib/rbac"
import type { PermissionAction, PermissionMap } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Entitlement } from "@/types/models"

interface PermissionMatrixProps {
  /** Entitlement definitions, in display order. */
  entitlements: Entitlement[]
  permissions: PermissionMap
  /** When false the matrix is a read-only view of what a role grants. */
  editable?: boolean
  onToggle?: (entitlementCode: string, action: PermissionAction) => void
  className?: string
}

/**
 * The entitlement × action grid — the one place the whole RBAC model is visible at once.
 *
 * Shared by the role editor and the "my permissions" dialog, which is the point: a user
 * inspecting their own access sees the same grid an admin edits, so the two views cannot
 * describe the model differently.
 *
 * Actions an entitlement does not offer render as an inert dash rather than an unchecked
 * box — an unchecked box reads as "off, and you could turn it on", which would be a lie.
 */
export function PermissionMatrix({
  entitlements,
  permissions,
  editable = false,
  onToggle,
  className,
}: PermissionMatrixProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                Entitlement
              </th>
              {PERMISSION_ACTIONS.map((action) => (
                <th key={action} className="w-14 px-1 py-2 text-center">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {ACTION_SHORT[action]}
                        </span>
                      }
                    />
                    <TooltipContent>{ACTION_LABEL[action]}</TooltipContent>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entitlements.map((entitlement) => (
              <tr
                key={entitlement.entitlementCode}
                className="border-b last:border-0 hover:bg-muted/40"
              >
                <td className="px-3 py-2">
                  <p className="font-medium">{entitlement.entitlementName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {entitlement.entitlementCode}
                  </p>
                </td>
                {PERMISSION_ACTIONS.map((action) => {
                  const offered =
                    entitlement.applicablePermissions[action]?.enabled === true

                  if (!offered) {
                    return (
                      <td key={action} className="px-1 py-2 text-center">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="inline-block h-0.5 w-3 rounded bg-border align-middle" />
                            }
                          />
                          <TooltipContent>
                            Not available for this feature
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    )
                  }

                  return (
                    <td key={action} className="px-1 py-2">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={can(
                            permissions,
                            entitlement.entitlementCode,
                            action
                          )}
                          disabled={!editable}
                          onCheckedChange={() =>
                            onToggle?.(entitlement.entitlementCode, action)
                          }
                          aria-label={`${ACTION_LABEL[action]} ${entitlement.entitlementName}`}
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
