/**
 * One typed client per FeathersJS service.
 *
 * Every entry is `createResourceService<Model, Create, Patch>(path)` — the axios calls,
 * query serialisation and error normalisation all live in the factory, so adding a
 * service to the platform is a single line here rather than a new file of fetch code.
 *
 * Features import these, wrap them with `createResourceHooks`, and never touch axios.
 */
import { createResourceService } from "./resource"
import type {
  ActivityLog,
  ApiToken,
  ApiTokenCreate,
  ApiTokenPatch,
  Application,
  ApplicationCreate,
  ApplicationPatch,
  Entitlement,
  EntitlementCreate,
  EntitlementPatch,
  ExportJob,
  ExportJobCreate,
  ExportJobPatch,
  ImportJob,
  ImportJobCreate,
  ImportJobPatch,
  Language,
  LanguageCreate,
  LanguagePatch,
  Notification,
  NotificationCreate,
  NotificationPatch,
  OrganizationMember,
  OrganizationMemberCreate,
  OrganizationMemberPatch,
  Organization,
  OrganizationCreate,
  OrganizationPatch,
  Project,
  ProjectCreate,
  ProjectMember,
  ProjectMemberCreate,
  ProjectMemberPatch,
  ProjectPatch,
  Role,
  RoleCreate,
  RolePatch,
  Template,
  TemplateCreate,
  TemplatePatch,
  TranslationComment,
  TranslationCommentCreate,
  TranslationCommentPatch,
  TranslationHistoryEntry,
  TranslationVersion,
  TranslationVersionPatch,
  TranslationKey,
  TranslationKeyCreate,
  TranslationKeyPatch,
  User,
  UserCreate,
  UserPatch,
} from "@/types/models"

export { createResourceService } from "./resource"
export type { ResourceService } from "./resource"

/* -------------------------------------------------------------------------- *
 * Identity & tenancy
 * -------------------------------------------------------------------------- */

export const usersService = createResourceService<User, UserCreate, UserPatch>(
  "users"
)

export const organizationsService = createResourceService<
  Organization,
  OrganizationCreate,
  OrganizationPatch
>("organizations")

export const projectsService = createResourceService<
  Project,
  ProjectCreate,
  ProjectPatch
>("projects")

/* -------------------------------------------------------------------------- *
 * Access control
 * -------------------------------------------------------------------------- */

/**
 * Membership of the organization itself — the platform-admin tier.
 *
 * Roles held here apply to every project, including ones created later, which is what
 * lets a platform admin open a project nobody added them to.
 */
export const organizationMembersService = createResourceService<
  OrganizationMember,
  OrganizationMemberCreate,
  OrganizationMemberPatch
>("organization-members")

export const projectMembersService = createResourceService<
  ProjectMember,
  ProjectMemberCreate,
  ProjectMemberPatch
>("project-members")

export const rolesService = createResourceService<Role, RoleCreate, RolePatch>(
  "roles"
)

/** Read-only on the server; the create/patch types exist only for platform tooling. */
export const entitlementsService = createResourceService<
  Entitlement,
  EntitlementCreate,
  EntitlementPatch
>("entitlements")

/* -------------------------------------------------------------------------- *
 * Project content
 * -------------------------------------------------------------------------- */

export const applicationsService = createResourceService<
  Application,
  ApplicationCreate,
  ApplicationPatch
>("applications")

export const languagesService = createResourceService<
  Language,
  LanguageCreate,
  LanguagePatch
>("languages")

/* -------------------------------------------------------------------------- *
 * Localization
 * -------------------------------------------------------------------------- */

export const translationKeysService = createResourceService<
  TranslationKey,
  TranslationKeyCreate,
  TranslationKeyPatch
>("translation-keys")

/**
 * Versions are created by the import endpoint, never by a client — the statistics on one
 * are a measurement of what an import did, not a claim a caller gets to make. `patch` is
 * how a version is published.
 */
export const translationVersionsService = createResourceService<
  TranslationVersion,
  never,
  TranslationVersionPatch
>("translation-versions")

/** Append-only: history is written by the server, never by a client. */
export const translationHistoryService = createResourceService<
  TranslationHistoryEntry,
  never,
  never
>("translation-history")

export const translationCommentsService = createResourceService<
  TranslationComment,
  TranslationCommentCreate,
  TranslationCommentPatch
>("translation-comments")

/* -------------------------------------------------------------------------- *
 * Data pipeline
 * -------------------------------------------------------------------------- */

export const templatesService = createResourceService<
  Template,
  TemplateCreate,
  TemplatePatch
>("templates")

export const importJobsService = createResourceService<
  ImportJob,
  ImportJobCreate,
  ImportJobPatch
>("import-jobs")

export const exportJobsService = createResourceService<
  ExportJob,
  ExportJobCreate,
  ExportJobPatch
>("export-jobs")

export const apiTokensService = createResourceService<
  ApiToken,
  ApiTokenCreate,
  ApiTokenPatch
>("api-tokens")

/* -------------------------------------------------------------------------- *
 * System
 * -------------------------------------------------------------------------- */

/** Append-only audit trail. */
export const activityLogsService = createResourceService<
  ActivityLog,
  never,
  never
>("activity-logs")

export const notificationsService = createResourceService<
  Notification,
  NotificationCreate,
  NotificationPatch
>("notifications")
