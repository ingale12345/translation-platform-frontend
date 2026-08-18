import { createResourceHooks } from "@/lib/query/resource-hooks"
import { projectsService } from "@/services"

export const projectQueries = createResourceHooks(projectsService)

export const {
  keys: projectKeys,
  useList: useProjects,
  useListAll: useAllProjects,
  useOne: useProject,
  useCreate: useCreateProject,
  useUpdate: useUpdateProject,
  useRemove: useRemoveProject,
} = projectQueries
