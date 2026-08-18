import { createResourceHooks } from "@/lib/query/resource-hooks"
import { importJobsService } from "@/services"

export const importJobQueries = createResourceHooks(importJobsService)

export const {
  keys: importJobKeys,
  useList: useImportJobs,
  useOne: useImportJob,
  useCreate: useCreateImportJob,
  useUpdate: useUpdateImportJob,
} = importJobQueries
