import { ShieldIcon } from "lucide-react"
import { useState } from "react"

import { PermissionMatrix } from "@/features/roles/components/permission-matrix"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePermissions } from "@/features/session/hooks"

/**
 * Shows the user exactly what their roles grant in this project.
 *
 * Worth its own control because "why is this button missing?" is the most common question
 * in a role-gated console, and the honest answer is a matrix, not a role name.
 */
export function PermissionPeek() {
  const [open, setOpen] = useState(false)
  const { data } = usePermissions()

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <ShieldIcon /> Permissions
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Effective permissions</DialogTitle>
            <DialogDescription>
              The union of {data?.roles.length ?? 0} role(s) in this project.
              This is exactly what gates every control in the console.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <PermissionMatrix
              entitlements={data?.entitlements ?? []}
              permissions={data?.permissions ?? {}}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
