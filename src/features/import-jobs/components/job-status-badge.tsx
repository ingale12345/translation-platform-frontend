import { Badge } from "@/components/ui/badge"
import type { JobStatus } from "@/types/models"

const VARIANT: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  QUEUED: "outline",
  PROCESSING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
  CANCELLED: "outline",
}

/** Import and export jobs share one lifecycle, so they share one badge. */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={VARIANT[status]}>{status.toLowerCase()}</Badge>
}
