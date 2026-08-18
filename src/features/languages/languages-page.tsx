import { LanguagesIcon, MinusIcon, PlusIcon, StarIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Can } from "@/components/common/can"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { SearchInput } from "@/components/common/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAllLanguages } from "@/features/languages/hooks"
import { useProject, useUpdateProject } from "@/features/projects/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { Language } from "@/types/models"
import { LanguageFormDialog } from "./components/language-form-dialog"

/**
 * Language management, in two halves.
 *
 * Languages are a **global catalogue**; a project enables a subset. So "enable a language"
 * is a `PATCH /projects/:id` against `supportedLanguages`, not a write to `languages` —
 * getting that backwards would let one project's choice change every other project's.
 */
export function LanguagesPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canUpdateProject = can(ENTITLEMENTS.PROJECTS, "update")

  const languagesQuery = useAllLanguages({ sortAsc: "sortOrder" })
  const projectQuery = useProject(projectId ?? undefined)
  const updateProject = useUpdateProject()

  const [search, setSearch] = useState("")
  const [isFormOpen, setFormOpen] = useState(false)
  const [pendingDisable, setPendingDisable] = useState<Language | null>(null)

  const project = projectQuery.data
  const enabledCodes = useMemo(
    () => project?.supportedLanguages ?? [],
    [project]
  )
  const defaultCode = project?.defaultLanguage

  const { enabled, available } = useMemo(() => {
    const all = languagesQuery.data ?? []
    const term = search.trim().toLowerCase()

    const matches = (language: Language) =>
      !term ||
      language.name.toLowerCase().includes(term) ||
      language.nativeName.toLowerCase().includes(term) ||
      language.code.toLowerCase().includes(term)

    return {
      enabled: all.filter(
        (language) => enabledCodes.includes(language.code) && matches(language)
      ),
      available: all.filter(
        (language) => !enabledCodes.includes(language.code) && matches(language)
      ),
    }
  }, [languagesQuery.data, enabledCodes, search])

  const setSupported = (codes: string[], message: string) => {
    if (!project) {
      return
    }

    updateProject.mutate(
      { id: project._id, data: { supportedLanguages: codes } },
      {
        onSuccess: () => {
          toast.success(message)
          setPendingDisable(null)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const enable = (language: Language) =>
    setSupported([...enabledCodes, language.code], `${language.name} enabled`)

  const disable = (language: Language) =>
    setSupported(
      enabledCodes.filter((code) => code !== language.code),
      `${language.name} disabled`
    )

  const makeDefault = (language: Language) => {
    if (!project) {
      return
    }

    updateProject.mutate(
      { id: project._id, data: { defaultLanguage: language.code } },
      {
        onSuccess: () =>
          toast.success(`${language.name} is now the source language`),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const baseColumns: DataTableColumn<Language>[] = [
    {
      id: "language",
      header: "Language",
      cell: (language) => (
        <div>
          <p className="text-sm font-medium">
            {language.name}
            {language.code === defaultCode ? (
              <Badge variant="secondary" className="ml-2">
                <StarIcon /> Source
              </Badge>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{language.nativeName}</p>
        </div>
      ),
    },
    {
      id: "code",
      header: "Code",
      cell: (language) => (
        <span className="font-mono text-xs">{language.code}</span>
      ),
    },
    {
      id: "locale",
      header: "Locale",
      cell: (language) => (
        <span className="font-mono text-xs">{language.locale}</span>
      ),
    },
    {
      id: "rtl",
      header: "Direction",
      cell: (language) => (
        <span className="text-xs text-muted-foreground">
          {language.rtl ? "RTL" : "LTR"}
        </span>
      ),
    },
  ]

  const enabledColumns: DataTableColumn<Language>[] = [
    ...baseColumns,
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (language) =>
        canUpdateProject ? (
          <div className="flex items-center justify-end gap-1">
            {language.code === defaultCode ? null : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => makeDefault(language)}
                >
                  <StarIcon /> Make source
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setPendingDisable(language)}
                >
                  <MinusIcon /> Disable
                </Button>
              </>
            )}
          </div>
        ) : null,
    },
  ]

  const availableColumns: DataTableColumn<Language>[] = [
    ...baseColumns,
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (language) =>
        canUpdateProject ? (
          <Button variant="outline" size="sm" onClick={() => enable(language)}>
            <PlusIcon /> Enable
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="p-5">
      <PageHeader
        title="Languages"
        description="Languages are global. Each project enables the subset it translates into."
        actions={
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search languages…"
              className="w-56"
            />
            <Can entitlement={ENTITLEMENTS.LANGUAGES} action="create">
              <Button onClick={() => setFormOpen(true)}>
                <PlusIcon /> Add to catalogue
              </Button>
            </Can>
          </div>
        }
      />

      <section className="mb-8">
        <h3 className="mb-2 text-sm font-semibold">
          Enabled in this project
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({enabled.length})
          </span>
        </h3>
        <DataTable
          columns={enabledColumns}
          rows={enabled}
          rowKey={(language) => language._id}
          isLoading={languagesQuery.isLoading || projectQuery.isLoading}
          error={languagesQuery.error ?? projectQuery.error}
          empty={
            <EmptyState
              icon={LanguagesIcon}
              title={
                search ? "No enabled language matches" : "No languages enabled"
              }
              body={
                search
                  ? "Try a different search term."
                  : "Enable one from the catalogue below before adding translations."
              }
            />
          }
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Available in the catalogue
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({available.length})
          </span>
        </h3>
        <DataTable
          columns={availableColumns}
          rows={available}
          rowKey={(language) => language._id}
          isLoading={languagesQuery.isLoading}
          error={languagesQuery.error}
          empty={
            <EmptyState
              icon={LanguagesIcon}
              title={
                search
                  ? "No catalogue language matches"
                  : "Every language is enabled"
              }
              body={
                search
                  ? "Try a different search term."
                  : "Add a new language to the catalogue to enable more."
              }
            />
          }
        />
      </section>

      <LanguageFormDialog open={isFormOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={Boolean(pendingDisable)}
        onOpenChange={(open) => (open ? undefined : setPendingDisable(null))}
        title={`Disable ${pendingDisable?.name}?`}
        description="Existing translations in this language are kept, but the column disappears from the grid and the language stops being exported."
        confirmLabel="Disable"
        destructive
        isPending={updateProject.isPending}
        onConfirm={() => pendingDisable && disable(pendingDisable)}
      />
    </div>
  )
}
