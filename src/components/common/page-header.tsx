import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  /** Primary and secondary actions, right-aligned. Gate them with `<Can>`. */
  actions?: ReactNode
  className?: string
}

/**
 * The title block every page opens with. One component so heading size, description tone
 * and action placement stay identical across the console.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
