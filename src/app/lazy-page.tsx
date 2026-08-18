import { Suspense, lazy } from "react"
import type { ComponentType } from "react"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder shown while a route's chunk downloads. Shaped like a page — a heading and a
 * body — so the layout does not jump once the real screen arrives.
 */
const PageFallback = () => (
  <div className="space-y-3 p-5">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-64 w-full" />
  </div>
)

/**
 * Wraps a named export from a lazily imported module as a route component.
 *
 * Pages are code-split so the initial bundle carries only the shell — a translator who
 * only opens the grid never downloads the template editor.
 *
 * Lives apart from the route tree because it *defines* a component, and a module that
 * mixes component definitions with other exports opts out of Fast Refresh.
 */
export const lazyPage = <TModule extends Record<string, unknown>>(
  load: () => Promise<TModule>,
  pick: (module: TModule) => ComponentType
): (() => React.JSX.Element) => {
  const Component = lazy(() =>
    load().then((module) => ({ default: pick(module) }))
  )

  return function LazyPage() {
    return (
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    )
  }
}
