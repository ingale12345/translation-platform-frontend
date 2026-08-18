import { CheckCheckIcon, LoaderCircleIcon, SendIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { QueryBoundary } from "@/components/common/query-boundary"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useCurrentUser } from "@/features/session/hooks"
import {
  useCellComments,
  useCreateTranslationComment,
  useUpdateTranslationComment,
} from "@/features/translations/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { formatDate, fullName } from "@/lib/format"
import { errorMessage } from "@/lib/http/errors"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type { TranslationComment, TranslationKey, User } from "@/types/models"

interface CommentThreadProps {
  translationKey: TranslationKey | undefined
  languageCode: string | undefined
  canComment: boolean
}

/** `HH:mm` — a chat bubble wants the time of day, not the date, which the divider carries. */
const timeOfDay = (value: string | undefined) => {
  if (!value) {
    return ""
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const dayKey = (value: string | undefined) =>
  value ? new Date(value).toDateString() : ""

/**
 * The conversation about one translation, as a chat.
 *
 * Laid out like a messaging app rather than a comment list because that is what it is
 * used for: a translator and a reviewer going back and forth about one string. Your own
 * messages sit on the right, everyone else's on the left with their name and avatar, so
 * the thread is readable at a glance without reading every author line.
 */
export function CommentThread({
  translationKey,
  languageCode,
  canComment,
}: CommentThreadProps) {
  const [draft, setDraft] = useState("")
  const currentUser = useCurrentUser()
  const bottomRef = useRef<HTMLDivElement>(null)

  // `live` polls while the thread is on screen. The sheet unmounts it on close, which is
  // what stops the polling — there is no timer to tear down by hand.
  const query = useCellComments(translationKey?._id, languageCode, {
    live: true,
  })
  const createComment = useCreateTranslationComment()
  const updateComment = useUpdateTranslationComment()

  const comments = useMemo(() => query.data?.data ?? [], [query.data])

  // One request for every author in the thread, rather than one per bubble.
  const authorIds = useMemo(
    () =>
      Array.from(
        new Set(
          comments
            .map((comment) => comment.createdBy)
            .filter((id): id is Id => Boolean(id))
        )
      ),
    [comments]
  )

  const usersQuery = useAllUsers(
    { where: { _id: { $in: authorIds } }, limit: 100 },
    { enabled: authorIds.length > 0 }
  )
  const userById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user._id, user])),
    [usersQuery.data]
  )

  // Jump to the newest message whenever the thread grows, the way a chat window does.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [comments.length])

  const submit = () => {
    const text = draft.trim()

    if (!text || !translationKey || !languageCode) {
      return
    }

    createComment.mutate(
      {
        organizationId: translationKey.organizationId,
        projectId: translationKey.projectId,
        applicationId: translationKey.applicationId,
        translationKeyId: translationKey._id,
        languageCode,
        comment: text,
        resolved: false,
      },
      {
        onSuccess: () => setDraft(""),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const toggleResolved = (comment: TranslationComment) => {
    updateComment.mutate(
      {
        id: comment._id,
        data: {
          resolved: !comment.resolved,
          resolvedBy: comment.resolved ? undefined : currentUser?._id,
          resolvedAt: comment.resolved ? undefined : new Date().toISOString(),
        },
      },
      { onError: (error) => toast.error(errorMessage(error)) }
    )
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter is a newline — the convention every chat client uses, and
    // comments here are usually one line.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <QueryBoundary
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={comments.length === 0}
          onRetry={query.refetch}
          empty={
            <EmptyState
              title="No messages yet"
              body={
                canComment
                  ? "Ask a question about this translation — the translator and reviewer both see it here."
                  : "Nobody has discussed this translation yet."
              }
            />
          }
        >
          <div className="space-y-1">
            {comments.map((comment, index) => {
              const previous = comments[index - 1]
              const isMine = Boolean(
                currentUser && comment.createdBy === currentUser._id
              )
              // Consecutive messages from one person are grouped: only the first in a run
              // carries the avatar and name, which is what stops a back-and-forth from
              // reading as a wall of repeated headers.
              const startsRun =
                !previous ||
                previous.createdBy !== comment.createdBy ||
                dayKey(previous.createdAt) !== dayKey(comment.createdAt)

              return (
                <div key={comment._id}>
                  {dayKey(previous?.createdAt) !== dayKey(comment.createdAt) ? (
                    <DayDivider date={comment.createdAt} />
                  ) : null}
                  <Bubble
                    comment={comment}
                    author={
                      comment.createdBy
                        ? userById.get(comment.createdBy)
                        : undefined
                    }
                    isMine={isMine}
                    startsRun={startsRun}
                    canResolve={canComment}
                    onToggleResolved={() => toggleResolved(comment)}
                  />
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        </QueryBoundary>
      </div>

      {canComment ? (
        <div className="shrink-0 border-t bg-card p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message…"
              rows={2}
              className="max-h-32 min-h-10 resize-none"
            />
            <Button
              size="icon"
              className="size-10 shrink-0"
              onClick={submit}
              disabled={!draft.trim() || createComment.isPending}
              aria-label="Send message"
            >
              {createComment.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <SendIcon />
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            ⏎ to send · ⇧⏎ for a new line
          </p>
        </div>
      ) : (
        <div className="shrink-0 border-t px-4 py-3 text-xs text-muted-foreground">
          You have read-only access to this conversation.
        </div>
      )}
    </div>
  )
}

function DayDivider({ date }: { date: string | undefined }) {
  return (
    <div className="my-3 flex items-center gap-2">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {formatDate(date)}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function Bubble({
  comment,
  author,
  isMine,
  startsRun,
  canResolve,
  onToggleResolved,
}: {
  comment: TranslationComment
  author: User | undefined
  isMine: boolean
  startsRun: boolean
  canResolve: boolean
  onToggleResolved: () => void
}) {
  return (
    <div
      className={cn(
        "group/message flex gap-2",
        startsRun ? "mt-3 first:mt-0" : "mt-0.5",
        isMine && "flex-row-reverse"
      )}
    >
      {/* The spacer keeps a grouped run aligned under the first message's avatar. */}
      <div className="w-7 shrink-0">
        {startsRun && !isMine ? <UserAvatar user={author} /> : null}
      </div>

      <div
        className={cn(
          "flex max-w-[85%] min-w-0 flex-col",
          isMine && "items-end"
        )}
      >
        {startsRun ? (
          <div
            className={cn(
              "mb-0.5 flex items-baseline gap-2",
              isMine && "flex-row-reverse"
            )}
          >
            <span className="text-xs font-medium">
              {isMine ? "You" : fullName(author)}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {timeOfDay(comment.createdAt)}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
            isMine
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted",
            comment.resolved && "opacity-60"
          )}
          title={timeOfDay(comment.createdAt)}
        >
          {comment.comment}
        </div>

        <div
          className={cn(
            "mt-0.5 flex items-center gap-2",
            isMine && "flex-row-reverse"
          )}
        >
          {comment.resolved ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <CheckCheckIcon className="size-3" /> Resolved
            </span>
          ) : null}
          {canResolve ? (
            <button
              type="button"
              onClick={onToggleResolved}
              className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 hover:text-foreground focus-visible:opacity-100"
            >
              {comment.resolved ? "Reopen" : "Mark resolved"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
