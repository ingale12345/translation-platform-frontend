import { createResourceHooks } from "@/lib/query/resource-hooks"
import { apiTokensService } from "@/services"

export const apiTokenQueries = createResourceHooks(apiTokensService)

export const {
  keys: apiTokenKeys,
  useList: useApiTokens,
  useOne: useApiToken,
  useCreate: useCreateApiToken,
  useUpdate: useUpdateApiToken,
  useRemove: useRemoveApiToken,
} = apiTokenQueries
