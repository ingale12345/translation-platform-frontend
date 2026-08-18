import { createResourceHooks } from "@/lib/query/resource-hooks"
import { templatesService } from "@/services"

export const templateQueries = createResourceHooks(templatesService)

export const {
  keys: templateKeys,
  useList: useTemplates,
  useListAll: useAllTemplates,
  useOne: useTemplate,
  useCreate: useCreateTemplate,
  useUpdate: useUpdateTemplate,
  useRemove: useRemoveTemplate,
} = templateQueries
