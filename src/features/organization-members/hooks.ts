import { createResourceHooks } from "@/lib/query/resource-hooks"
import { organizationMembersService } from "@/services"

/** The platform-admin tier. See `OrganizationMember` for what a row here grants. */
export const organizationMemberQueries = createResourceHooks(
  organizationMembersService
)

export const {
  keys: organizationMemberKeys,
  useList: useOrganizationMembers,
  useListAll: useAllOrganizationMembers,
  useCreate: useCreateOrganizationMember,
  useUpdate: useUpdateOrganizationMember,
  useRemove: useRemoveOrganizationMember,
} = organizationMemberQueries
