import { ClockIcon, MessagesSquareIcon } from "lucide-react"

import { StatusChip } from "@/components/common/status-chip"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { TranslationKey } from "@/types/models"
import { CommentThread } from "./comment-thread"
import { HistoryTimeline } from "./history-timeline"

export type CellDrawerMode = "history" | "comments"

interface CellDrawerProps {
  mode: CellDrawerMode | null
  translationKey: TranslationKey | undefined
  languageCode: string | undefined
  languageName?: string
  canComment: boolean
  onModeChange: (mode: CellDrawerMode) => void
  onClose: () => void
}

/**
 * History and conversation for one cell, side by side in a sheet.
 *
 * A sheet rather than a modal so the grid stays visible: a reviewer reading why a value
 * changed usually wants the surrounding translations in view. The two tabs share one
 * panel because they answer the same question from different angles — one is what
 * happened, the other is what people said about it.
 *
 * Both panels are keyed by cell, so switching cells remounts them: the chat scrolls to
 * its own newest message and neither shows the previous cell's data for a frame.
 */
export function CellDrawer({
  mode,
  translationKey,
  languageCode,
  languageName,
  canComment,
  onModeChange,
  onClose,
}: CellDrawerProps) {
  const open = Boolean(mode && translationKey && languageCode)
  const cell = languageCode
    ? translationKey?.translations[languageCode]
    : undefined
  const cellKey = `${translationKey?._id}:${languageCode}`

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:w-[560px] sm:max-w-[560px]"
      >
        <SheetHeader className="shrink-0 border-b p-4">
          <SheetTitle className="truncate font-mono text-sm">
            {translationKey
              ? `${translationKey.namespace}.${translationKey.key}`
              : ""}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span>{languageName ?? languageCode}</span>
            <StatusChip status={cell?.status} size="sm" />
          </SheetDescription>

          {cell?.value ? (
            <p className="mt-2 max-h-24 overflow-y-auto rounded-md bg-muted/60 px-3 py-2 text-sm break-words">
              {cell.value}
            </p>
          ) : null}
        </SheetHeader>

        <div
          className="flex shrink-0 gap-1 border-b px-2 py-1.5"
          role="tablist"
          aria-label="Cell detail"
        >
          <Tab
            isActive={mode === "comments"}
            onClick={() => onModeChange("comments")}
            icon={MessagesSquareIcon}
            label="Conversation"
          />
          <Tab
            isActive={mode === "history"}
            onClick={() => onModeChange("history")}
            icon={ClockIcon}
            label="History"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "history" ? (
            <HistoryTimeline
              key={`history:${cellKey}`}
              translationKeyId={translationKey?._id}
              languageCode={languageCode}
            />
          ) : (
            <CommentThread
              key={`chat:${cellKey}`}
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

function Tab({
  isActive,
  onClick,
  icon: Icon,
  label,
}: {
  isActive: boolean
  onClick: () => void
  icon: typeof ClockIcon
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}
