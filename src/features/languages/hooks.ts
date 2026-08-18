import { createResourceHooks } from "@/lib/query/resource-hooks"
import { languagesService } from "@/services"

export const languageQueries = createResourceHooks(languagesService)

export const {
  keys: languageKeys,
  useList: useLanguages,
  useListAll: useAllLanguages,
  useOne: useLanguage,
  useCreate: useCreateLanguage,
  useUpdate: useUpdateLanguage,
  useRemove: useRemoveLanguage,
} = languageQueries
