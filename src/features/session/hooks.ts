import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import type { ApiError } from "@/lib/http/errors"
import { sessionKeys } from "@/lib/query/keys"
import { can, canAny } from "@/lib/rbac"
import type { EntitlementCode, PermissionAction } from "@/lib/rbac"
import { sessionService } from "@/services/session.service"
import { useSessionStore } from "@/stores/session.store"
import type {
  EffectivePermissions,
  LoginCredentials,
  UserMembership,
} from "@/types/session"

/**
 * Session hooks — authentication, tenant selection and the permission matrix.
 *
 * Everything a screen needs to answer "am I signed in?", "which project am I in?" and
 * "may I press this button?" comes from here, so no component reads the store and the
 * permission endpoint separately and risks the two disagreeing.
 */

/** The signed-in user, or `null`. */
export const useCurrentUser = () => useSessionStore((state) => state.user)

export const useIsAuthenticated = () =>
  useSessionStore((state) => Boolean(state.accessToken))

export const useActiveProjectId = () =>
  useSessionStore((state) => state.activeProjectId)

export const useActiveOrganizationId = () =>
  useSessionStore((state) => state.activeOrganizationId)

/**
 * Both tenant ids, for building a create payload.
 *
 * Every project-scoped record carries `organizationId` *and* `projectId`, and the backend
 * scopes queries on the pair. Returning them together keeps a form from sending one
 * without the other, which would write a record no query can find again.
 */
export const useActiveTenant = () => {
  const organizationId = useActiveOrganizationId()
  const projectId = useActiveProjectId()

  return useMemo(
    () => ({ organizationId, projectId }),
    [organizationId, projectId]
  )
}

/** `GET /me/memberships` — the source of truth for the project switcher. */
export const useMemberships = () => {
  const isAuthenticated = useIsAuthenticated()

  return useQuery<UserMembership[], ApiError>({
    queryKey: sessionKeys.memberships(),
    queryFn: () => sessionService.memberships(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * `GET /me/permissions` for the active project.
 *
 * Cached for the session because roles rarely change mid-visit; switching project changes
 * the key, so the matrix is refetched rather than reused across tenants.
 */
export const usePermissionsQuery = () => {
  const projectId = useActiveProjectId()

  return useQuery<EffectivePermissions, ApiError>({
    queryKey: sessionKeys.permissions(projectId),
    queryFn: () => sessionService.permissions(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  })
}

export interface PermissionsApi {
  data: EffectivePermissions | undefined
  isLoading: boolean
  /** True once the matrix has loaded and the user holds an active membership. */
  isMember: boolean
  /**
   * True when an organization-scoped role is contributing — i.e. a platform admin.
   *
   * Some acts are organization-level whatever the project matrix says: minting a user
   * account, granting somebody organization-wide authority. `can()` cannot answer those,
   * because it reports the *merged* matrix for the active project and a project manager's
   * `PROJECT_MEMBERS:create` looks identical to an admin's there. The server draws the
   * same line in `authorizeUsers` / `assertOrganizationPermission`.
   */
  isOrganizationMember: boolean
  can: (
    entitlement: EntitlementCode | string,
    action: PermissionAction
  ) => boolean
  canAny: (
    pairs: Array<[EntitlementCode | string, PermissionAction]>
  ) => boolean
}

/**
 * The permission reader every gated control uses.
 *
 * While the matrix is loading `can()` returns `false`, so the UI opens closed and never
 * flashes a button the user is about to lose.
 */
export const usePermissions = (): PermissionsApi => {
  const { data, isLoading } = usePermissionsQuery()

  const check = useCallback(
    (entitlement: EntitlementCode | string, action: PermissionAction) =>
      can(data?.permissions, entitlement, action),
    [data]
  )

  const checkAny = useCallback(
    (pairs: Array<[EntitlementCode | string, PermissionAction]>) =>
      canAny(data?.permissions, pairs),
    [data]
  )

  return useMemo(
    () => ({
      data,
      isLoading,
      isMember: data?.isMember ?? false,
      isOrganizationMember: data?.isOrganizationMember ?? false,
      can: check,
      canAny: checkAny,
    }),
    [data, isLoading, check, checkAny]
  )
}

/** The membership record for the active project — roles, status, project metadata. */
export const useActiveMembership = () => {
  const projectId = useActiveProjectId()
  const { data: memberships, ...rest } = useMemberships()

  return {
    ...rest,
    data: memberships?.find((membership) => membership.projectId === projectId),
    memberships,
  }
}

export const useLogin = () => {
  const signIn = useSessionStore((state) => state.signIn)
  const queryClient = useQueryClient()

  return useMutation<
    Awaited<ReturnType<typeof sessionService.login>>,
    ApiError,
    LoginCredentials
  >({
    mutationFn: (credentials) => sessionService.login(credentials),
    onSuccess: (result) => {
      signIn({ accessToken: result.accessToken, user: result.user })
      // The previous user's cache must not leak into this session.
      queryClient.clear()
    },
  })
}

export const useLogout = () => {
  const signOut = useSessionStore((state) => state.signOut)
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, void>({
    mutationFn: () => sessionService.logout(),
    onSettled: () => {
      signOut()
      queryClient.clear()
    },
  })
}

/**
 * Switches the active project. Both ids move together because the backend authorizes on
 * the pair — setting one without the other produces requests scoped to a tenant the user
 * is not actually in.
 */
export const useSwitchProject = () => {
  const setActiveTenant = useSessionStore((state) => state.setActiveTenant)

  return useCallback(
    (membership: Pick<UserMembership, "projectId" | "organizationId">) => {
      setActiveTenant({
        projectId: membership.projectId,
        organizationId: membership.organizationId,
      })
    },
    [setActiveTenant]
  )
}
