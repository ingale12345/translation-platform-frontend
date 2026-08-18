import {
  BoxesIcon,
  ClockIcon,
  LanguagesIcon,
  ScrollTextIcon,
  Table2Icon,
} from "lucide-react"
import { useMemo } from "react"

import { AppLink } from "@/components/common/app-link"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { StatusChip } from "@/components/common/status-chip"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivityLogs } from "@/features/activity-logs/hooks"
import { useAllApplications } from "@/features/applications/hooks"
import { useAllLanguages } from "@/features/languages/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { useTranslationKeysQuery } from "@/features/translations/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { formatNumber, formatRelative, fullName } from "@/lib/format"
import { ENTITLEMENTS } from "@/lib/rbac"
import { TRANSLATION_STATUS_FLOW, statusMeta } from "@/lib/translation-status"
import { cn } from "@/lib/utils"
import type { TranslationStatus } from "@/types/models"

/**
 * How many keys the status roll-up reads.
 *
 * Status lives inside each key's nested `translations` map, which Feathers cannot
 * aggregate over, so the numbers below are computed client-side from a sample. The cards
 * say so rather than presenting a sample as a project total — a dashboard that quietly
 * rounds down is worse than one that admits its scope. A server-side aggregate is item 4
 * in docs/UI_PLAN.md §5.
 */
const SAMPLE_SIZE = 500

export function DashboardPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()

  const keysQuery = useTranslationKeysQuery(
    { where: { projectId: projectId ?? "" }, limit: SAMPLE_SIZE },
    { enabled: Boolean(projectId) && can(ENTITLEMENTS.TRANSLATIONS, "read") }
  )
  const applicationsQuery = useAllApplications(
    { where: { projectId: projectId ?? "", status: "active" } },
    { enabled: Boolean(projectId) && can(ENTITLEMENTS.APPLICATIONS, "read") }
  )
  const languagesQuery = useAllLanguages({ sortAsc: "sortOrder" })
  const activityQuery = useActivityLogs(
    { where: { projectId: projectId ?? "" }, sortDesc: "createdAt", limit: 8 },
    { enabled: Boolean(projectId) && can(ENTITLEMENTS.AUDIT_LOGS, "read") }
  )

  const keys = useMemo(() => keysQuery.data?.data ?? [], [keysQuery.data])
  const totalKeys = keysQuery.data?.total ?? 0
  const isSampled = totalKeys > keys.length

  /** Cell counts by status, across every language of every sampled key. */
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      TRANSLATION_STATUS_FLOW.map((status) => [status, 0])
    ) as Record<TranslationStatus, number>

    for (const key of keys) {
      for (const cell of Object.values(key.translations)) {
        counts[cell.status] = (counts[cell.status] ?? 0) + 1
      }
    }

    return counts
  }, [keys])

  const totalCells = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0
  )

  /** Percentage of cells at APPROVED or PUBLISHED, per language. */
  const coverage = useMemo(() => {
    const byLanguage = new Map<string, { done: number; total: number }>()

    for (const key of keys) {
      for (const [code, cell] of Object.entries(key.translations)) {
        const entry = byLanguage.get(code) ?? { done: 0, total: 0 }
        entry.total += 1
        if (cell.status === "APPROVED" || cell.status === "PUBLISHED") {
          entry.done += 1
        }
        byLanguage.set(code, entry)
      }
    }

    return [...byLanguage.entries()]
      .map(([code, entry]) => ({
        code,
        percent:
          entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0,
        total: entry.total,
      }))
      .sort((a, b) => b.percent - a.percent)
  }, [keys])

  const languageName = new Map(
    (languagesQuery.data ?? []).map((language) => [
      language.code,
      language.name,
    ])
  )

  const activity = activityQuery.data?.data ?? []
  const actorIds = [...new Set(activity.map((entry) => entry.userId))]
  const usersQuery = useAllUsers(
    { where: { _id: { $in: actorIds } } },
    { enabled: actorIds.length > 0 }
  )
  const userById = new Map(
    (usersQuery.data ?? []).map((user) => [user._id, user])
  )

  const awaitingReview = statusCounts.REVIEW ?? 0
  const awaitingPublish = statusCounts.APPROVED ?? 0

  return (
    <div className="p-5">
      <PageHeader
        title="Dashboard"
        description="Where this project stands, and what is waiting on someone."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Table2Icon}
          label="Translation keys"
          value={keysQuery.isLoading ? null : formatNumber(totalKeys)}
          to="/translations"
        />
        <StatCard
          icon={BoxesIcon}
          label="Applications"
          value={
            applicationsQuery.isLoading
              ? null
              : formatNumber(applicationsQuery.data?.length ?? 0)
          }
          to="/applications"
        />
        <StatCard
          icon={ClockIcon}
          label="Awaiting review"
          value={keysQuery.isLoading ? null : formatNumber(awaitingReview)}
          tone={awaitingReview > 0 ? "text-sky-600" : undefined}
          to="/translations"
        />
        <StatCard
          icon={LanguagesIcon}
          label="Ready to publish"
          value={keysQuery.isLoading ? null : formatNumber(awaitingPublish)}
          tone={awaitingPublish > 0 ? "text-indigo-600" : undefined}
          to="/translations"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage by language</CardTitle>
            <p className="text-xs text-muted-foreground">
              Share of cells approved or published
              {isSampled
                ? `, across a sample of ${formatNumber(keys.length)} of ${formatNumber(totalKeys)} keys`
                : ""}
              .
            </p>
          </CardHeader>
          <CardContent>
            {keysQuery.isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-6 w-full" />
                ))}
              </div>
            ) : coverage.length === 0 ? (
              <EmptyState
                title="No translations yet"
                body="Coverage appears once this project has keys."
              />
            ) : (
              <ul className="space-y-2.5">
                {coverage.map((entry) => (
                  <li key={entry.code} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs">
                      {languageName.get(entry.code) ?? entry.code}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${entry.percent}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {entry.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cells by status</CardTitle>
            <p className="text-xs text-muted-foreground">
              Every language of every key{isSampled ? " in the sample" : ""}.
            </p>
          </CardHeader>
          <CardContent>
            {keysQuery.isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-6 w-full" />
                ))}
              </div>
            ) : totalCells === 0 ? (
              <EmptyState
                title="Nothing to show"
                body="Add a key to see its status here."
              />
            ) : (
              <ul className="space-y-2.5">
                {TRANSLATION_STATUS_FLOW.map((status) => {
                  const count = statusCounts[status] ?? 0
                  const percent =
                    totalCells > 0 ? (count / totalCells) * 100 : 0

                  return (
                    <li key={status} className="flex items-center gap-3">
                      <span className="w-24 shrink-0">
                        <StatusChip status={status} size="sm" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            statusMeta(status).dot
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {formatNumber(count)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {can(ENTITLEMENTS.AUDIT_LOGS, "read") ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Recent activity</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                render={<AppLink to="/audit" />}
              >
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <EmptyState
                  icon={ScrollTextIcon}
                  title="No activity yet"
                  body="Changes to keys, members and settings will show up here."
                />
              ) : (
                <ol className="space-y-2.5">
                  {activity.map((entry) => (
                    <li key={entry._id} className="flex items-center gap-2.5">
                      <UserAvatar
                        user={userById.get(entry.userId)}
                        className="size-6"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-medium">
                          {fullName(userById.get(entry.userId))}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {entry.description ?? entry.action}
                        </span>
                      </p>
                      <Badge variant="outline">{entry.entityType}</Badge>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatRelative(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  to,
}: {
  icon: typeof Table2Icon
  label: string
  value: string | null
  tone?: string
  to: string
}) {
  return (
    <AppLink
      to={to}
      className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", tone)}>
          {value}
        </p>
      )}
    </AppLink>
  )
}
