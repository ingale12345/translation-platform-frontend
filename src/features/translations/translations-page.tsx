import {
  DownloadIcon,
  InfoIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { Pagination } from "@/components/common/pagination"
import { SearchInput } from "@/components/common/search-input"
import { StatusChip } from "@/components/common/status-chip"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectField } from "@/components/common/select-field"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllApplications } from "@/features/applications/hooks"
import { ExportDialog } from "@/features/export-jobs/components/export-dialog"
import { useAllLanguages } from "@/features/languages/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import {
  useCommentCounts,
  useCoverage,
  useSetCellStatus,
  useSetCellValue,
  useTranslationGrid,
} from "@/features/translations/hooks"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import { TRANSLATION_STATUS_FLOW, statusMeta } from "@/lib/translation-status"
import type { Id } from "@/types/api"
import type { TranslationKey, TranslationStatus } from "@/types/models"
import { AddKeyDialog } from "./components/add-key-dialog"
import { BulkActionBar } from "./components/bulk-action-bar"
import { BulkStatusDialog } from "./components/bulk-status-dialog"
import { CellEditDialog } from "./components/cell-edit-dialog"
import { CellDrawer } from "./components/cell-drawer"
import type { CellDrawerMode } from "./components/cell-drawer"
import { TranslationCell } from "./components/translation-cell"

const PAGE_SIZE = 50

interface EditingCell {
  keyId: Id
  languageCode: string
}

/**
 * The translation grid — keys down the side, languages across the top.
 *
 * This is the screen the product lives in, so it optimises for scanning and inline
 * editing: the key column and header are sticky, every cell carries its status as a
 * coloured rail, and edits happen in place rather than in a dialog.
 */
export function TranslationsPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()

  const canEdit = can(ENTITLEMENTS.TRANSLATIONS, "update")
  const canApprove = can(ENTITLEMENTS.TRANSLATIONS, "approve")
  const canPublish = can(ENTITLEMENTS.TRANSLATIONS, "publish")
  const canCreate = can(ENTITLEMENTS.TRANSLATIONS, "create")
  const canComment = can(ENTITLEMENTS.TRANSLATION_COMMENTS, "create")
  const canImport = can(ENTITLEMENTS.IMPORT, "create")
  const canExport = can(ENTITLEMENTS.EXPORT, "download")
  // Cell history lives in `translation-history`, which the server guards with AUDIT_LOGS.
  // An external reviewer has comments but not the audit trail.
  const canViewHistory = can(ENTITLEMENTS.AUDIT_LOGS, "read")

  const applicationsQuery = useAllApplications(
    {
      where: { projectId: projectId ?? "", status: "active" },
      sortAsc: "name",
    },
    { enabled: Boolean(projectId) }
  )
  const applications = useMemo(
    () => applicationsQuery.data ?? [],
    [applicationsQuery.data]
  )

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | "ALL">(
    "ALL"
  )
  const [skip, setSkip] = useState(0)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [draft, setDraft] = useState("")
  const [drawer, setDrawer] = useState<{
    mode: CellDrawerMode
    cell: EditingCell
  } | null>(null)
  const [isAddKeyOpen, setAddKeyOpen] = useState(false)
  const [expanded, setExpanded] = useState<EditingCell | null>(null)
  const [isExportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<Set<Id>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<TranslationStatus | null>(null)

  // The selected application is *derived*: switching project replaces the list, and a
  // requested id that is no longer in it falls back to the first rather than leaving the
  // grid querying an application from the previous tenant.
  const [requestedApplicationId, setRequestedApplicationId] =
    useState<Id | null>(null)
  const application =
    applications.find((item) => item._id === requestedApplicationId) ??
    applications[0]
  const applicationId = application?._id ?? null

  /**
   * Any filter change invalidates the current offset — staying on page 4 of a new result
   * set shows an empty grid that reads as a failure. Reset during render rather than in
   * an effect, so the grid never issues a request for the stale offset first.
   */
  const filterKey = `${applicationId}|${search}|${statusFilter}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)

  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setSkip(0)
    // A selection is a set of ids from the previous result set. Carrying it across a
    // filter change would let a bulk action hit keys the user can no longer see.
    setSelected(new Set())
  }

  const gridQuery = useTranslationGrid({
    projectId,
    applicationId,
    search,
    limit: PAGE_SIZE,
    skip,
  })

  const languageCodes = useMemo(
    () => application?.supportedLanguages ?? [],
    [application]
  )

  const languagesQuery = useAllLanguages(
    { where: { code: { $in: languageCodes } }, sortAsc: "sortOrder" },
    { enabled: languageCodes.length > 0 }
  )
  const languageByCode = new Map(
    (languagesQuery.data ?? []).map((lang) => [lang.code, lang])
  )
  const languageNames = new Map(
    (languagesQuery.data ?? []).map((lang) => [lang.code, lang.name])
  )

  const rows = useMemo(() => gridQuery.data?.data ?? [], [gridQuery.data])

  /**
   * Status filtering is client-side: a key's status lives inside the nested `translations`
   * map, one entry per language, which Feathers query syntax cannot filter on. It
   * therefore narrows the *current page* — the toolbar says so, and the backend follow-up
   * is noted in docs/UI_PLAN.md.
   */
  const visibleRows = useMemo(() => {
    if (statusFilter === "ALL") {
      return rows
    }

    return rows.filter((row) =>
      Object.values(row.translations).some(
        (cell) => cell.status === statusFilter
      )
    )
  }, [rows, statusFilter])

  const coverage = useCoverage(rows, languageCodes)
  const commentCounts = useCommentCounts(
    useMemo(() => rows.map((row) => row._id), [rows])
  )

  const selectedIds = useMemo(() => Array.from(selected), [selected])
  const allOnPageSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selected.has(row._id))

  const toggleRow = (id: Id) =>
    setSelected((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })

  const toggleAllOnPage = () =>
    setSelected((current) =>
      // "Select all" means the rows actually on screen — including the client-side status
      // filter — so what gets ticked always matches what the user can see.
      current.size === visibleRows.length && visibleRows.length > 0
        ? new Set()
        : new Set(visibleRows.map((row) => row._id))
    )

  const setCellValue = useSetCellValue()
  const setCellStatus = useSetCellStatus()

  const startEdit = (row: TranslationKey, languageCode: string) => {
    if (!canEdit) {
      return
    }

    setEditing({ keyId: row._id, languageCode })
    setDraft(row.translations[languageCode]?.value ?? "")
  }

  const startExpandedEdit = (row: TranslationKey, languageCode: string) => {
    if (!canEdit) {
      return
    }

    // Close any inline editor first, so the same cell is not open in two places at once.
    setEditing(null)
    setExpanded({ keyId: row._id, languageCode })
  }

  const saveExpanded = (value: string) => {
    const row = rows.find((item) => item._id === expanded?.keyId)

    if (!row || !expanded) {
      return
    }

    setCellValue.mutate(
      { translationKey: row, languageCode: expanded.languageCode, value },
      {
        onSuccess: () => {
          toast.success("Translation saved")
          setExpanded(null)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const saveEdit = (row: TranslationKey, languageCode: string) => {
    if (row.translations[languageCode]?.value === draft) {
      setEditing(null)
      return
    }

    setCellValue.mutate(
      { translationKey: row, languageCode, value: draft },
      {
        onSuccess: () => {
          toast.success("Translation saved")
          setEditing(null)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const changeStatus = (
    row: TranslationKey,
    languageCode: string,
    status: TranslationStatus,
    verb: string
  ) => {
    setCellStatus.mutate(
      { translationKey: row, languageCode, status },
      {
        onSuccess: () => toast.success(verb),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const drawerRow = drawer
    ? rows.find((row) => row._id === drawer.cell.keyId)
    : undefined

  if (applicationsQuery.isLoading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          title="No applications yet"
          body="Translations belong to an application. Create one before adding keys."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-5 py-3">
        <SelectField
          className="w-56"
          value={applicationId}
          onChange={(value) => setRequestedApplicationId(value as Id)}
          placeholder="Application"
          options={applications.map((item) => ({
            value: item._id,
            label: item.name,
            hint: item.type,
          }))}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search keys…"
          className="w-64"
        />

        <SelectField
          className="w-44"
          value={statusFilter}
          onChange={(value) =>
            setStatusFilter(value as TranslationStatus | "ALL")
          }
          options={[
            { value: "ALL", label: "All statuses" },
            ...TRANSLATION_STATUS_FLOW.map((status) => ({
              value: status,
              label: statusMeta(status).label,
            })),
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          {canImport ? (
            <Button variant="outline" size="sm" disabled>
              <UploadIcon /> Import
            </Button>
          ) : null}
          {canExport ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              <DownloadIcon /> Export
            </Button>
          ) : null}
          {canCreate ? (
            <Button size="sm" onClick={() => setAddKeyOpen(true)}>
              <PlusIcon /> Add key
            </Button>
          ) : null}
        </div>
      </div>

      {!canEdit ? (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-5 py-2 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <InfoIcon className="size-3.5" />
          You have read-only access to translations in this project. Editing
          controls are hidden.
        </div>
      ) : null}

      {selected.size > 0 ? (
        <BulkActionBar
          selectedCount={selected.size}
          totalOnPage={visibleRows.length}
          canEdit={canEdit}
          canApprove={canApprove}
          canPublish={canPublish}
          onSelectAllOnPage={() =>
            setSelected(new Set(visibleRows.map((row) => row._id)))
          }
          onClear={() => setSelected(new Set())}
          onAction={setBulkStatus}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-b bg-muted/30 px-5 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">
          Coverage on this page
        </span>
        {languageCodes.map((code) => (
          <div key={code} className="flex items-center gap-2">
            <span className="w-6 font-mono text-[11px] text-muted-foreground">
              {code}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${coverage[code] ?? 0}%` }}
              />
            </div>
            <span className="w-8 text-[11px] text-muted-foreground tabular-nums">
              {coverage[code] ?? 0}%
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {gridQuery.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="h-16 w-56" />
                {languageCodes.map((code) => (
                  <Skeleton key={code} className="h-16 flex-1" />
                ))}
              </div>
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={SearchIcon}
              title="No keys match"
              body="Try clearing the search or status filter."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("")
                    setStatusFilter("ALL")
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  className="sticky left-0 z-30 border-r border-b bg-muted px-4 py-2.5 text-left"
                  style={{ minWidth: 260, width: 260 }}
                >
                  <div className="flex items-center gap-2.5">
                    {canEdit ? (
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleAllOnPage}
                        aria-label="Select all keys on this page"
                      />
                    ) : null}
                    <span className="text-xs font-semibold text-muted-foreground">
                      Key
                    </span>
                  </div>
                </th>
                {languageCodes.map((code) => {
                  const language = languageByCode.get(code)

                  return (
                    <th
                      key={code}
                      className="border-r border-b bg-muted px-4 py-2.5 text-left"
                      style={{ minWidth: 240 }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {language?.name ?? code}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {language?.nativeName ?? code}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row._id} className="group/row">
                  <td
                    className="sticky left-0 z-10 border-r border-b bg-background px-4 py-2.5 align-top group-hover/row:bg-muted/40"
                    style={{ minWidth: 260, width: 260 }}
                  >
                    <div className="flex gap-2.5">
                      {canEdit ? (
                        <Checkbox
                          className="mt-0.5"
                          checked={selected.has(row._id)}
                          onCheckedChange={() => toggleRow(row._id)}
                          aria-label={`Select ${row.key}`}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-mono text-[13px] font-medium">
                          {row.key}
                        </p>
                        {row.description ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {row.description}
                          </p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {row.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>

                  {languageCodes.map((code) => {
                    const isEditing =
                      editing?.keyId === row._id &&
                      editing?.languageCode === code

                    return (
                      <TranslationCell
                        key={code}
                        cell={row.translations[code]}
                        isEditing={isEditing}
                        draft={draft}
                        onDraftChange={setDraft}
                        canEdit={canEdit}
                        canApprove={canApprove}
                        canPublish={canPublish}
                        canComment={canComment}
                        canViewHistory={canViewHistory}
                        isSaving={setCellValue.isPending}
                        commentCount={
                          commentCounts.get(`${row._id}:${code}`) ?? 0
                        }
                        onEdit={() => startEdit(row, code)}
                        onExpand={() => startExpandedEdit(row, code)}
                        onSave={() => saveEdit(row, code)}
                        onCancel={() => setEditing(null)}
                        onApprove={() =>
                          changeStatus(row, code, "APPROVED", "Approved")
                        }
                        onPublish={() =>
                          changeStatus(row, code, "PUBLISHED", "Published")
                        }
                        onHistory={() =>
                          setDrawer({
                            mode: "history",
                            cell: { keyId: row._id, languageCode: code },
                          })
                        }
                        onComments={() =>
                          setDrawer({
                            mode: "comments",
                            cell: { keyId: row._id, languageCode: code },
                          })
                        }
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {gridQuery.data ? (
        <div className="flex items-center justify-between gap-4 border-t bg-card px-5">
          <Pagination
            total={gridQuery.data.total}
            limit={gridQuery.data.limit}
            skip={gridQuery.data.skip}
            onSkipChange={(next) => {
              setSkip(next)
              setSelected(new Set())
            }}
            className="flex-1"
          />
          {statusFilter !== "ALL" ? (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <StatusChip status={statusFilter} size="sm" /> filters this page
              only
            </span>
          ) : null}
        </div>
      ) : null}

      <AddKeyDialog
        open={isAddKeyOpen}
        onOpenChange={setAddKeyOpen}
        application={application}
        existingKeys={rows.map((row) => row.key)}
        languageLabels={languageNames}
      />

      <CellEditDialog
        open={Boolean(expanded)}
        onOpenChange={(open) => (open ? undefined : setExpanded(null))}
        translationKey={rows.find((row) => row._id === expanded?.keyId)}
        languageCode={expanded?.languageCode}
        languageName={
          expanded
            ? (languageNames.get(expanded.languageCode) ??
              expanded.languageCode)
            : undefined
        }
        sourceValue={
          expanded &&
          application &&
          expanded.languageCode !== application.defaultLanguage
            ? rows.find((row) => row._id === expanded.keyId)?.translations[
                application.defaultLanguage
              ]?.value
            : undefined
        }
        sourceLanguageName={
          application
            ? (languageNames.get(application.defaultLanguage) ??
              application.defaultLanguage)
            : undefined
        }
        isSaving={setCellValue.isPending}
        onSave={saveExpanded}
      />

      <CellDrawer
        mode={drawer?.mode ?? null}
        translationKey={drawerRow}
        languageCode={drawer?.cell.languageCode}
        languageName={
          drawer ? languageNames.get(drawer.cell.languageCode) : undefined
        }
        canComment={canComment}
        canViewHistory={canViewHistory}
        onModeChange={(mode) =>
          setDrawer((current) => (current ? { ...current, mode } : current))
        }
        onClose={() => setDrawer(null)}
      />

      <BulkStatusDialog
        open={Boolean(bulkStatus)}
        onOpenChange={(open) => (open ? undefined : setBulkStatus(null))}
        status={bulkStatus ?? "APPROVED"}
        projectId={projectId}
        applicationId={applicationId}
        translationKeyIds={selectedIds}
        languageCodes={languageCodes}
        languageLabels={languageNames}
        onDone={() => setSelected(new Set())}
      />

      <ExportDialog
        open={isExportOpen}
        onOpenChange={setExportOpen}
        defaultApplicationId={applicationId}
        languageLabels={languageNames}
      />
    </div>
  )
}
