import { DownloadIcon, InfoIcon } from "lucide-react"

import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useAllApplications } from "@/features/applications/hooks"
import { useExportJobs } from "@/features/export-jobs/hooks"
import { JobStatusBadge } from "@/features/import-jobs/components/job-status-badge"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { formatDateTime, formatRelative } from "@/lib/format"
import { ENTITLEMENTS } from "@/lib/rbac"
import type { ExportJob } from "@/types/models"

/**
 * Export job history.
 *
 * Like Import, starting a job is withheld: `POST /export-jobs` records one, but no worker
 * renders the file, so the download would never appear. Item 6 in docs/UI_PLAN.md §5.
 *
 * When it does land, the finished file must be served from an authenticated endpoint
 * rather than a plain link — an export bundle is project content, not a public asset.
 */
export function ExportPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canCreate = can(ENTITLEMENTS.EXPORT, "download")

  const jobsQuery = useExportJobs(
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

  const columns: DataTableColumn<ExportJob>[] = [
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
      id: "contents",
      header: "Contents",
      cell: (job) => (
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground tabular-nums">
          {job.statistics ? (
            <>
              <span>{job.statistics.total} keys</span>
              <span className="text-emerald-600">
                {job.statistics.published} published
              </span>
              {job.statistics.missing > 0 ? (
                <span className="text-amber-600">
                  {job.statistics.missing} missing
                </span>
              ) : null}
            </>
          ) : (
            "—"
          )}
        </div>
      ),
    },
    {
      id: "when",
      header: "Generated",
      cell: (job) => (
        <span
          className="text-xs text-muted-foreground"
          title={formatDateTime(job.completedAt)}
        >
          {job.completedAt ? formatRelative(job.completedAt) : "—"}
        </span>
      ),
    },
    {
      id: "error",
      header: "",
      align: "right",
      cell: (job) =>
        job.error ? (
          <span className="text-xs text-destructive" title={job.error}>
            failed
          </span>
        ) : null,
    },
  ]

  return (
    <div className="p-5">
      <PageHeader
        title="Export"
        description="Generate translation bundles in an application's configured format."
        actions={
          canCreate ? (
            <Button disabled>
              <DownloadIcon /> New export
            </Button>
          ) : null
        }
      />

      {canCreate ? (
        <Alert className="mb-4">
          <InfoIcon />
          <AlertDescription>
            Starting an export is not available yet. The API records export jobs
            but nothing renders the file, so a job started here would never
            produce a download.
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
            icon={DownloadIcon}
            title="No exports yet"
            body="Generated bundles and their download links will be listed here."
          />
        }
      />
    </div>
  )
}
