import { CheckIcon, SendIcon, UndoIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TranslationStatus } from "@/types/models"

interface BulkActionBarProps {
  selectedCount: number
  totalOnPage: number
  canEdit: boolean
  canApprove: boolean
  canPublish: boolean
  onSelectAllOnPage: () => void
  onClear: () => void
  onAction: (status: TranslationStatus) => void
}

/**
 * The selection toolbar, shown only while keys are ticked.
 *
 * It replaces the page's normal toolbar rather than sitting beside it: while a selection
 * is live, the useful actions are the ones that act on it, and a bar that appears in the
 * same place makes the mode switch obvious. Each action is gated by the same permission
 * as its single-cell equivalent, so a translator sees "Send to review" and nothing else.
 */
export function BulkActionBar({
  selectedCount,
  totalOnPage,
  canEdit,
  canApprove,
  canPublish,
  onSelectAllOnPage,
  onClear,
  onAction,
}: BulkActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-5 py-2.5">
      <span className="text-sm font-medium">
        {selectedCount} key{selectedCount === 1 ? "" : "s"} selected
      </span>

      {selectedCount < totalOnPage ? (
        <Button variant="link" size="sm" onClick={onSelectAllOnPage}>
          Select all {totalOnPage} on this page
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canEdit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("REVIEW")}
          >
            <UndoIcon /> Send to review
          </Button>
        ) : null}
        {canApprove ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction("APPROVED")}
          >
            <CheckIcon /> Approve
          </Button>
        ) : null}
        {canPublish ? (
          <Button size="sm" onClick={() => onAction("PUBLISHED")}>
            <SendIcon /> Publish
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <XIcon /> Clear
        </Button>
      </div>
    </div>
  )
}
