import { createResourceHooks } from "@/lib/query/resource-hooks"
import { usersService } from "@/services"

export const userQueries = createResourceHooks(usersService)

export const {
  keys: userKeys,
  useList: useUsers,
  useListAll: useAllUsers,
  useOne: useUser,
  useCreate: useCreateUser,
  useUpdate: useUpdateUser,
  useRemove: useRemoveUser,
} = userQueries
