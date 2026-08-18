import { cn } from "@/lib/utils"
import { statusMeta } from "@/lib/translation-status"
import type { TranslationStatus } from "@/types/models"

interface StatusChipProps {
  status: TranslationStatus | undefined
  size?: "sm" | "default"
  className?: string
}

/**
 * The translation status pill. Colour, label and dot all come from the one status table,
 * so a chip in the grid and a chip in a filter menu can never disagree.
 */
export function StatusChip({
  status,
  size = "default",
  className,
}: StatusChipProps) {
  const meta = statusMeta(status)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        meta.chip,
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}
