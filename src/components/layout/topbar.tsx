import { useRouterState } from "@tanstack/react-router"
import { ChevronDownIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react"

import { UserAvatar } from "@/components/common/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
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

  const title =
    NAV_ITEMS.find((item) => pathname.startsWith(item.to))?.label ?? "Console"
  const roleNames = membership?.roles.map((role) => role.roleName).join(", ")

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-5 backdrop-blur">
      <h1 className="text-[15px] font-semibold">{title}</h1>

      <div className="flex items-center gap-2">
        <PermissionPeek />
        <div className="mx-1 h-5 w-px bg-border" />
        <ProjectSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-accent">
                <UserAvatar user={user ?? undefined} />
                <span className="hidden text-left sm:block">
                  <span className="block text-xs leading-tight font-medium">
                    {fullName(user ?? undefined)}
                  </span>
                  <span className="block text-[10px] leading-tight text-muted-foreground">
                    {roleNames || "no roles here"}
                  </span>
                </span>
                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block">{fullName(user ?? undefined)}</span>
              <span className="block font-mono text-[10px] font-normal text-muted-foreground">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
            >
              <LogOutIcon /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
