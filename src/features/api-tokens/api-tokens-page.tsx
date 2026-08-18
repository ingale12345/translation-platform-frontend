import { InfoIcon, KeyRoundIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useAllApplications } from "@/features/applications/hooks"
import {
  useApiTokens,
  useRemoveApiToken,
  useUpdateApiToken,
} from "@/features/api-tokens/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { formatDate, formatRelative } from "@/lib/format"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { ApiToken } from "@/types/models"

/**
 * Read-only tokens for the consumption API.
 *
 * Creation is intentionally absent. The backend's `apiTokensDataSchema` accepts
 * `tokenHash` from the client, which would mean the browser minting the secret and
 * choosing its own hash — a token nobody can trust. The server has to generate both and
 * return the plaintext once. Tracked as item 8 in docs/UI_PLAN.md §5.
 */
export function ApiTokensPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canUpdate = can(ENTITLEMENTS.API_TOKENS, "update")
  const canDelete = can(ENTITLEMENTS.API_TOKENS, "delete")
  const canCreate = can(ENTITLEMENTS.API_TOKENS, "create")

  const tokensQuery = useApiTokens(
    {
      where: { projectId: projectId ?? "" },
      sortDesc: "createdAt",
      limit: 100,
    },
    { enabled: Boolean(projectId) }
  )
  const applicationsQuery = useAllApplications(
    { where: { projectId: projectId ?? "" } },
    { enabled: Boolean(projectId) }
  )
  const updateToken = useUpdateApiToken()
  const removeToken = useRemoveApiToken()

  const [pendingDelete, setPendingDelete] = useState<ApiToken | null>(null)

  const applicationName = new Map(
    (applicationsQuery.data ?? []).map((application) => [
      application._id,
      application.name,
    ])
  )

  /** Revoking flips `enabled`; it is not a delete, so the audit trail survives. */
  const toggleEnabled = (token: ApiToken) => {
    updateToken.mutate(
      { id: token._id, data: { enabled: !token.enabled } },
      {
        onSuccess: () =>
          toast.success(
            token.enabled ? `${token.name} revoked` : `${token.name} re-enabled`
          ),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const columns: DataTableColumn<ApiToken>[] = [
    {
      id: "name",
      header: "Name",
      cell: (token) => (
        <div>
          <p className="text-sm font-medium">{token.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {token.tokenPrefix}…
          </p>
        </div>
      ),
    },
    {
      id: "application",
      header: "Application",
      cell: (token) => (
        <span className="text-sm">
          {applicationName.get(token.applicationId) ?? (
            <span className="text-muted-foreground">unknown</span>
          )}
        </span>
      ),
    },
    {
      id: "permissions",
      header: "Scope",
      cell: (token) => (
        <div className="flex flex-wrap gap-1">
          {token.permissions.length > 0 ? (
            token.permissions.map((permission) => (
              <Badge key={permission} variant="outline">
                {permission}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">read</span>
          )}
        </div>
      ),
    },
    {
      id: "lastUsed",
      header: "Last used",
      cell: (token) => (
        <span className="text-xs text-muted-foreground">
          {token.lastUsedAt ? formatRelative(token.lastUsedAt) : "never"}
        </span>
      ),
    },
    {
      id: "expires",
      header: "Expires",
      cell: (token) => (
        <span className="text-xs text-muted-foreground">
          {token.expiresAt ? formatDate(token.expiresAt) : "never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (token) => (
        <div className="flex items-center justify-end gap-2">
          {canUpdate ? (
            <Switch
              checked={token.enabled}
              onCheckedChange={() => toggleEnabled(token)}
              aria-label={
                token.enabled
                  ? `Revoke ${token.name}`
                  : `Re-enable ${token.name}`
              }
            />
          ) : (
            <Badge variant={token.enabled ? "default" : "outline"}>
              {token.enabled ? "active" : "revoked"}
            </Badge>
          )}
          {canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              aria-label={`Delete ${token.name}`}
              onClick={() => setPendingDelete(token)}
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="p-5">
      <PageHeader
        title="API Tokens"
        description="Project-scoped, read-only credentials for the consumption API."
      />

      {canCreate ? (
        <Alert className="mb-4">
          <InfoIcon />
          <AlertDescription>
            Creating tokens is not available yet. A token must be generated
            server-side and returned exactly once — the current API would have
            the browser choose its own secret, so the button is withheld rather
            than shipped broken.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        rows={tokensQuery.data?.data ?? []}
        rowKey={(token) => token._id}
        isLoading={tokensQuery.isLoading}
        error={tokensQuery.error}
        empty={
          <EmptyState
            icon={KeyRoundIcon}
            title="No API tokens"
            body="Tokens let a deployed application fetch its translations at runtime instead of bundling them."
          />
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete ${pendingDelete?.name}?`}
        description="Any application still using this token starts failing immediately. Revoking with the toggle is usually safer — it keeps the record for the audit trail."
        confirmLabel="Delete token"
        destructive
        isPending={removeToken.isPending}
        onConfirm={() =>
          pendingDelete &&
          removeToken.mutate(pendingDelete._id, {
            onSuccess: () => {
              toast.success(`${pendingDelete.name} deleted`)
              setPendingDelete(null)
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />
    </div>
  )
}
