import { createResourceHooks } from "@/lib/query/resource-hooks"
import { entitlementsService } from "@/services"

export const entitlementQueries = createResourceHooks(entitlementsService)

export const {
  keys: entitlementKeys,
  useList: useEntitlements,
  useListAll: useAllEntitlements,
  useOne: useEntitlement,
} = entitlementQueries
