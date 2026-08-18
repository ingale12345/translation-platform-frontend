import { SendIcon } from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { QueryBoundary } from "@/components/common/query-boundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useTranslationHistory } from "@/features/translation-history/hooks"
import {
  useCellComments,
  useCreateTranslationComment,
} from "@/features/translations/hooks"
import { formatDateTime, formatRelative } from "@/lib/format"
import type { Id } from "@/types/api"
import type { TranslationKey } from "@/types/models"

export type CellDrawerMode = "history" | "comments"

interface CellDrawerProps {
  mode: CellDrawerMode | null
  translationKey: TranslationKey | undefined
  languageCode: string | undefined
  canComment: boolean
  onClose: () => void
}

/**
 * History and comments for one cell.
 *
 * Both live in a side sheet rather than a modal: the grid stays visible, so the reviewer
 * keeps the surrounding translations in view while reading why a value changed.
 */
export function CellDrawer({
  mode,
  translationKey,
  languageCode,
  canComment,
  onClose,
}: CellDrawerProps) {
  const open = Boolean(mode && translationKey && languageCode)

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px]"
      >
        <SheetHeader>
          <SheetTitle>
            {mode === "history" ? "Cell history" : "Comments"}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {translationKey
              ? `${translationKey.namespace}.${translationKey.key}`
              : ""}{" "}
            · {languageCode}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {mode === "history" ? (
            <HistoryList
              translationKeyId={translationKey?._id}
              languageCode={languageCode}
            />
          ) : (
            <CommentThread
              translationKey={translationKey}
              languageCode={languageCode}
              canComment={canComment}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function HistoryList({
  translationKeyId,
  languageCode,
}: {
  translationKeyId: Id | undefined
  languageCode: string | undefined
}) {
  const query = useTranslationHistory(
    {
      where: {
        translationKeyId: translationKeyId ?? "",
        languageCode: languageCode ?? "",
      },
      sortDesc: "changedAt",
      limit: 50,
    },
    { enabled: Boolean(translationKeyId && languageCode) }
  )

  const entries = query.data?.data ?? []

  return (
    <QueryBoundary
      isLoading={query.isLoading}
      error={query.error}
      isEmpty={entries.length === 0}
      onRetry={query.refetch}
      empty={
        <EmptyState
          title="No history yet"
          body="Changes to this cell will appear here."
        />
      }
    >
      <ol className="space-y-3">
        {entries.map((entry) => (
          <li key={entry._id} className="border-l-2 pl-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{entry.action}</Badge>
              <span className="text-[11px] text-muted-foreground">
                {formatDateTime(entry.changedAt)}
              </span>
            </div>
            {entry.oldValue ? (
              <p className="mt-1.5 text-xs text-muted-foreground line-through">
                {entry.oldValue}
              </p>
            ) : null}
            {entry.newValue ? (
              <p className="mt-0.5 text-sm">{entry.newValue}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </QueryBoundary>
  )
}

function CommentThread({
  translationKey,
  languageCode,
  canComment,
}: {
  translationKey: TranslationKey | undefined
  languageCode: string | undefined
  canComment: boolean
}) {
  const [draft, setDraft] = useState("")
  const query = useCellComments(translationKey?._id, languageCode)
  const createComment = useCreateTranslationComment()

  const comments = query.data?.data ?? []

  const submit = () => {
    if (!draft.trim() || !translationKey || !languageCode) {
      return
    }

    createComment.mutate(
      {
        organizationId: translationKey.organizationId,
        projectId: translationKey.projectId,
        applicationId: translationKey.applicationId,
        translationKeyId: translationKey._id,
        languageCode,
        comment: draft.trim(),
        resolved: false,
      },
      { onSuccess: () => setDraft("") }
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <QueryBoundary
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={comments.length === 0}
          onRetry={query.refetch}
          empty={
            <EmptyState
              title="No comments"
              body="Start a thread if this translation needs discussion."
            />
          }
        >
          <ol className="space-y-3">
            {comments.map((comment) => (
              <li key={comment._id} className="rounded-lg bg-muted/40 p-3">
                <p className="text-sm">{comment.comment}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatRelative(comment.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </QueryBoundary>
      </div>

      {canComment ? (
        <div className="mt-4 space-y-2 border-t pt-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a comment…"
            rows={3}
          />
          <Button
            size="sm"
            className="w-full"
            onClick={submit}
            disabled={!draft.trim() || createComment.isPending}
          >
            <SendIcon /> Post comment
          </Button>
        </div>
      ) : null}
    </div>
  )
}
