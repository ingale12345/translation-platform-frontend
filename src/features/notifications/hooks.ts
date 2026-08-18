import { createResourceHooks } from "@/lib/query/resource-hooks"
import { notificationsService } from "@/services"

export const notificationQueries = createResourceHooks(notificationsService)

export const {
  keys: notificationKeys,
  useList: useNotifications,
  useUpdate: useUpdateNotification,
  useRemove: useRemoveNotification,
} = notificationQueries
