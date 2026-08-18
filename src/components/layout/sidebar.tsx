import { Link, useRouterState } from "@tanstack/react-router"
import { GlobeIcon, PanelLeftIcon } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { env } from "@/config/env"
import { NAV } from "@/config/nav"
import type { NavGroup } from "@/config/nav"
import { usePermissions } from "@/features/session/hooks"
import { cn } from "@/lib/utils"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

/**
 * Permission-filtered navigation.
 *
 * A group whose every item is hidden disappears with its heading, so a limited role sees
 * a short, coherent menu rather than a list of empty section labels.
 *
 * The brand row is the same height as the topbar, so the sidebar's bottom border meets the
 * header's in one continuous line — and the collapse control sits exactly on that corner,
 * where the two rules cross, rather than stranded at the bottom of the page.
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { can, isLoading } = usePermissions()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const groups = useMemo<NavGroup[]>(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => can(item.entitlement, "read")),
      })).filter((group) => group.items.length > 0),
    [can]
  )

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b",
          collapsed ? "justify-center px-2" : "pr-2 pl-4"
        )}
      >
        {collapsed ? null : (
          <>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GlobeIcon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{env.appName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Translation Platform
              </p>
            </div>
          </>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                className="shrink-0 text-muted-foreground"
              >
                <PanelLeftIcon />
              </Button>
            }
          />
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      <nav
        aria-label="Main"
        className={cn(
          "flex-1 overflow-x-hidden overflow-y-auto py-2",
          collapsed ? "px-2" : "px-2.5"
        )}
      >
        {isLoading ? null : groups.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {collapsed ? null : "No sections available for your role."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label ?? "main"} className="mb-1">
              {group.label && !collapsed ? (
                <p className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </p>
              ) : null}
              {group.label && collapsed ? (
                <div className="my-2 border-t" />
              ) : null}

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.to || pathname.startsWith(`${item.to}/`)

                  const link = (
                    <Link
                      to={item.to}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-md py-2 text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-0" : "px-2.5",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      {/* Active marker: readable when collapsed, where the label is gone. */}
                      <span
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                          isActive ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden
                      />
                      <item.icon className="size-[18px] shrink-0" />
                      {collapsed ? null : (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  )

                  return (
                    <li key={item.to}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger render={link} />
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </aside>
  )
}
