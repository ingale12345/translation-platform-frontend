import { createResourceHooks } from "@/lib/query/resource-hooks"
import { exportJobsService } from "@/services"

export const exportJobQueries = createResourceHooks(exportJobsService)

export const {
  keys: exportJobKeys,
  useList: useExportJobs,
  useOne: useExportJob,
  useCreate: useCreateExportJob,
} = exportJobQueries
