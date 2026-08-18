import { InfoIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  /** Say what to do next, not just that there is nothing here. */
  body?: string
  action?: ReactNode
  className?: string
}

/**
 * The "nothing to show" panel. Used for both an empty collection and a filter that
 * matched nothing — the difference is in the copy and the action the caller passes.
 */
export function EmptyState({
  icon: Icon = InfoIcon,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-background ring-1 ring-border">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {body ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
