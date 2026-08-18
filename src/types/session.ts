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
  RoleScope,
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
  scope: RoleScope
}

/**
 * Which tier granted access to a project.
 *
 * `organization` means the user reached it through an organization-scoped role rather
 * than a membership row — a platform admin entering a project nobody added them to.
 */
export type AccessVia = "organization" | "project" | "both"

/** One row from `GET /me/memberships` — a project the user can enter. */
export interface UserMembership {
  /** `null` when access comes from the organization rather than a project-members row. */
  memberId: Id | null
  organizationId: Id
  projectId: Id
  status: ProjectMemberStatus
  joinedAt?: string
  lastAccessAt?: string
  via: AccessVia
  project: Pick<
    Project,
    | "_id"
    | "name"
    | "code"
    | "logo"
    | "description"
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
  /** Which tier granted access. `null` when there is none. */
  via: AccessVia | null
  /** True when an organization-scoped role is contributing — i.e. a platform admin. */
  isOrganizationMember: boolean
  roles: MembershipRole[]
  /** Entitlement definitions, so the permission matrix renders without a second request. */
  entitlements: Entitlement[]
  permissions: PermissionMap
}
