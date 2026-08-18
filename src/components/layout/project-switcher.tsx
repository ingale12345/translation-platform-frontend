import { Building2Icon, CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useActiveProjectId,
  useMemberships,
  useSwitchProject,
} from "@/features/session/hooks"
import { cn } from "@/lib/utils"

/**
 * Switches the active tenant.
 *
 * Lists only projects the user is actually a member of (from `/me/memberships`), so the
 * switcher can never put the app into a project whose every request would 403.
 */
export function ProjectSwitcher() {
  const { data: memberships, isLoading } = useMemberships()
  const activeProjectId = useActiveProjectId()
  const switchProject = useSwitchProject()

  if (isLoading) {
    return <Skeleton className="h-9 w-44" />
  }

  const active = memberships?.find(
    (membership) => membership.projectId === activeProjectId
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="h-9 gap-2">
            <Building2Icon className="text-muted-foreground" />
            <span className="hidden max-w-[160px] truncate sm:inline">
              {active?.project?.name ?? "Select project"}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>

          {memberships?.length ? (
            memberships.map((membership) => {
              const isActive = membership.projectId === activeProjectId

              return (
                <DropdownMenuItem
                  key={membership.projectId}
                  onClick={() => switchProject(membership)}
                  className="gap-2.5 py-2"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Building2Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {membership.project?.name ?? "Untitled project"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {membership.roles
                        .map((role) => role.roleName)
                        .join(", ") || "no roles"}
                    </span>
                  </span>
                  {isActive ? <CheckIcon className="size-4 shrink-0" /> : null}
                </DropdownMenuItem>
              )
            })
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              You are not a member of any project yet.
            </p>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
