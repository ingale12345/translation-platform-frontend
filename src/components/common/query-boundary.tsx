import { AlertCircleIcon, RefreshCwIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/http/errors"
import { cn } from "@/lib/utils"

interface QueryBoundaryProps {
  isLoading: boolean
  error: unknown
  /** True when the query succeeded but returned nothing to show. */
  isEmpty?: boolean
  empty?: ReactNode
  /** Skeleton shaped like the content it replaces. Defaults to three rows. */
  skeleton?: ReactNode
  onRetry?: () => void
  children: ReactNode
}

/**
 * The loading / error / empty ladder every data view goes through.
 *
 * Written once because the interesting part is the *order*: an error wins over a stale
 * spinner, and "empty" is only meaningful after a successful load. Screens that re-derive
 * that order tend to flash an empty state while the first request is still in flight.
 */
export function QueryBoundary({
  isLoading,
  error,
  isEmpty,
  empty,
  skeleton,
  onRetry,
  children,
}: QueryBoundaryProps) {
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  if (isLoading) {
    return <>{skeleton ?? <DefaultSkeleton />}</>
  }

  if (isEmpty && empty) {
    return <>{empty}</>
  }

  return <>{children}</>
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className
      )}
    >
      <AlertCircleIcon className="mb-3 size-6 text-destructive" />
      <p className="text-sm font-medium">Could not load this</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {errorMessage(error)}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCwIcon /> Try again
        </Button>
      ) : null}
    </div>
  )
}

export function DefaultSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
