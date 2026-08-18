import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PaginationProps {
  /** From the Feathers page: `total`, `limit`, `skip`. */
  total: number
  limit: number
  skip: number
  onSkipChange: (skip: number) => void
  className?: string
}

/**
 * Offset pagination over a Feathers page.
 *
 * Takes `total` / `limit` / `skip` verbatim from the response rather than a page number,
 * so the control cannot drift from what the server actually returned.
 */
export function Pagination({
  total,
  limit,
  skip,
  onSkipChange,
  className,
}: PaginationProps) {
  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + limit, total)
  const hasPrevious = skip > 0
  const hasNext = to < total

  return (
    <div
      className={cn("flex items-center justify-between gap-3 py-3", className)}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrevious}
          onClick={() => onSkipChange(Math.max(0, skip - limit))}
        >
          <ChevronLeftIcon /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onSkipChange(skip + limit)}
        >
          Next <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
