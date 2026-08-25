import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  ScissorsIcon,
  SendIcon,
  TrashIcon,
  UndoIcon,
} from "lucide-react"
import { useMemo } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { QueryBoundary } from "@/components/common/query-boundary"
import { StatusChip } from "@/components/common/status-chip"
import { UserAvatar } from "@/components/common/user-avatar"
import { useCellHistory } from "@/features/translation-history/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { formatDateTime, formatRelative, fullName } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type {
  TranslationHistoryAction,
  TranslationHistoryEntry,
  TranslationStatus,
  User,
} from "@/types/models"

/** How each action reads in the timeline. */
const ACTION_META: Record<
  TranslationHistoryAction,
  { verb: string; icon: typeof PencilIcon; tone: string }
> = {
  CREATE: {
    verb: "added a translation",
    icon: PlusIcon,
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  UPDATE: {
    verb: "edited the translation",
    icon: PencilIcon,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  APPROVE: {
    verb: "approved it",
    icon: CheckIcon,
    tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  },
  // "Signed off", not "published" — this is the approval ladder reaching its top, which
  // says nothing about whether anyone has received the string. VERSION_PUBLISHED below is
  // the row that means delivery, and keeping the two verbs distinct is the whole point.
  PUBLISH: {
    verb: "signed it off",
    icon: SendIcon,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  REVERT: {
    verb: "sent it back",
    icon: UndoIcon,
    tone: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  DELETE: {
    verb: "removed the translation",
    icon: TrashIcon,
    tone: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  VERSION_FROZEN: {
    verb: "froze it into a version",
    icon: ScissorsIcon,
    tone: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  VERSION_PUBLISHED: {
    verb: "released it",
    icon: RocketIcon,
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
}

const RELEASE_ACTIONS = new Set<TranslationHistoryAction>([
  "VERSION_FROZEN",
  "VERSION_PUBLISHED",
])

/** How a release row reads, given which version it names and why the key is in it. */
const releaseSentence = (entry: TranslationHistoryEntry): string => {
  const version = entry.metadata?.version
  const membership = entry.metadata?.membership
  const previous = entry.metadata?.previousVersion

  if (entry.action === "VERSION_FROZEN") {
    const how =
      membership === "dropped"
        ? "dropped from"
        : membership === "restored"
          ? "restored in"
          : "added in"

    return `${how} version ${version}`
  }

  const direction =
    membership === "dropped"
      ? "stopped being delivered"
      : membership === "restored"
        ? "delivered again"
        : "started being delivered"

  return previous
    ? `${direction} — version ${previous} → ${version}`
    : `${direction} — version ${version} went live`
}

interface HistoryTimelineProps {
  translationKeyId: Id | undefined
  languageCode: string | undefined
}

/**
 * The audit trail for **one cell**: who changed what, and when.
 *
 * Scoped to a single key and language — see `useCellHistory` for why the unfiltered
 * version does not exist. Newest first, because the question a reader arrives with is
 * almost always "what just happened to this?" rather than "how did it begin?".
 */
export function HistoryTimeline({
  translationKeyId,
  languageCode,
}: HistoryTimelineProps) {
  const query = useCellHistory(translationKeyId, languageCode)
  const entries = useMemo(() => query.data?.data ?? [], [query.data])

  const actorIds = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.changedBy)
            .filter((id): id is Id => Boolean(id))
        )
      ),
    [entries]
  )

  const usersQuery = useAllUsers(
    { where: { _id: { $in: actorIds } }, limit: 100 },
    { enabled: actorIds.length > 0 }
  )
  const userById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user._id, user])),
    [usersQuery.data]
  )

  return (
    <div className="px-4 py-3">
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={entries.length === 0}
        onRetry={query.refetch}
        empty={
          <EmptyState
            title="No history yet"
            body="Every edit, approval and publish of this cell is recorded here."
          />
        }
      >
        <ol className="relative space-y-4">
          {entries.map((entry, index) => (
            <HistoryRow
              key={entry._id}
              entry={entry}
              actor={userById.get(entry.changedBy)}
              isLast={index === entries.length - 1}
            />
          ))}
        </ol>
      </QueryBoundary>
    </div>
  )
}

function HistoryRow({
  entry,
  actor,
  isLast,
}: {
  entry: TranslationHistoryEntry
  actor: User | undefined
  isLast: boolean
}) {
  const meta = ACTION_META[entry.action] ?? ACTION_META.UPDATE
  const Icon = meta.icon
  const isRelease = RELEASE_ACTIONS.has(entry.action)
  const oldStatus = entry.metadata?.oldStatus as TranslationStatus | undefined
  const newStatus = entry.metadata?.newStatus as TranslationStatus | undefined
  const statusMoved = Boolean(oldStatus && newStatus && oldStatus !== newStatus)
  const valueChanged = (entry.oldValue ?? "") !== (entry.newValue ?? "")
  // A release row carries no value diff — nothing was rewritten, only delivered.
  const cellStatus = entry.metadata?.cellStatus as TranslationStatus | undefined

  return (
    <li className="relative flex gap-3">
      {/* The rail connects consecutive events so the column reads as one timeline. */}
      {!isLast ? (
        <span className="absolute top-8 bottom-[-1.25rem] left-[15px] w-px bg-border" />
      ) : null}

      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
          meta.tone
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1 pb-1">
        <p className="text-sm">
          <span className="font-medium">{fullName(actor)}</span>{" "}
          <span className="text-muted-foreground">{meta.verb}</span>
        </p>
        <p
          className="text-[11px] text-muted-foreground"
          title={formatDateTime(entry.changedAt)}
        >
          {formatRelative(entry.changedAt)}
          {/*
            What production was serving at the time. Shown only on edits: on a release row
            the version *is* the event, and printing it twice reads as two versions.
          */}
          {!isRelease && entry.publishedVersion ? (
            <> · v{entry.publishedVersion} was live</>
          ) : null}
        </p>

        {isRelease ? (
          <div className="mt-2 space-y-1.5">
            <p className="rounded border-l-2 border-violet-300 bg-violet-50/60 px-2 py-1 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
              {releaseSentence(entry)}
            </p>
            {entry.action === "VERSION_FROZEN" && cellStatus !== "PUBLISHED" ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                This cell was <StatusChip status={cellStatus} size="sm" /> when
                the version was frozen, so it is in the release but not delivered
                until it is signed off.
              </p>
            ) : null}
          </div>
        ) : null}

        {statusMoved ? (
          <div className="mt-2 flex items-center gap-1.5">
            <StatusChip status={oldStatus} size="sm" />
            <span className="text-muted-foreground">→</span>
            <StatusChip status={newStatus} size="sm" />
          </div>
        ) : null}

        {valueChanged ? (
          <div className="mt-2 space-y-1 text-xs">
            {entry.oldValue ? (
              <p className="rounded border-l-2 border-red-300 bg-red-50/60 px-2 py-1 break-words text-red-900 line-through dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {entry.oldValue}
              </p>
            ) : null}
            {entry.newValue ? (
              <p className="rounded border-l-2 border-emerald-300 bg-emerald-50/60 px-2 py-1 break-words text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {entry.newValue}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Set by bulk operations, so a row of forty identical approvals says why. */}
        {entry.comment ? (
          <p className="mt-2 border-l-2 pl-2 text-xs text-muted-foreground italic">
            “{entry.comment}”
          </p>
        ) : null}

        {actor ? (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <UserAvatar user={actor} className="size-4" />
            {actor.email}
          </div>
        ) : null}
      </div>
    </li>
  )
}
