import { ChevronDownIcon, ChevronRightIcon, ScrollTextIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { QueryBoundary } from "@/components/common/query-boundary"
import { SearchInput } from "@/components/common/search-input"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/common/select-field"
import { useInfiniteActivityLogs } from "@/features/activity-logs/hooks"
import { useActiveProjectId, useMemberships } from "@/features/session/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { contains } from "@/lib/http/params"
import { formatDateTime, formatRelative, fullName } from "@/lib/format"
import type { Id } from "@/types/api"
import type { ActivityLog, User } from "@/types/models"

const PAGE_SIZE = 30

/** The entity types the platform writes logs for, for the filter. */
const ENTITY_TYPES = [
  "translation-keys",
  "project-members",
  "roles",
  "applications",
  "languages",
  "templates",
  "api-tokens",
  "projects",
]

/**
 * The audit trail.
 *
 * Scope defaults to **everything the reader may see**, not to the active project. A
 * platform admin's question is "what happened in this organization", and pinning the query
 * to the switcher hid two whole classes of entry from them: events above any project (a
 * sign-in, a project being created) and events in the other projects they administer. The
 * server narrows an unscoped request to the caller's own reach — organization-wide for an
 * admin, their own projects for a manager — so asking widely is safe. See
 * docs/RBAC.md § "Scoping a `find` that names no project".
 *
 * Infinite scroll rather than pages: an audit log is read by scanning backwards from now,
 * and a reader who has to click "next" loses their place every time a new entry arrives
 * at the top.
 */
export function AuditPage() {
  const activeProjectId = useActiveProjectId()
  const membershipsQuery = useMemberships()

  const [search, setSearch] = useState("")
  const [entityType, setEntityType] = useState<string>("ALL")
  const [scope, setScope] = useState<string>("ALL")
  const [expanded, setExpanded] = useState<Id | null>(null)

  const projectOptions = useMemo(
    () => [
      { value: "ALL", label: "Everything I can see" },
      ...(membershipsQuery.data ?? []).map((membership) => ({
        value: membership.projectId,
        label:
          membership.project?.name ??
          (membership.projectId === activeProjectId ? "This project" : "Project"),
      })),
    ],
    [membershipsQuery.data, activeProjectId]
  )

  const query = useMemo(() => {
    const where: Record<string, unknown> = {}

    if (scope !== "ALL") {
      where.projectId = scope
    }

    if (entityType !== "ALL") {
      where.entityType = entityType
    }

    if (search.trim()) {
      where.action = contains(search)
    }

    return {
      where,
      sortDesc: "createdAt" as const,
      limit: PAGE_SIZE,
      // Without this the request still carries `X-Project-Id` from the switcher, and the
      // server reads it as the answer — so "everything I can see" quietly became "the
      // active project", hiding sign-ins and every other project's entries.
      unscoped: scope === "ALL",
    }
  }, [scope, entityType, search])

  const logsQuery = useInfiniteActivityLogs(query)

  const entries = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [logsQuery.data]
  )

  const userIds = [...new Set(entries.map((entry) => entry.userId))]
  const usersQuery = useAllUsers(
    { where: { _id: { $in: userIds } } },
    { enabled: userIds.length > 0 }
  )
  const userById = new Map(
    (usersQuery.data ?? []).map((user) => [user._id, user])
  )

  return (
    <div className="p-5">
      <PageHeader
        title="Audit Log"
        description="Every change you have visibility of, newest first."
        actions={
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search actions…"
              className="w-56"
            />
            <SelectField
              className="w-52"
              value={scope}
              onChange={setScope}
              options={projectOptions}
            />
            <SelectField
              className="w-48"
              value={entityType}
              onChange={setEntityType}
              options={[
                { value: "ALL", label: "All entity types" },
                ...ENTITY_TYPES.map((type) => ({ value: type, label: type })),
              ]}
            />
          </div>
        }
      />

      <QueryBoundary
        isLoading={logsQuery.isLoading}
        error={logsQuery.error}
        isEmpty={entries.length === 0}
        onRetry={logsQuery.refetch}
        empty={
          <EmptyState
            icon={ScrollTextIcon}
            title={
              search || entityType !== "ALL" || scope !== "ALL"
                ? "No matching activity"
                : "No activity yet"
            }
            body={
              search || entityType !== "ALL"
                ? "Try clearing the filters."
                : "Changes to keys, members, roles and settings will appear here as they happen."
            }
          />
        }
      >
        <ol className="overflow-hidden rounded-lg border">
          {entries.map((entry) => (
            <AuditRow
              key={entry._id}
              entry={entry}
              actor={userById.get(entry.userId)}
              isExpanded={expanded === entry._id}
              onToggle={() =>
                setExpanded(expanded === entry._id ? null : entry._id)
              }
            />
          ))}
        </ol>

        {logsQuery.hasNextPage ? (
          <div className="mt-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => logsQuery.fetchNextPage()}
              disabled={logsQuery.isFetchingNextPage}
            >
              {logsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </QueryBoundary>
    </div>
  )
}

function AuditRow({
  entry,
  actor,
  isExpanded,
  onToggle,
}: {
  entry: ActivityLog
  /** Absent when the actor's account has since been removed. */
  actor: User | undefined
  isExpanded: boolean
  onToggle: () => void
}) {
  // Only offer the expander when there is something behind it — a chevron that reveals
  // nothing trains people to stop clicking it.
  const hasDetail = Boolean(entry.oldValue || entry.newValue || entry.metadata)

  return (
    <li className="border-b last:border-0">
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40">
        <UserAvatar user={actor} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{fullName(actor)}</span>{" "}
            <span className="text-muted-foreground">
              {entry.description ?? entry.action}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{entry.entityType}</Badge>
            <span className="font-mono text-[10px] text-muted-foreground">
              {entry.action}
            </span>
            <span
              className="text-[11px] text-muted-foreground"
              title={formatDateTime(entry.createdAt)}
            >
              {formatRelative(entry.createdAt)}
            </span>
          </div>
        </div>

        {hasDetail ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </Button>
        ) : null}
      </div>

      {isExpanded && hasDetail ? (
        <div className="grid gap-3 border-t bg-muted/30 px-4 py-3 sm:grid-cols-2">
          {/*
            An operation entry — a bulk run, an export — carries no before/after, only
            `metadata`. Showing just the two value blocks left its chevron opening onto
            two empty dashes.
          */}
          {entry.metadata ? (
            <div className="sm:col-span-2">
              <ValueBlock label="Details" value={entry.metadata} />
            </div>
          ) : null}
          {entry.oldValue || entry.newValue ? (
            <>
              <ValueBlock label="Before" value={entry.oldValue} />
              <ValueBlock label="After" value={entry.newValue} />
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function ValueBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) {
    return (
      <div>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          {label}
        </p>
        <p className="text-xs text-muted-foreground italic">—</p>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
      <pre className="max-h-40 overflow-auto rounded border bg-background p-2 font-mono text-[11px]">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
