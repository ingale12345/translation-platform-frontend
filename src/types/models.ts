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

export type TranslationHistoryAction =
  "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "PUBLISH" | "REVERT"

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

/** The backend's `userDataSchema` only accepts these two on registration. */
export interface UserCreate {
  email: string
  password: string
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

export type ProjectMemberCreate = Omit<ProjectMember, keyof Entity>
export type ProjectMemberPatch = Partial<ProjectMemberCreate>

/* -------------------------------------------------------------------------- *
 * Roles & entitlements
 * -------------------------------------------------------------------------- */

export interface RoleEntitlementPermission {
  entitlementCode: string
  permissions: RolePermissions
}

export interface Role extends Entity {
  organizationId: Id
  projectId: Id
  roleCode: string
  roleName: string
  description?: string
  /** System roles are seeded per project and cannot be edited or deleted. */
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
}

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
   * Free-form detail the server attached. `oldStatus` / `newStatus` are always present
   * when the status moved, which is what lets the timeline render "Review → Approved"
   * rather than a bare "updated".
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
  total: number
  added: number
  updated: number
  unchanged: number
  skipped: number
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
  filePath: string
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
  tokenHash: string
  /** The visible prefix. The full token is returned once, on create, and never again. */
  tokenPrefix: string
  permissions: string[]
  expiresAt?: string
  lastUsedAt?: string
  enabled: boolean
}

/** The hash and prefix are derived server-side; a client never sends them. */
export type ApiTokenCreate = Omit<
  ApiToken,
  keyof Entity | "tokenHash" | "tokenPrefix"
>
export type ApiTokenPatch = Partial<Omit<ApiToken, keyof Entity>>

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
