import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UploadIcon,
} from "lucide-react"
import { useState } from "react"

import { AppLink } from "@/components/common/app-link"
import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { useAllApplications } from "@/features/applications/hooks"
import { ImportDialog } from "@/features/import-jobs/components/import-dialog"
import { useImportJobs } from "@/features/import-jobs/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { formatDateTime, formatRelative } from "@/lib/format"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { Id } from "@/types/api"
import type { ImportJob } from "@/types/models"
import { JobStatusBadge } from "./components/job-status-badge"

/**
 * The import runner, and the log of what previous runs did.
 *
 * There is no queue behind this. `POST /translations/import` parses and reconciles
 * synchronously and returns the result, so a run has either succeeded or failed by the
 * time the dialog closes — nothing waits for a worker that would have to exist.
 *
 * An import changes the **working set** and nothing else. It does not cut a release and
 * does not touch what any application is being served: keys appear, keys stop being
 * referenced, and the strings people work on move accordingly. Turning that into something
 * users see takes two further deliberate steps, both on the Versions page — freeze a
 * version, then publish it.
 */
export function ImportPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canCreate = can(ENTITLEMENTS.IMPORT, "create")
  const canSeeVersions = can(ENTITLEMENTS.TRANSLATIONS, "read")

  const [isDialogOpen, setDialogOpen] = useState(false)
  const [expanded, setExpanded] = useState<Id | null>(null)

  const jobsQuery = useImportJobs(
    { where: { projectId: projectId ?? "" }, sortDesc: "createdAt", limit: 50 },
    { enabled: Boolean(projectId) }
  )
  const applicationsQuery = useAllApplications(
    { where: { projectId: projectId ?? "" } },
    { enabled: Boolean(projectId) }
  )
  const applicationName = new Map(
    (applicationsQuery.data ?? []).map((application) => [
      application._id,
      application.name,
    ])
  )

  const jobs = jobsQuery.data?.data ?? []

  const columns: DataTableColumn<ImportJob>[] = [
    {
      id: "file",
      header: "File",
      cell: (job) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-medium">
            {job.fileName}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {applicationName.get(job.applicationId) ?? "unknown"} ·{" "}
            {job.languageCode}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "w-28",
      cell: (job) => <JobStatusBadge status={job.status} />,
    },
    {
      id: "results",
      header: "Results",
      cell: (job) => (
        <div className="flex flex-wrap gap-2 text-[11px] tabular-nums">
          <Stat
            label="new"
            value={job.statistics?.added}
            tone="text-emerald-600"
          />
          <Stat
            label="changed"
            value={job.statistics?.updated}
            tone="text-sky-600"
          />
          <Stat
            label="restored"
            value={job.statistics?.restored}
            tone="text-violet-600"
          />
          <Stat
            label="disabled"
            value={job.statistics?.disabled}
            tone="text-destructive"
          />
          <Stat
            label="unreadable"
            value={job.statistics?.failed}
            tone="text-destructive"
          />
          {!job.statistics?.added &&
          !job.statistics?.updated &&
          !job.statistics?.restored &&
          !job.statistics?.disabled ? (
            <span className="text-muted-foreground">no change</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "when",
      header: "Imported",
      cell: (job) => (
        <span
          className="text-xs text-muted-foreground"
          title={formatDateTime(job.startedAt)}
        >
          {job.startedAt ? formatRelative(job.startedAt) : "—"}
        </span>
      ),
    },
    {
      id: "errors",
      header: "",
      align: "right",
      cell: (job) =>
        job.errors?.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(expanded === job._id ? null : job._id)}
            aria-expanded={expanded === job._id}
          >
            {job.errors.length} skipped
            {expanded === job._id ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </Button>
        ) : null,
    },
  ]

  const expandedJob = jobs.find((job) => job._id === expanded)

  return (
    <div className="p-5">
      <PageHeader
        title="Import"
        description="A file describes what the code contains now. Importing reconciles the working set against it — it does not release anything."
        actions={
          canCreate ? (
            <Button onClick={() => setDialogOpen(true)}>
              <UploadIcon /> New import
            </Button>
          ) : null
        }
      />

      {jobs.length > 0 && canSeeVersions ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Imported changes are visible in Translations, but not to your
            applications. Freeze a version and publish it to ship them.
          </p>
          <AppLink
            to="/versions"
            className="ms-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Go to Versions <ArrowRightIcon className="size-3.5" />
          </AppLink>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={jobs}
        rowKey={(job) => job._id}
        isLoading={jobsQuery.isLoading}
        error={jobsQuery.error}
        empty={
          <EmptyState
            icon={UploadIcon}
            title="No imports yet"
            body={
              canCreate
                ? "Import a JSON, ARB, .properties or CSV file to bring an application's keys in from the code."
                : "Import runs and what each one changed will be listed here."
            }
          />
        }
      />

      {expandedJob?.errors?.length ? (
        <div className="mt-3 rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-sm font-medium">
            Lines skipped in {expandedJob.fileName}
          </p>
          <ol className="space-y-1.5">
            {expandedJob.errors.map((error, index) => (
              <li key={index} className="flex gap-2 text-xs">
                {error.line !== undefined ? (
                  <span className="w-12 shrink-0 font-mono text-muted-foreground">
                    L{error.line}
                  </span>
                ) : null}
                {error.key ? (
                  <span className="shrink-0 font-mono">{error.key}</span>
                ) : null}
                <span className="text-muted-foreground">{error.message}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <ImportDialog open={isDialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value?: number
  tone?: string
}) {
  if (!value) {
    return null
  }

  return (
    <span className={tone ?? "text-muted-foreground"}>
      {value} {label}
    </span>
  )
}
