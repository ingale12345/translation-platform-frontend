import { createResourceHooks } from "@/lib/query/resource-hooks"
import { applicationsService } from "@/services"

export const applicationQueries = createResourceHooks(applicationsService)

export const {
  keys: applicationKeys,
  useList: useApplications,
  useListAll: useAllApplications,
  useOne: useApplication,
  useCreate: useCreateApplication,
  useUpdate: useUpdateApplication,
  useRemove: useRemoveApplication,
} = applicationQueries
