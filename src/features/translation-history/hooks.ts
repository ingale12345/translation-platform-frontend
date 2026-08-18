import { createResourceHooks } from "@/lib/query/resource-hooks"
import { translationHistoryService } from "@/services"

/** Read-only: the server writes history, a client only ever reads it. */
export const translationHistoryQueries = createResourceHooks(
  translationHistoryService
)

export const {
  keys: translationHistoryKeys,
  useList: useTranslationHistory,
  useListAll: useAllTranslationHistory,
} = translationHistoryQueries
