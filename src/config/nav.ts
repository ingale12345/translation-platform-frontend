import {
  BoxesIcon,
  FolderKanbanIcon,
  DownloadIcon,
  FileCode2Icon,
  KeyRoundIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  RocketIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  Table2Icon,
  UploadIcon,
  UsersIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { ENTITLEMENTS } from "@/lib/rbac"
import type { EntitlementCode } from "@/lib/rbac"

/**
 * The sidebar, in order.
 *
 * Each item names the entitlement that gates it, so navigation is derived from
 * permissions rather than maintained alongside them — a role without `TRANSLATIONS:read`
 * simply has no Translations link, and no page can be reached that its role cannot use.
 */
export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  entitlement: EntitlementCode
}

export interface NavGroup {
  /** `null` for the first, unlabelled group. */
  label: string | null
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboardIcon,
        entitlement: ENTITLEMENTS.DASHBOARD,
      },
      {
        to: "/projects",
        label: "Projects",
        icon: FolderKanbanIcon,
        entitlement: ENTITLEMENTS.PROJECTS,
      },
      {
        to: "/translations",
        label: "Translations",
        icon: Table2Icon,
        entitlement: ENTITLEMENTS.TRANSLATIONS,
      },
      {
        to: "/applications",
        label: "Applications",
        icon: BoxesIcon,
        entitlement: ENTITLEMENTS.APPLICATIONS,
      },
      {
        to: "/languages",
        label: "Languages",
        icon: LanguagesIcon,
        entitlement: ENTITLEMENTS.LANGUAGES,
      },
    ],
  },
  {
    label: "Access",
    items: [
      {
        to: "/members",
        label: "Members",
        icon: UsersIcon,
        entitlement: ENTITLEMENTS.PROJECT_MEMBERS,
      },
      {
        to: "/roles",
        label: "Roles",
        icon: ShieldIcon,
        entitlement: ENTITLEMENTS.ROLES,
      },
      {
        to: "/api-tokens",
        label: "API Tokens",
        icon: KeyRoundIcon,
        entitlement: ENTITLEMENTS.API_TOKENS,
      },
    ],
  },
  {
    label: "Data",
    items: [
      {
        to: "/templates",
        label: "Templates",
        icon: FileCode2Icon,
        entitlement: ENTITLEMENTS.TEMPLATES,
      },
      {
        to: "/import",
        label: "Import",
        icon: UploadIcon,
        entitlement: ENTITLEMENTS.IMPORT,
      },
      {
        to: "/export",
        label: "Export",
        icon: DownloadIcon,
        entitlement: ENTITLEMENTS.EXPORT,
      },
      // Gated on TRANSLATIONS, not IMPORT: publishing a version is what Reviewer exists
      // to do, and Reviewer has no import permission at all. Behind the import gate the
      // publish screen would be hidden from exactly the role that needs it.
      {
        to: "/versions",
        label: "Versions",
        icon: RocketIcon,
        entitlement: ENTITLEMENTS.TRANSLATIONS,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        to: "/audit",
        label: "Audit Log",
        icon: ScrollTextIcon,
        entitlement: ENTITLEMENTS.AUDIT_LOGS,
      },
      {
        to: "/settings",
        label: "Settings",
        icon: SettingsIcon,
        entitlement: ENTITLEMENTS.SETTINGS,
      },
    ],
  },
]

/** Flat lookup, for deriving the page title from the current route. */
export const NAV_ITEMS: NavItem[] = NAV.flatMap((group) => group.items)
