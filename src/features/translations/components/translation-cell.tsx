import {
  CheckIcon,
  ClockIcon,
  MessageSquareIcon,
  PencilIcon,
  SendIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useRef } from "react"

import { StatusChip } from "@/components/common/status-chip"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  canApproveStatus,
  canPublishStatus,
  statusMeta,
} from "@/lib/translation-status"
import { cn } from "@/lib/utils"
import type { TranslationValue } from "@/types/models"

/** Characters beyond which a value is edited in the dialog rather than in the cell. */
const LONG_VALUE_THRESHOLD = 80

interface TranslationCellProps {
  cell: TranslationValue | undefined
  isEditing: boolean
  draft: string
  onDraftChange: (value: string) => void
  canEdit: boolean
  canApprove: boolean
  canPublish: boolean
  canComment: boolean
  canViewHistory: boolean
  isSaving: boolean
  commentCount: number
  /** Inline edit — used for short values. */
  onEdit: () => void
  /** Opens the roomy dialog editor — used for long values, and always available. */
  onExpand: () => void
  onSave: () => void
  onCancel: () => void
  onApprove: () => void
  onPublish: () => void
  onHistory: () => void
  onComments: () => void
}

/**
 * One language cell in the grid.
 *
 * Carries the status rail, the inline editor, and the workflow actions. Actions appear on
 * hover so a dense grid stays readable, and each one is gated by both permission *and*
 * status — a role with `approve` still cannot approve a cell that has nothing in it.
 */
export function TranslationCell({
  cell,
  isEditing,
  draft,
  onDraftChange,
  canEdit,
  canApprove,
  canPublish,
  canComment,
  canViewHistory,
  isSaving,
  commentCount,
  onEdit,
  onExpand,
  onSave,
  onCancel,
  onApprove,
  onPublish,
  onHistory,
  onComments,
}: TranslationCellProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const meta = statusMeta(cell?.status)
  const isEmpty = !cell?.value

  /**
   * Above this length the inline box stops being a sensible editor: the text no longer
   * fits without scrolling a two-row textarea, so a click edits in the dialog instead.
   * Button labels and short phrases — the overwhelming majority — stay inline, where
   * editing is one click and one keystroke.
   */
  const isLong = (cell?.value?.length ?? 0) > LONG_VALUE_THRESHOLD
  const editInPlace = () => (isLong ? onExpand() : onEdit())

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }
  }, [isEditing])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter saves, Shift+Enter is a newline — translations are usually one line, and the
    // alternative (reaching for a button on every cell) makes bulk editing unusable.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSave()
    }

    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <td
      className="group/cell relative border-r border-b p-0 align-top"
      style={{ minWidth: 240 }}
    >
      <span
        className={cn("absolute inset-y-0 left-0 w-0.5", meta.rail)}
        aria-hidden
      />

      {isEditing ? (
        <div className="space-y-2 p-2.5 pl-3">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <CheckIcon /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <XIcon /> Cancel
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">
              ⏎ save · esc cancel
            </span>
          </div>
        </div>
      ) : (
        <div className="min-h-[64px] p-2.5 pl-3 group-hover/cell:bg-muted/40">
          {/*
            The text itself is the edit target, not the whole cell: the action buttons
            live in this box too, and a click handler on the container would fire for
            them as well. A short value opens inline right here; a long one opens the
            dialog, where it actually fits.
          */}
          {canEdit ? (
            <button
              type="button"
              onClick={editInPlace}
              aria-label={
                isEmpty
                  ? "Add translation"
                  : isLong
                    ? "Edit translation in a larger editor"
                    : "Edit translation"
              }
              className="block w-full cursor-text rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block text-sm leading-relaxed break-words",
                  isEmpty && "text-muted-foreground italic",
                  // A long paragraph must not stretch the whole row; the dialog shows it
                  // in full, and the title attribute covers a quick look.
                  isLong && "line-clamp-3"
                )}
                title={isLong ? cell?.value : undefined}
              >
                {isEmpty ? "Add translation" : cell?.value}
              </span>
            </button>
          ) : (
            <p
              className={cn(
                "text-sm leading-relaxed break-words",
                isEmpty && "text-muted-foreground italic",
                isLong && "line-clamp-3"
              )}
              title={isLong ? cell?.value : undefined}
            >
              {isEmpty ? "No translation" : cell?.value}
            </p>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            <StatusChip status={cell?.status} size="sm" />

            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/cell:opacity-100 focus-within:opacity-100">
              {canEdit ? (
                <CellAction
                  label={isLong ? "Edit in a larger editor" : "Edit"}
                  onClick={onExpand}
                >
                  <PencilIcon className="size-3.5" />
                </CellAction>
              ) : null}

              {canApprove && canApproveStatus(cell?.status) ? (
                <CellAction label="Approve" onClick={onApprove}>
                  <ThumbsUpIcon className="size-3.5" />
                </CellAction>
              ) : null}

              {canPublish && canPublishStatus(cell?.status) ? (
                <CellAction label="Publish" onClick={onPublish}>
                  <SendIcon className="size-3.5" />
                </CellAction>
              ) : null}

              {canViewHistory ? (
                <CellAction label="History" onClick={onHistory}>
                  <ClockIcon className="size-3.5" />
                </CellAction>
              ) : null}

              {canComment || commentCount > 0 ? (
                <CellAction
                  label={
                    commentCount > 0 ? `${commentCount} comment(s)` : "Comment"
                  }
                  onClick={onComments}
                >
                  <MessageSquareIcon className="size-3.5" />
                  {commentCount > 0 ? (
                    <span className="text-[10px] tabular-nums">
                      {commentCount}
                    </span>
                  ) : null}
                </CellAction>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </td>
  )
}

function CellAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="inline-flex h-6 items-center gap-0.5 rounded px-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {children}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
