import { useMemo } from "react"

import { createResourceHooks } from "@/lib/query/resource-hooks"
import { projectMembersService } from "@/services"
import { useAllUsers } from "@/features/users/hooks"
import { useProjectRoles } from "@/features/roles/hooks"
import type { Id } from "@/types/api"
import type { ProjectMember, Role, User } from "@/types/models"

export const projectMemberQueries = createResourceHooks(projectMembersService)

export const {
  keys: projectMemberKeys,
  useList: useProjectMembersQuery,
  useListAll: useAllProjectMembers,
  useOne: useProjectMember,
  useCreate: useInviteProjectMember,
  useUpdate: useUpdateProjectMember,
  useRemove: useRemoveProjectMember,
} = projectMemberQueries

/** A member row with its user and roles already resolved. */
export interface ProjectMemberRow {
  member: ProjectMember
  user: User | undefined
  roles: Role[]
}

/**
 * The members table, joined client-side.
 *
 * The backend stores `userId` and `roleIds` as plain references with no `$populate`, so
 * the three collections are fetched in parallel and stitched here. Doing it in one hook
 * keeps the N+1 out of the component and means the table renders from a single
 * loading/error state rather than three.
 */
export const useProjectMemberRows = (projectId: Id | null | undefined) => {
  const membersQuery = useAllProjectMembers(
    {
      where: { projectId: projectId ?? "", status: { $ne: "removed" } },
      sortAsc: "createdAt",
    },
    { enabled: Boolean(projectId) }
  )

  const userIds = membersQuery.data?.map((member) => member.userId) ?? []

  const usersQuery = useAllUsers(
    { where: { _id: { $in: userIds } } },
    { enabled: userIds.length > 0 }
  )

  const rolesQuery = useProjectRoles(projectId)

  const rows = useMemo<ProjectMemberRow[]>(() => {
    if (!membersQuery.data) {
      return []
    }

    const userById = new Map(
      (usersQuery.data ?? []).map((user) => [user._id, user])
    )
    const roleById = new Map(
      (rolesQuery.data ?? []).map((role) => [role._id, role])
    )

    return membersQuery.data.map((member) => ({
      member,
      user: userById.get(member.userId),
      roles: member.roleIds
        .map((roleId) => roleById.get(roleId))
        .filter((role): role is Role => Boolean(role)),
    }))
  }, [membersQuery.data, usersQuery.data, rolesQuery.data])

  return {
    rows,
    roles: rolesQuery.data ?? [],
    isLoading: membersQuery.isLoading || rolesQuery.isLoading,
    isFetching:
      membersQuery.isFetching || usersQuery.isFetching || rolesQuery.isFetching,
    error: membersQuery.error ?? usersQuery.error ?? rolesQuery.error,
    refetch: membersQuery.refetch,
  }
}

/**
 * Adds or removes one role on a member.
 *
 * A member must keep at least one role — stripping the last one leaves them able to open
 * the project but do nothing in it, which reads as a broken page rather than a
 * revocation. Removing the member is the way to revoke access.
 */
export const toggleRoleId = (roleIds: Id[], roleId: Id): Id[] => {
  if (!roleIds.includes(roleId)) {
    return [...roleIds, roleId]
  }

  const next = roleIds.filter((id) => id !== roleId)

  return next.length > 0 ? next : roleIds
}
