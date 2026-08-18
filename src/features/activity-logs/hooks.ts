import { createResourceHooks } from "@/lib/query/resource-hooks"
import { activityLogsService } from "@/services"

/** Append-only audit trail — reads only. */
export const activityLogQueries = createResourceHooks(activityLogsService)

export const {
  keys: activityLogKeys,
  useList: useActivityLogs,
  useInfiniteList: useInfiniteActivityLogs,
} = activityLogQueries
