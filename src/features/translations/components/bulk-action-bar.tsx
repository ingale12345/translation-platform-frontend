import { CheckIcon, SendIcon, UndoIcon, XIcon } from "lucide-react"

import { StatusChip } from "@/components/common/status-chip"
import { Button } from "@/components/ui/button"
import type { TranslationStatus } from "@/types/models"
import type { SelectionSummary } from "../cell-selection"

interface BulkActionBarProps {
  summary: SelectionSummary
  totalOnPage: number
  canEdit: boolean
  canApprove: boolean
  canPublish: boolean
  onSelectAllOnPage: () => void
  onClear: () => void
  onAction: (status: TranslationStatus) => void
}

/** Statuses a cell may sit at and still move to the target, mirroring the server's ladder. */
const MOVABLE_FROM: Record<string, TranslationStatus[]> = {
  REVIEW: ["MISSING", "DRAFT", "REVIEW", "APPROVED", "PUBLISHED"],
  APPROVED: ["DRAFT", "REVIEW", "PUBLISHED"],
  PUBLISHED: ["APPROVED"],
}

const STATUS_ORDER: Array<TranslationStatus | "MISSING"> = [
  "MISSING",
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
]

/**
 * The selection toolbar, shown only while cells are ticked.
 *
 * It replaces the page's normal toolbar rather than sitting beside it: while a selection is
 * live, the useful actions are the ones that act on it, and a bar that appears in the same
 * place makes the mode switch obvious. Each action is gated by the same permission as its
 * single-cell equivalent, so a translator sees "Send to review" and nothing else.
 *
 * The status breakdown is what makes a cell selection legible. A run of forty cells that
 * moves nine is a confusing result to read afterwards; showing that thirty-one are already
 * published *before* the click explains it in advance, and the count on each button says
 * how many that action will actually move.
 */
export function BulkActionBar({
  summary,
  totalOnPage,
  canEdit,
  canApprove,
  canPublish,
  onSelectAllOnPage,
  onClear,
  onAction,
}: BulkActionBarProps) {
  const movable = (target: TranslationStatus) =>
    STATUS_ORDER.filter((status) =>
      MOVABLE_FROM[target]?.includes(status as TranslationStatus)
    ).reduce((total, status) => total + (summary.byStatus.get(status) ?? 0), 0)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-primary/5 px-5 py-2.5">
      <span className="text-sm font-medium">
        {summary.cells} cell{summary.cells === 1 ? "" : "s"}
        <span className="font-normal text-muted-foreground">
          {" "}
          across {summary.keys} key{summary.keys === 1 ? "" : "s"}
        </span>
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_ORDER.filter((status) => summary.byStatus.has(status)).map(
          (status) => (
            <span key={status} className="flex items-center gap-1">
              <StatusChip status={status} size="sm" />
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {summary.byStatus.get(status)}
              </span>
            </span>
          )
        )}
      </div>

      {summary.cells < totalOnPage ? (
        <Button variant="link" size="sm" onClick={onSelectAllOnPage}>
          Select all {totalOnPage} on this page
        </Button>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canEdit ? (
          <BulkButton
            label="Send to review"
            count={movable("REVIEW")}
            icon={UndoIcon}
            onClick={() => onAction("REVIEW")}
          />
        ) : null}
        {canApprove ? (
          <BulkButton
            label="Approve"
            count={movable("APPROVED")}
            icon={CheckIcon}
            onClick={() => onAction("APPROVED")}
          />
        ) : null}
        {canPublish ? (
          <BulkButton
            label="Publish"
            count={movable("PUBLISHED")}
            icon={SendIcon}
            variant="default"
            onClick={() => onAction("PUBLISHED")}
          />
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

/**
 * One bulk action, labelled with how many of the selected cells it can move.
 *
 * Disabled at zero rather than hidden: a greyed-out "Publish 0" tells a reviewer their
 * selection is not ready, where a button that vanishes reads as a missing permission.
 */
function BulkButton({
  label,
  count,
  icon: Icon,
  variant = "outline",
  onClick,
}: {
  label: string
  count: number
  icon: typeof CheckIcon
  variant?: "outline" | "default"
  onClick: () => void
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={count === 0}
      title={
        count === 0
          ? `None of the selected cells can move to ${label.toLowerCase()}`
          : undefined
      }
    >
      <Icon /> {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </Button>
  )
}
