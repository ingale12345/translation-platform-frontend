import { ConstructionIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { EmptyState } from "./empty-state"
import { PageHeader } from "./page-header"

interface PlannedPageProps {
  title: string
  description: string
  /** What this screen will do, from docs/UI_PLAN.md. */
  summary: string
  icon?: LucideIcon
}

/**
 * A placeholder for a screen that is designed but not built.
 *
 * It states what the page will do rather than showing a blank panel, so the nav is
 * navigable end to end and nothing looks broken while the remaining screens land. Each
 * one is replaced by its real page — see docs/UI_PLAN.md for the order.
 */
export function PlannedPage({
  title,
  description,
  summary,
  icon = ConstructionIcon,
}: PlannedPageProps) {
  return (
    <div className="p-5">
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title="Not built yet" body={summary} />
    </div>
  )
}
