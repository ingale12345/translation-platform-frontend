import { BoxesIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Can } from "@/components/common/can"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { QueryBoundary } from "@/components/common/query-boundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAllApplications,
  useRemoveApplication,
} from "@/features/applications/hooks"
import { useAllLanguages } from "@/features/languages/hooks"
import { useProject } from "@/features/projects/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { Application } from "@/types/models"
import { ApplicationFormDialog } from "./components/application-form-dialog"

/**
 * The project's applications, as a card grid.
 *
 * Cards rather than a table: an application is identified by its platform and its language
 * set, both of which read better as glanceable shapes than as columns of text.
 */
export function ApplicationsPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canUpdate = can(ENTITLEMENTS.APPLICATIONS, "update")
  const canDelete = can(ENTITLEMENTS.APPLICATIONS, "delete")

  const applicationsQuery = useAllApplications(
    { where: { projectId: projectId ?? "" }, sortAsc: "name" },
    { enabled: Boolean(projectId) }
  )
  const projectQuery = useProject(projectId ?? undefined)
  const languagesQuery = useAllLanguages({ sortAsc: "sortOrder" })
  const removeApplication = useRemoveApplication()

  const [editing, setEditing] = useState<Application | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null)

  const languageLabels = useMemo(
    () =>
      new Map(
        (languagesQuery.data ?? []).map((language) => [
          language.code,
          { name: language.name, nativeName: language.nativeName },
        ])
      ),
    [languagesQuery.data]
  )

  const applications = applicationsQuery.data ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (application: Application) => {
    setEditing(application)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    removeApplication.mutate(pendingDelete._id, {
      onSuccess: () => {
        toast.success(`${pendingDelete.name} removed`)
        setPendingDelete(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Applications"
        description="Each application owns its own keys, languages and export format."
        actions={
          <Can entitlement={ENTITLEMENTS.APPLICATIONS} action="create">
            <Button onClick={openCreate}>
              <PlusIcon /> New application
            </Button>
          </Can>
        }
      />

      <QueryBoundary
        isLoading={applicationsQuery.isLoading}
        error={applicationsQuery.error}
        isEmpty={applications.length === 0}
        onRetry={applicationsQuery.refetch}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        }
        empty={
          <EmptyState
            icon={BoxesIcon}
            title="No applications yet"
            body="Translation keys belong to an application. Create the first one to start adding keys."
            action={
              <Can entitlement={ENTITLEMENTS.APPLICATIONS} action="create">
                <Button onClick={openCreate}>
                  <PlusIcon /> New application
                </Button>
              </Can>
            }
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((application) => (
            <div
              key={application._id}
              className="group flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <BoxesIcon className="size-4.5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{application.type}</Badge>
                  {application.status !== "active" ? (
                    <Badge variant="outline">{application.status}</Badge>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold">{application.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {application.code}
              </p>

              {application.description ? (
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                  {application.description}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-1">
                {application.supportedLanguages.map((code) => (
                  <span
                    key={code}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    title={languageLabels.get(code)?.name}
                  >
                    {code}
                    {code === application.defaultLanguage ? " ·" : ""}
                  </span>
                ))}
              </div>

              {canUpdate || canDelete ? (
                <div className="mt-4 flex items-center gap-1.5 border-t pt-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {canUpdate ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(application)}
                    >
                      <PencilIcon /> Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive"
                      onClick={() => setPendingDelete(application)}
                    >
                      <Trash2Icon /> Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </QueryBoundary>

      <ApplicationFormDialog
        open={isFormOpen}
        onOpenChange={setFormOpen}
        application={editing ?? undefined}
        project={projectQuery.data}
        languageLabels={languageLabels}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}
        title={`Delete ${pendingDelete?.name}?`}
        description="Its translation keys, history and API tokens go with it. This cannot be undone."
        confirmLabel="Delete application"
        destructive
        isPending={removeApplication.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
