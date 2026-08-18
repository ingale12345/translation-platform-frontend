import {
  CircleDotIcon,
  FileCode2Icon,
  InfoIcon,
  PlusIcon,
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
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import {
  useAllTemplates,
  useRemoveTemplate,
  useUpdateTemplate,
} from "@/features/templates/hooks"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type {
  Template,
  TemplateExportConfig,
  TemplateImportConfig,
} from "@/types/models"
import { TemplateEditor } from "./components/template-editor"
import { TemplateFormDialog } from "./components/template-form-dialog"

/**
 * Import and export templates, master/detail.
 *
 * Like the roles screen, config edits are staged and saved explicitly — a preview that
 * re-rendered against the server after every keystroke would be unusable, and there is no
 * sensible way to undo a stream of one-field PATCHes.
 */
export function TemplatesPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canCreate = can(ENTITLEMENTS.TEMPLATES, "create")
  const canUpdate = can(ENTITLEMENTS.TEMPLATES, "update")
  const canDelete = can(ENTITLEMENTS.TEMPLATES, "delete")

  const templatesQuery = useAllTemplates(
    { where: { projectId: projectId ?? "" }, sortAsc: "name" },
    { enabled: Boolean(projectId) }
  )
  const updateTemplate = useUpdateTemplate()
  const removeTemplate = useRemoveTemplate()

  const templates = useMemo(
    () => templatesQuery.data ?? [],
    [templatesQuery.data]
  )

  const [requestedId, setRequestedId] = useState<Id | null>(null)
  const selected =
    templates.find((template) => template._id === requestedId) ?? templates[0]

  const [isFormOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  // Staged config, reset when the underlying template changes — including after a save,
  // when `updatedAt` moves. Adjusted during render so the preview never shows one frame
  // of the previous template's output under the new template's name.
  const draftKey = selected
    ? `${selected._id}:${selected.updatedAt ?? ""}`
    : null
  const [lastDraftKey, setLastDraftKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    importConfig: TemplateImportConfig
    exportConfig: TemplateExportConfig
  } | null>(null)

  if (draftKey !== lastDraftKey) {
    setLastDraftKey(draftKey)
    setDraft(
      selected
        ? {
            importConfig: selected.importConfig,
            exportConfig: selected.exportConfig,
          }
        : null
    )
  }

  const isSystem = selected?.isSystem ?? false
  const editable = canUpdate && !isSystem
  const isDirty = Boolean(
    selected &&
    draft &&
    JSON.stringify(draft) !==
      JSON.stringify({
        importConfig: selected.importConfig,
        exportConfig: selected.exportConfig,
      })
  )

  const save = () => {
    if (!selected || !draft) {
      return
    }

    updateTemplate.mutate(
      { id: selected._id, data: draft },
      {
        onSuccess: () => toast.success(`${selected.name} saved`),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const deleteTemplate = () => {
    if (!selected) {
      return
    }

    removeTemplate.mutate(selected._id, {
      onSuccess: () => {
        toast.success(`${selected.name} deleted`)
        setPendingDelete(false)
        setRequestedId(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 overflow-y-auto border-r bg-card p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Templates
          </p>
          {canCreate ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label="New template"
              onClick={() => setFormOpen(true)}
            >
              <PlusIcon />
            </Button>
          ) : null}
        </div>

        {templatesQuery.isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {templates.map((template) => (
              <button
                key={template._id}
                onClick={() => setRequestedId(template._id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors",
                  template._id === selected?._id
                    ? "bg-accent"
                    : "hover:bg-accent/60"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {template.name}
                  </span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    .{template.fileExtension}
                  </span>
                </span>
                <Badge variant="outline">{template.fileType}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <QueryBoundary
          isLoading={templatesQuery.isLoading}
          error={templatesQuery.error}
          isEmpty={!selected}
          onRetry={templatesQuery.refetch}
          empty={
            <EmptyState
              icon={FileCode2Icon}
              title="No templates yet"
              body="A template describes how translations are written to, and read from, a file. Import and export both need one."
              action={
                canCreate ? (
                  <Button size="sm" onClick={() => setFormOpen(true)}>
                    <PlusIcon /> New template
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
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <Badge variant="outline">{selected.fileType}</Badge>
                    {isSystem ? (
                      <Badge variant="secondary">
                        <CircleDotIcon /> System
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selected.description ??
                      "How translations are written to, and read from, a file in this format."}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {canDelete && !isSystem ? (
                    <Button
                      variant="outline"
                      className="text-destructive"
                      aria-label="Delete template"
                      onClick={() => setPendingDelete(true)}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                  {editable ? (
                    <Button
                      onClick={save}
                      disabled={!isDirty || updateTemplate.isPending}
                    >
                      {updateTemplate.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {isSystem ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                  System templates are read-only. Create a new one to customise
                  the format.
                </div>
              ) : null}

              <TemplateEditor
                importConfig={draft.importConfig}
                exportConfig={draft.exportConfig}
                disabled={!editable}
                onImportChange={(importConfig) =>
                  setDraft((current) =>
                    current ? { ...current, importConfig } : current
                  )
                }
                onExportChange={(exportConfig) =>
                  setDraft((current) =>
                    current ? { ...current, exportConfig } : current
                  )
                }
              />
            </>
          ) : null}
        </QueryBoundary>
      </div>

      <TemplateFormDialog
        open={isFormOpen}
        onOpenChange={setFormOpen}
        onCreated={(template: Template) => setRequestedId(template._id)}
      />

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete ${selected?.name}?`}
        description="Applications bound to this template lose their export format and will need a new one before they can export again."
        confirmLabel="Delete template"
        destructive
        isPending={removeTemplate.isPending}
        onConfirm={deleteTemplate}
      />
    </div>
  )
}
