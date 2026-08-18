import { useRouterState } from "@tanstack/react-router"
import {
  CheckIcon,
  ChevronDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  ShieldIcon,
  SunIcon,
} from "lucide-react"

import { UserAvatar } from "@/components/common/user-avatar"
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NAV_ITEMS } from "@/config/nav"
import {
  useActiveMembership,
  useCurrentUser,
  useLogout,
} from "@/features/session/hooks"
import { fullName } from "@/lib/format"
import { PermissionPeek } from "./permission-peek"
import { ProjectSwitcher } from "./project-switcher"

/**
 * Page title, tenant switcher, and the account menu.
 *
 * The title is derived from the route rather than passed down, so a page cannot forget to
 * set it and no two screens can claim the same heading.
 */
export function Topbar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const user = useCurrentUser()
  const { data: membership } = useActiveMembership()
  const logout = useLogout()
  const { theme, setTheme } = useTheme()

  const active = NAV_ITEMS.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  )
  const roles = membership?.roles ?? []

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {active ? (
          <active.icon className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
        <h1 className="truncate text-[15px] font-semibold">
          {active?.label ?? "Console"}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <PermissionPeek />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <ProjectSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-9 gap-2 px-1.5"
                aria-label="Account menu"
              >
                <UserAvatar user={user ?? undefined} />
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block truncate text-xs leading-tight font-medium">
                    {fullName(user ?? undefined)}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                    {roles.map((role) => role.roleName).join(", ") ||
                      "no roles here"}
                  </span>
                </span>
                <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </Button>
            }
          />

          {/*
            Every DropdownMenuLabel must sit inside a DropdownMenuGroup: Base UI's
            GroupLabel reads a context the Group provides, and throws without it.
          */}
          <DropdownMenuContent align="end" className="w-72">
            <div className="flex items-center gap-2.5 px-1.5 py-2">
              <UserAvatar user={user ?? undefined} className="size-9" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {fullName(user ?? undefined)}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>

            {roles.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <ShieldIcon className="size-3" />
                    Roles in {membership?.project?.name ?? "this project"}
                  </DropdownMenuLabel>
                  <div className="flex flex-wrap gap-1 px-1.5 pb-1.5">
                    {roles.map((role) => (
                      <Badge key={role._id} variant="secondary">
                        {role.roleName}
                      </Badge>
                    ))}
                  </div>
                </DropdownMenuGroup>
              </>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel>Appearance</DropdownMenuLabel>
              {(
                [
                  { value: "light", label: "Light", icon: SunIcon },
                  { value: "dark", label: "Dark", icon: MoonIcon },
                  { value: "system", label: "System", icon: MonitorIcon },
                ] as const
              ).map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon /> {option.label}
                  {theme === option.value ? (
                    <CheckIcon className="ml-auto size-4" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOutIcon /> {logout.isPending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
