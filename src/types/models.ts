/**
 * Domain models, mirroring the TypeBox schemas in `translation-platform/src/services/*`.
 *
 * Each model comes with a `…Create` and `…Patch` companion matching that service's
 * `dataSchema` / `patchSchema`, so the generic service layer can type all three arms of
 * a CRUD call. When a backend schema changes, this file is the single place to follow.
 */
import type { Entity, Id } from "./api"

/* -------------------------------------------------------------------------- *
 * Shared enums (common/constants/schema.ts)
 * -------------------------------------------------------------------------- */

export const PERMISSION_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "download",
  "approve",
  "publish",
] as const

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export type UserStatus = "active" | "inactive" | "invited" | "blocked"
export type OrganizationStatus = "active" | "inactive" | "suspended"
export type ProjectStatus = "active" | "inactive" | "archived"
export type ProjectMemberStatus = "invited" | "active" | "inactive" | "removed"
export type RoleStatus = "active" | "inactive"
export type EntitlementStatus = "active" | "inactive"
export type ApplicationStatus = "active" | "inactive" | "archived"

export type ApplicationType =
  | "react"
  | "python"
  | "flutter"
  | "android"
  | "ios"
  | "java"
  | "node"
  | "nestjs"
  | "springboot"
  | "angular"
  | "vue"
  | "other"

/** Where a single translation sits in the review ladder. */
export const TRANSLATION_STATUSES = [
  "MISSING",
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
] as const
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number]

/**
 * What happened to a cell. Two families, and telling them apart matters.
 *
 * `CREATE`…`REVERT` are edits — the text changed, or it moved along the approval ladder.
 * `PUBLISH` means the cell was **signed off**, not that anyone received it.
 *
 * `VERSION_*` are release events: the key was frozen into a numbered version, or a version
 * carrying it went live and changed what applications actually receive.
 */
export type TranslationHistoryAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "PUBLISH"
  | "REVERT"
  | "VERSION_FROZEN"
  | "VERSION_PUBLISHED"

/** Entitlement side: whether the platform offers this action for this feature at all. */
export type EntitlementPermissions = Record<
  PermissionAction,
  { enabled: boolean }
>

/** Role side: whether this role grants the action. Only meaningful where `enabled`. */
export type RolePermissions = Record<PermissionAction, { isAllowed: boolean }>

/* -------------------------------------------------------------------------- *
 * Users
 * -------------------------------------------------------------------------- */

export interface User extends Entity {
  email: string
  firstName: string
  lastName: string
  avatar?: string
  phone?: string
  status: UserStatus
  emailVerified?: boolean
  lastLoginAt?: string
}

/**
 * What `POST /users` accepts — the backend's `userDataSchema`, exactly.
 *
 * A platform admin creates accounts outright and sets the first password, so the profile
 * fields are part of the create rather than a patch that follows it. Anything not listed
 * here is rejected by the server: the data schema is `additionalProperties: false`.
 */
export interface UserCreate {
  email: string
  password: string
  firstName?: string
  lastName?: string
  avatar?: string
  phone?: string
  status?: UserStatus
  emailVerified?: boolean
}

export type UserPatch = Partial<Omit<User, keyof Entity>> & {
  password?: string
}

/* -------------------------------------------------------------------------- *
 * Organizations
 * -------------------------------------------------------------------------- */

export interface Organization extends Entity {
  name: string
  slug: string
  logo: string
  website: string
  email: string
  phone: string
  timezone?: string
  status: OrganizationStatus
  ownerId: Id
  settings?: Record<string, unknown>
}

export type OrganizationCreate = Omit<Organization, keyof Entity>
export type OrganizationPatch = Partial<OrganizationCreate>

/* -------------------------------------------------------------------------- *
 * Projects
 * -------------------------------------------------------------------------- */

export interface ProjectSettings {
  allowMachineTranslation?: boolean
  allowClientTranslation?: boolean
  allowApiAccess?: boolean
  autoTranslateNewKeys?: boolean
  defaultNamespace?: string
}

export interface Project extends Entity {
  organizationId: Id
  name: string
  code: string
  description?: string
  logo?: string
  defaultLanguage: string
  supportedLanguages: string[]
  status: ProjectStatus
  settings?: ProjectSettings
}

export type ProjectCreate = Omit<Project, keyof Entity>
export type ProjectPatch = Partial<ProjectCreate>

/* -------------------------------------------------------------------------- *
 * Organization members — the platform-admin tier
 * -------------------------------------------------------------------------- */

/**
 * Membership of the organization itself.
 *
 * The roles here apply to every project in the organization, including ones created
 * later. It is what makes a platform admin able to open a project nobody added them to,
 * and why creating a project no longer produces something invisible.
 */
export interface OrganizationMember extends Entity {
  organizationId: Id
  userId: Id
  /** Organization-scoped roles only. */
  roleIds: Id[]
  status: ProjectMemberStatus
  invitedBy?: Id
  invitationAcceptedAt?: string
  joinedAt?: string
  lastAccessAt?: string
}

export type OrganizationMemberCreate = Omit<OrganizationMember, keyof Entity>
export type OrganizationMemberPatch = Partial<OrganizationMemberCreate>

/* -------------------------------------------------------------------------- *
 * Project members
 * -------------------------------------------------------------------------- */

export interface ProjectMember extends Entity {
  organizationId: Id
  projectId: Id
  userId: Id
  /** A member can hold several roles; effective permissions are their union. */
  roleIds: Id[]
  status: ProjectMemberStatus
  invitationAcceptedAt?: string
  invitedBy: Id
  joinedAt?: string
  lastAccessAt?: string
}

/**
 * `invitedBy` is omitted because the server stamps it.
 *
 * `stampActor('invitedBy')` runs before validation on the API, so the authenticated caller
 * is always who the record credits — a client-supplied value would be both redundant and
 * forgeable.
 */
export type ProjectMemberCreate = Omit<
  ProjectMember,
  keyof Entity | "invitedBy"
>
export type ProjectMemberPatch = Partial<ProjectMemberCreate>

/* -------------------------------------------------------------------------- *
 * Roles & entitlements
 * -------------------------------------------------------------------------- */

export interface RoleEntitlementPermission {
  entitlementCode: string
  permissions: RolePermissions
}

/**
 * Where a role's grants apply.
 *
 * `organization` roles carry no `projectId` and apply to **every** project in the
 * organization — that is what a platform admin holds. `project` roles are materialised
 * per project, so a manager can rewrite their own project's matrix in isolation.
 */
export type RoleScope = "organization" | "project"

export interface Role extends Entity {
  organizationId: Id
  scope: RoleScope
  /** Absent on organization-scoped roles. */
  projectId?: Id
  roleCode: string
  roleName: string
  description?: string
  /** System roles ship with the platform; their code and scope cannot be changed. */
  isSystem: boolean
  status: RoleStatus
  entitlementPermissions: RoleEntitlementPermission[]
}

export type RoleCreate = Omit<Role, keyof Entity>
export type RolePatch = Partial<RoleCreate>

export interface Entitlement extends Entity {
  moduleCode: string
  moduleName: string
  entitlementCode: string
  entitlementName: string
  description?: string
  /** Which of the seven actions this feature offers. Everything else can never be granted. */
  applicablePermissions: EntitlementPermissions
  displayOrder: number
  isSystem: boolean
  status: EntitlementStatus
}

export type EntitlementCreate = Omit<Entitlement, keyof Entity>
export type EntitlementPatch = Partial<EntitlementCreate>

/* -------------------------------------------------------------------------- *
 * Applications & languages
 * -------------------------------------------------------------------------- */

export interface Application extends Entity {
  organizationId: Id
  projectId: Id
  name: string
  code: string
  description?: string
  type: ApplicationType
  icon?: string
  defaultLanguage: string
  supportedLanguages: string[]
  exportTemplateId?: Id
  importTemplateId?: Id
  apiEnabled: boolean
  apiVersion: string
  status: ApplicationStatus
}

export type ApplicationCreate = Omit<Application, keyof Entity>
export type ApplicationPatch = Partial<ApplicationCreate>

export interface Language extends Entity {
  code: string
  name: string
  nativeName: string
  locale: string
  rtl: boolean
  flagIcon?: string
  enabled: boolean
  sortOrder: number
}

/** `languagesDataSchema` picks only these on create. */
export type LanguageCreate = Pick<
  Language,
  "code" | "name" | "nativeName" | "locale" | "rtl" | "sortOrder"
>
export type LanguagePatch = Partial<Omit<Language, keyof Entity>>

/* -------------------------------------------------------------------------- *
 * Translations
 * -------------------------------------------------------------------------- */

export interface TranslationValue {
  value: string
  status: TranslationStatus
  updatedBy: Id
  updatedAt?: string
  approvedBy?: Id
  approvedAt?: string
}

/** Whether the key still exists in the code, as of the most recent import. */
export type RowStatus = "ACTIVE" | "DISABLED"

/** Where the key came from. `MANUAL` keys are never disabled by an import. */
export type KeyOrigin = "IMPORT" | "MANUAL"

export interface TranslationKey extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  namespace: string
  key: string
  description?: string
  tags: string[]
  /** Keyed by language code — `{ en: { value, status }, ja: { … } }`. */
  translations: Record<string, TranslationValue>

  /**
   * Import lifecycle. A key a later import no longer contains is disabled rather than
   * deleted: it keeps its translations, its conversation and its history, drops out of the
   * grid, and comes back whole if the key reappears.
   */
  rowStatus?: RowStatus
  origin?: KeyOrigin

  /**
   * Release membership, stamped when a version is frozen — never by an import.
   *
   * `firstSeenVersion` absent means the key has never been part of a release, so nothing
   * delivers it yet. The drop is kept alongside the restore rather than cleared, because
   * both stay true and which one applies depends on the version being served.
   */
  firstSeenVersion?: number
  disabledInVersion?: number | null
  restoredInVersion?: number | null
  disabledAt?: string | null
}

export type VersionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED"

export interface VersionStatistics {
  /** Keys frozen into this version — what publishing it would deliver. */
  total: number
  /** Keys that entered the key set since the previous cut. */
  added: number
  /** Keys that stopped being referenced since the previous cut. */
  disabled: number
  /** Keys dropped by an earlier version and back in this one, translations intact. */
  restored: number
  /** Of `total`, how many carry a source value that is approved or published. */
  ready: number
}

/**
 * One release snapshot.
 *
 * Cut deliberately, never by importing. An import changes the working set — keys appear,
 * keys stop being referenced — but says nothing about what is ready to ship. Freezing that
 * working set into a numbered version is a separate act, and publishing the version is a
 * third: exactly one per application is `PUBLISHED`, and that is the key set exports and
 * the runtime API deliver.
 */
export interface TranslationVersion extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  version: number
  status: VersionStatus
  statistics: VersionStatistics
  /** Why it was cut — "sprint 12 sign-off". */
  note?: string
  publishedAt?: string
  publishedBy?: Id
}

/**
 * What a caller supplies when cutting one.
 *
 * `version` and `statistics` are absent on purpose: the number is a sequence the server
 * owns, and the statistics are a measurement of what freezing actually did.
 */
export interface TranslationVersionCreate {
  organizationId: Id
  projectId: Id
  applicationId: Id
  note?: string
}

export type TranslationVersionPatch = Partial<
  Pick<TranslationVersion, "status" | "note">
>

export type TranslationKeyCreate = Omit<TranslationKey, keyof Entity>
export type TranslationKeyPatch = Partial<TranslationKeyCreate>

export interface TranslationHistoryEntry extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  translationKeyId: Id
  namespace: string
  key: string
  languageCode: string
  oldValue?: string
  newValue?: string
  action: TranslationHistoryAction
  changedBy: Id
  changedAt: string
  /** Why the change was made — set by bulk operations, blank for a single edit. */
  comment?: string
  /**
   * The version production was serving when this happened. `null` before anything is
   * published. Lets an edit be placed against what users were seeing at the time.
   */
  publishedVersion?: number | null
  /**
   * Free-form detail the server attached. `oldStatus` / `newStatus` are always present
   * when the status moved, which is what lets the timeline render "Review → Approved"
   * rather than a bare "updated".
   *
   * Release rows carry `version`, `membership` (added | dropped | restored), the
   * `previousVersion` where there was one, and the `cellStatus` at the moment of release.
   */
  metadata?: Record<string, string>
}

export interface TranslationComment extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  translationKeyId: Id
  languageCode: string
  comment: string
  resolved: boolean
  resolvedBy?: Id
  resolvedAt?: string
}

export type TranslationCommentCreate = Omit<TranslationComment, keyof Entity>
export type TranslationCommentPatch = Partial<TranslationCommentCreate>

/* -------------------------------------------------------------------------- *
 * Data pipeline: templates, import/export jobs, API tokens
 * -------------------------------------------------------------------------- */

/** Import and export jobs share one lifecycle. */
export const JOB_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export type TemplateFileType =
  "JSON" | "PROPERTIES" | "ARB" | "XML" | "YAML" | "CSV" | "CUSTOM"

export interface TemplateImportConfig {
  enabled: boolean
  fileStart?: string
  fileRow: string
  fileEnd?: string
  separator?: string
  encoding: string
  hasHeader: boolean
}

export interface TemplateExportConfig {
  enabled: boolean
  fileStart?: string
  fileRow: string
  fileEnd?: string
  separator?: string
  encoding: string
  includeEmptyValues: boolean
}

export interface Template extends Entity {
  organizationId: Id
  projectId: Id
  name: string
  code: string
  description?: string
  fileExtension: string
  fileType: TemplateFileType
  importConfig: TemplateImportConfig
  exportConfig: TemplateExportConfig
  isSystem: boolean
  status: "ACTIVE" | "INACTIVE"
}

export type TemplateCreate = Omit<Template, keyof Entity>
export type TemplatePatch = Partial<TemplateCreate>

export interface ImportJobStatistics {
  /** Keys in the file. */
  total: number
  added: number
  /** Source text differed from what was stored. */
  updated: number
  unchanged: number
  /** Present before, absent from this file — disabled, not deleted. */
  disabled: number
  /** Disabled by an earlier import and back in this one, translations intact. */
  restored: number
  /** Console-created keys the file did not mention, and which were left alone. */
  skipped: number
  /** Lines the parser could not read. */
  failed: number
}

export interface ImportJobError {
  key?: string
  message: string
  line?: number
}

export interface ImportJob extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  templateId: Id
  languageCode: string
  fileName: string
  fileExtension: string
  /** Absent when there is no file at rest — the usual case. */
  filePath?: string
  status: JobStatus
  statistics: ImportJobStatistics
  errors: ImportJobError[]
  startedAt?: string
  completedAt?: string
  uploadedBy: Id
}

export type ImportJobCreate = Omit<ImportJob, keyof Entity>
export type ImportJobPatch = Partial<ImportJobCreate>

export interface ExportJobStatistics {
  total: number
  translated: number
  missing: number
  published: number
}

export interface ExportJob extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  templateId: Id
  languageCode: string
  fileName: string
  fileExtension: string
  filePath?: string
  status: JobStatus
  statistics: ExportJobStatistics
  error?: string
  startedAt?: string
  completedAt?: string
  expiresAt?: string
  generatedBy: Id
}

export type ExportJobCreate = Omit<ExportJob, keyof Entity>
export type ExportJobPatch = Partial<ExportJobCreate>

export interface ApiToken extends Entity {
  organizationId: Id
  projectId: Id
  applicationId: Id
  name: string
  /** The visible prefix. The secret itself is returned once, on create, and never again. */
  tokenPrefix: string
  permissions: string[]
  expiresAt?: string
  lastUsedAt?: string
  enabled: boolean
}

/**
 * The response to `POST /api-tokens`, and the only time `token` is ever populated.
 *
 * The server stores a one-way hash, so this is not a field that can be fetched later —
 * there is no "reveal" to build. The dialog says so at the moment of creation rather than
 * letting somebody find out when they need it.
 */
export interface ApiTokenCreated extends ApiToken {
  token: string
}

/** The hash and prefix are derived server-side; a client never sends them. */
export type ApiTokenCreate = Omit<ApiToken, keyof Entity | "tokenPrefix" | "lastUsedAt">
/** The credential itself is not editable: revoke and issue another instead. */
export type ApiTokenPatch = Partial<
  Pick<ApiToken, "name" | "permissions" | "expiresAt" | "enabled">
>

/* -------------------------------------------------------------------------- *
 * System
 * -------------------------------------------------------------------------- */

export interface ActivityLog extends Entity {
  organizationId: Id
  projectId?: Id
  applicationId?: Id
  userId: Id
  entityType: string
  entityId?: Id
  action: string
  description?: string
  oldValue?: unknown
  newValue?: unknown
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR"

export interface Notification extends Entity {
  organizationId: Id
  projectId?: Id
  userId: Id
  type: NotificationType
  event: string
  title: string
  message: string
  entityType?: string
  entityId?: Id
  metadata?: Record<string, unknown>
  isRead: boolean
  readAt?: string
}

export type NotificationCreate = Omit<Notification, keyof Entity>
export type NotificationPatch = Partial<NotificationCreate>
