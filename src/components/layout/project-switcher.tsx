import { Building2Icon, CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
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
    return <Skeleton className="h-8 w-40" />
  }

  const active = memberships?.find(
    (membership) => membership.projectId === activeProjectId
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Building2Icon className="text-muted-foreground" />
            <span className="max-w-[140px] truncate">
              {active?.project?.name ?? "Select project"}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        {memberships?.length ? (
          memberships.map((membership) => (
            <DropdownMenuItem
              key={membership.projectId}
              onClick={() => switchProject(membership)}
            >
              <Building2Icon className="text-muted-foreground" />
              <span className="flex-1 truncate">
                <span className="block truncate">
                  {membership.project?.name ?? membership.projectId}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {membership.roles.map((role) => role.roleName).join(", ") ||
                    "no roles"}
                </span>
              </span>
              {membership.projectId === activeProjectId ? (
                <CheckIcon className="size-4" />
              ) : null}
            </DropdownMenuItem>
          ))
        ) : (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            You are not a member of any project yet.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
