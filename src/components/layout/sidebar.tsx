import { Link, useRouterState } from "@tanstack/react-router"
import { GlobeIcon, PanelLeftCloseIcon, PanelLeftIcon } from "lucide-react"
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
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { can } = usePermissions()
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
        "flex shrink-0 flex-col border-r bg-card transition-[width]",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GlobeIcon className="size-4" />
        </div>
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{env.appName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Translation Platform
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        {groups.map((group) => (
          <div key={group.label ?? "main"}>
            {group.label && !collapsed ? (
              <p className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            ) : null}
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.to)

              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" />
                  {collapsed ? null : (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              )

              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t p-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full text-muted-foreground",
            collapsed ? "justify-center" : "justify-start"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftIcon /> : <PanelLeftCloseIcon />}
          {collapsed ? null : <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}
