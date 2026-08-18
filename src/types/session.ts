/**
 * Authentication and the "who am I here?" contract.
 *
 * `EffectivePermissions` mirrors `GET /me/permissions` on the backend. The merge rules
 * (union across roles, masked by each entitlement's `applicablePermissions`) run server
 * side; the client only reads the result, so the two can never disagree.
 */
import type {
  Entitlement,
  PermissionAction,
  ProjectMemberStatus,
  Project,
  User,
} from "./models"
import type { Id } from "./api"

/* -------------------------------------------------------------------------- *
 * Authentication
 * -------------------------------------------------------------------------- */

export interface LoginCredentials {
  email: string
  password: string
}

/** `POST /authentication` body. */
export interface AuthenticationRequest extends LoginCredentials {
  strategy: "local"
}

/** `POST /authentication` response. */
export interface AuthenticationResult {
  accessToken: string
  authentication: {
    strategy: string
    payload?: Record<string, unknown>
  }
  user: User
}

/* -------------------------------------------------------------------------- *
 * Memberships and permissions
 * -------------------------------------------------------------------------- */

export interface MembershipRole {
  _id: Id
  roleCode: string
  roleName: string
  isSystem: boolean
}

/** One row from `GET /me/memberships` — a project the user can enter. */
export interface UserMembership {
  memberId: Id
  organizationId: Id
  projectId: Id
  status: ProjectMemberStatus
  joinedAt?: string
  lastAccessAt?: string
  project: Pick<
    Project,
    | "_id"
    | "name"
    | "code"
    | "logo"
    | "status"
    | "defaultLanguage"
    | "supportedLanguages"
  > | null
  roles: MembershipRole[]
}

/**
 * `permissions[entitlementCode][action]`. `false` means "not granted OR not offered by
 * this entitlement" — exactly the boolean a button needs, with no further reasoning.
 */
export type PermissionMap = Record<string, Record<PermissionAction, boolean>>

/** `GET /me/permissions?projectId=…` */
export interface EffectivePermissions {
  userId: Id
  organizationId: Id | null
  projectId: Id | null
  /** `false` when the user holds no active membership — render "no access", not an error. */
  isMember: boolean
  memberStatus: ProjectMemberStatus | null
  roles: MembershipRole[]
  /** Entitlement definitions, so the permission matrix renders without a second request. */
  entitlements: Entitlement[]
  permissions: PermissionMap
}
