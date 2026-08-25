import { CircleDotIcon, HistoryIcon, RocketIcon, ScissorsIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { DataTable } from "@/components/common/data-table"
import type { DataTableColumn } from "@/components/common/data-table"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { SelectField } from "@/components/common/select-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAllApplications } from "@/features/applications/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { CutVersionDialog } from "@/features/translation-versions/components/cut-version-dialog"
import { PublishVersionDialog } from "@/features/translation-versions/components/publish-version-dialog"
import { useTranslationVersions } from "@/features/translation-versions/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { formatDateTime, formatRelative, fullName } from "@/lib/format"
import { ENTITLEMENTS } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type { TranslationVersion, User, VersionStatus } from "@/types/models"

/**
 * What each application ships, and the two steps that change it.
 *
 * The platform's central distinction lives on this page. Importing changes the working
 * set. **Freezing** turns the working set into a numbered release. **Publishing** points
 * production at one. Three separate acts, because they are three separate decisions made
 * at different times by often different people — a developer imports, a translator
 * translates, a reviewer decides the result is a release and that it is time to ship.
 *
 * Which version is live is called out in a banner rather than left to be inferred from a
 * status column, because it is the one fact on the page that has consequences.
 *
 * Versions are per application, not per project, so the page insists on one being picked.
 * A merged list would put two applications' "version 3" next to each other, and those are
 * unrelated numbers.
 */
export function VersionsPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  // One permission covers both actions: deciding what a release contains is the same
  // authority as deciding when it ships. The API guards `create` and `patch` alike.
  const canRelease = can(ENTITLEMENTS.TRANSLATIONS, "publish")

  const [applicationId, setApplicationId] = useState<Id | null>(null)
  const [publishing, setPublishing] = useState<TranslationVersion | null>(null)
  const [isCutting, setCutting] = useState(false)

  const applicationsQuery = useAllApplications(
    { where: { projectId: projectId ?? "" }, sortAsc: "name" },
    { enabled: Boolean(projectId) }
  )
  const applications = useMemo(
    () => applicationsQuery.data ?? [],
    [applicationsQuery.data]
  )

  /**
   * Which application to show before the user picks one.
   *
   * Alphabetical order lands on whichever application sorts first, which is usually one
   * nobody has ever released. That matters because the Import page links here — arriving
   * at an empty table for an unrelated application makes that link a dead end. The most
   * recently released application is what the person following it came to see.
   */
  const recentQuery = useTranslationVersions(
    { where: { projectId: projectId ?? "" }, sortDesc: "createdAt", limit: 1 },
    { enabled: Boolean(projectId) && !applicationId }
  )
  const mostRecent = recentQuery.data?.data[0]?.applicationId ?? null
  const isResolvingDefault = !applicationId && recentQuery.isLoading

  const application =
    applications.find((item) => item._id === applicationId) ??
    applications.find((item) => item._id === mostRecent) ??
    applications[0]

  const versionsQuery = useTranslationVersions(
    {
      where: { applicationId: application?._id ?? "" },
      sortDesc: "version",
      limit: 100,
    },
    { enabled: Boolean(application) && !isResolvingDefault }
  )

  const versions = versionsQuery.data?.data ?? []

  // One request for everyone named on the page, rather than a lookup per row.
  const userIds = [
    ...new Set(
      versions
        .flatMap((version) => [version.createdBy, version.publishedBy])
        .filter((id): id is Id => Boolean(id))
    ),
  ]
  const usersQuery = useAllUsers(
    { where: { _id: { $in: userIds } } },
    { enabled: userIds.length > 0 }
  )
  const userById = new Map(
    (usersQuery.data ?? []).map((user) => [user._id, user])
  )

  const published = versions.find((item) => item.status === "PUBLISHED") ?? null
  const latest = versions[0] ?? null
  const unpublishedCount = published
    ? versions.filter((item) => item.version > published.version).length
    : versions.length

  const columns: DataTableColumn<TranslationVersion>[] = [
    {
      id: "version",
      header: "Version",
      className: "w-32",
      cell: (version) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">v{version.version}</span>
          <VersionBadge status={version.status} />
        </div>
      ),
    },
    {
      id: "contents",
      header: "Contents",
      cell: (version) => (
        <div className="min-w-0">
          <p className="flex items-baseline gap-2 text-xs">
            <span className="font-medium tabular-nums">
              {version.statistics.total} keys
            </span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                version.statistics.ready < version.statistics.total
                  ? "text-amber-600"
                  : "text-emerald-600"
              )}
            >
              {version.statistics.ready} signed off
            </span>
          </p>
          {version.note ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {version.note}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "changes",
      header: "Since previous",
      cell: (version) => (
        <div className="flex flex-wrap gap-2 text-[11px] tabular-nums">
          <Stat
            label="added"
            value={version.statistics.added}
            tone="text-emerald-600"
          />
          <Stat
            label="restored"
            value={version.statistics.restored}
            tone="text-violet-600"
          />
          <Stat
            label="dropped"
            value={version.statistics.disabled}
            tone="text-destructive"
          />
          {version.statistics.added === 0 &&
          version.statistics.restored === 0 &&
          version.statistics.disabled === 0 ? (
            <span className="text-muted-foreground">no change</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "who",
      header: "Frozen",
      cell: (version) => (
        <div className="text-xs">
          <p title={formatDateTime(version.createdAt)}>
            {formatRelative(version.createdAt)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {fullName(
              version.createdBy ? userById.get(version.createdBy) : undefined
            )}
          </p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      className: "w-36",
      cell: (version) =>
        canRelease && version.status !== "PUBLISHED" ? (
          <Button
            variant={version.status === "DRAFT" ? "default" : "outline"}
            size="sm"
            onClick={() => setPublishing(version)}
          >
            <RocketIcon />
            {published && version.version < published.version
              ? "Roll back"
              : "Publish"}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="p-5">
      <PageHeader
        title="Versions"
        description="Freezing turns the current strings into a numbered release. Publishing one is what your applications start receiving."
        actions={
          <div className="flex items-center gap-2">
            {applications.length > 1 ? (
              <div className="w-52">
                <SelectField
                  value={application?._id ?? null}
                  onChange={(value) => setApplicationId(value as Id)}
                  placeholder="Application"
                  options={applications.map((item) => ({
                    value: item._id,
                    label: item.name,
                    hint: item.type,
                  }))}
                />
              </div>
            ) : null}
            {canRelease ? (
              <Button onClick={() => setCutting(true)} disabled={!application}>
                <ScissorsIcon /> Freeze version
              </Button>
            ) : null}
          </div>
        }
      />

      {application ? (
        <LiveBanner
          applicationName={application.name}
          published={published}
          publisher={
            published?.publishedBy
              ? userById.get(published.publishedBy)
              : undefined
          }
          hasVersions={versions.length > 0}
          unpublishedCount={unpublishedCount}
          isLoading={versionsQuery.isLoading || isResolvingDefault}
        />
      ) : null}

      <DataTable
        columns={columns}
        rows={versions}
        rowKey={(version) => version._id}
        isLoading={
          applicationsQuery.isLoading ||
          isResolvingDefault ||
          versionsQuery.isLoading
        }
        error={versionsQuery.error}
        empty={
          <EmptyState
            icon={HistoryIcon}
            title="No versions yet"
            body={
              canRelease
                ? "Freeze a version to record which keys belong to this release. Until then this application delivers whatever is currently active."
                : "Releases will be listed here once someone freezes one."
            }
          />
        }
      />

      <CutVersionDialog
        open={isCutting}
        onOpenChange={setCutting}
        application={application}
        published={published}
        latest={latest}
      />

      <PublishVersionDialog
        version={publishing}
        current={published}
        applicationName={application?.name ?? ""}
        onOpenChange={(open) => (open ? undefined : setPublishing(null))}
      />
    </div>
  )
}

/**
 * What is live, stated plainly.
 *
 * "Nothing published" is a real and important state rather than an empty one: with no
 * published version the platform delivers every active key, so the application behaves as
 * if versioning were off. Somebody looking at a list of frozen versions needs to know that
 * none of them is doing anything yet.
 */
function LiveBanner({
  applicationName,
  published,
  publisher,
  hasVersions,
  unpublishedCount,
  isLoading,
}: {
  applicationName: string
  published: TranslationVersion | null
  /** Absent when the account that published has since been removed. */
  publisher: User | undefined
  hasVersions: boolean
  unpublishedCount: number
  isLoading: boolean
}) {
  if (isLoading || !hasVersions) {
    return null
  }

  if (!published) {
    return (
      <Alert className="mb-4">
        <CircleDotIcon className="size-4" />
        <AlertDescription>
          Nothing is published for {applicationName}, so exports and the runtime
          API deliver every active key regardless of version. Publish one to
          start controlling what ships.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        <p className="text-sm">
          <strong>Version {published.version}</strong> is live for{" "}
          {applicationName}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        published {formatRelative(published.publishedAt ?? published.updatedAt)}
        {publisher ? <> by {fullName(publisher)}</> : null}
      </p>
      {unpublishedCount > 0 ? (
        <Badge variant="outline" className="ms-auto">
          {unpublishedCount} newer version
          {unpublishedCount === 1 ? "" : "s"} not shipped
        </Badge>
      ) : null}
    </div>
  )
}

const VERSION_BADGE: Record<
  VersionStatus,
  { label: string; className: string }
> = {
  PUBLISHED: {
    label: "live",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  DRAFT: {
    label: "frozen",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  SUPERSEDED: {
    label: "superseded",
    className: "bg-muted text-muted-foreground",
  },
}

function VersionBadge({ status }: { status: VersionStatus }) {
  const { label, className } = VERSION_BADGE[status]

  return <Badge className={cn("border-transparent", className)}>{label}</Badge>
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
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
