import { createResourceHooks } from "@/lib/query/resource-hooks"
import { organizationsService } from "@/services"

export const organizationQueries = createResourceHooks(organizationsService)

export const {
  keys: organizationKeys,
  useList: useOrganizations,
  useListAll: useAllOrganizations,
  useOne: useOrganization,
  useCreate: useCreateOrganization,
  useUpdate: useUpdateOrganization,
  useRemove: useRemoveOrganization,
} = organizationQueries
