import {
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
  UploadIcon,
} from "lucide-react"
import { useState } from "react"

import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useAllApplications } from "@/features/applications/hooks"
import { useImportJobs } from "@/features/import-jobs/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { formatDateTime, formatRelative } from "@/lib/format"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { Id } from "@/types/api"
import type { ImportJob } from "@/types/models"
import { JobStatusBadge } from "./components/job-status-badge"

/**
 * Import job history.
 *
 * The upload wizard is not here yet, and starting a job would be dishonest without it:
 * `POST /import-jobs` records a job, but nothing transfers the file or parses it, so
 * every job created from the console would sit at QUEUED forever. What the wizard needs
 * is item 7 in docs/UI_PLAN.md §5.
 */
export function ImportPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canCreate = can(ENTITLEMENTS.IMPORT, "create")

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

  const columns: DataTableColumn<ImportJob>[] = [
    {
      id: "file",
      header: "File",
      cell: (job) => (
        <div>
          <p className="font-mono text-xs font-medium">{job.fileName}</p>
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
      cell: (job) => <JobStatusBadge status={job.status} />,
    },
    {
      id: "results",
      header: "Results",
      cell: (job) => (
        <div className="flex flex-wrap gap-2 text-[11px] tabular-nums">
          <Stat
            label="added"
            value={job.statistics?.added}
            tone="text-emerald-600"
          />
          <Stat
            label="updated"
            value={job.statistics?.updated}
            tone="text-sky-600"
          />
          <Stat label="skipped" value={job.statistics?.skipped} />
          <Stat
            label="failed"
            value={job.statistics?.failed}
            tone="text-destructive"
          />
        </div>
      ),
    },
    {
      id: "when",
      header: "Started",
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
            {job.errors.length} error{job.errors.length === 1 ? "" : "s"}
            {expanded === job._id ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </Button>
        ) : null,
    },
  ]

  const expandedJob = jobsQuery.data?.data.find((job) => job._id === expanded)

  return (
    <div className="p-5">
      <PageHeader
        title="Import"
        description="Bring translations in from a file, and review what each run changed."
        actions={
          canCreate ? (
            <Button disabled>
              <UploadIcon /> New import
            </Button>
          ) : null
        }
      />

      {canCreate ? (
        <Alert className="mb-4">
          <InfoIcon />
          <AlertDescription>
            The upload wizard is not built yet. The API records import jobs but
            has no endpoint to receive a file or parse it, so a job started here
            would never leave the queue.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        rows={jobsQuery.data?.data ?? []}
        rowKey={(job) => job._id}
        isLoading={jobsQuery.isLoading}
        error={jobsQuery.error}
        empty={
          <EmptyState
            icon={UploadIcon}
            title="No imports yet"
            body="Import runs and their per-row results will be listed here."
          />
        }
      />

      {expandedJob?.errors?.length ? (
        <div className="mt-3 rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-sm font-medium">
            Errors in {expandedJob.fileName}
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
