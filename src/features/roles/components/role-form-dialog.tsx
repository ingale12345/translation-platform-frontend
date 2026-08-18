import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/common/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCreateRole, useUpdateRole } from "@/features/roles/hooks"
import { useActiveTenant } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import type { Role } from "@/types/models"

const schema = z.object({
  roleName: z.string().min(2, "At least 2 characters").max(100),
  roleCode: z
    .string()
    .min(2, "At least 2 characters")
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, digits and underscores only"),
  description: z.string().max(500).optional(),
})

type RoleForm = z.infer<typeof schema>

export type RoleDialogMode = "create" | "duplicate" | "edit"

interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: RoleDialogMode
  /** The role being edited, or the one being duplicated. */
  role?: Role
  onCreated?: (role: Role) => void
}

const COPY: Record<
  RoleDialogMode,
  { title: string; description: string; submit: string }
> = {
  create: {
    title: "New role",
    description:
      "Create the role, then set what it grants in the permission matrix.",
    submit: "Create role",
  },
  duplicate: {
    title: "Duplicate role",
    description: "The new role starts with the same grants, and is editable.",
    submit: "Duplicate role",
  },
  edit: {
    title: "Edit role",
    description: "Rename the role or update its description.",
    submit: "Save changes",
  },
}

/**
 * Create, duplicate or rename a role.
 *
 * Grants are not edited here — they belong in the matrix on the page behind this dialog,
 * where the entitlement × action grid gives them the space they need. This dialog only
 * owns identity.
 *
 * Duplicating is the supported way to derive an editable role from a locked system one.
 */
export function RoleFormDialog({
  open,
  onOpenChange,
  mode,
  role,
  onCreated,
}: RoleFormDialogProps) {
  const { organizationId, projectId } = useActiveTenant()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleForm>({
    resolver: zodResolver(schema),
    defaultValues: { roleName: "", roleCode: "", description: "" },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    if (mode === "edit" && role) {
      reset({
        roleName: role.roleName,
        roleCode: role.roleCode,
        description: role.description ?? "",
      })
      return
    }

    if (mode === "duplicate" && role) {
      reset({
        roleName: `${role.roleName} (copy)`,
        roleCode: `${role.roleCode}_copy`,
        description: role.description ?? "",
      })
      return
    }

    reset({ roleName: "", roleCode: "", description: "" })
  }, [open, mode, role, reset])

  const mutation = mode === "edit" ? updateRole : createRole

  const onSubmit = handleSubmit((values) => {
    if (!organizationId || !projectId) {
      return
    }

    if (mode === "edit" && role) {
      updateRole.mutate(
        {
          id: role._id,
          data: {
            roleName: values.roleName,
            roleCode: values.roleCode,
            description: values.description || undefined,
          },
        },
        {
          onSuccess: () => {
            toast.success("Role updated")
            onOpenChange(false)
          },
          onError: (error) => toast.error(errorMessage(error)),
        }
      )
      return
    }

    createRole.mutate(
      {
        organizationId,
        projectId,
        // Roles created here always belong to this project. Organization-scoped roles
        // apply to every project at once, so they are seeded at install time rather than
        // authored from inside one project's settings.
        scope: "project" as const,
        roleName: values.roleName,
        roleCode: values.roleCode,
        description: values.description || undefined,
        // A role created here is never a system role — those ship with the platform and
        // are deliberately immutable.
        isSystem: false,
        status: "active",
        // Duplicating carries the grants over; a fresh role starts with none, so the
        // author has to state what it may do rather than inheriting a default.
        entitlementPermissions:
          mode === "duplicate" && role ? role.entitlementPermissions : [],
      },
      {
        onSuccess: (created) => {
          toast.success(`${created.roleName} created`)
          onCreated?.(created)
          onOpenChange(false)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  })

  const copy = COPY[mode]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5"
          noValidate
        >
          {mutation.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(mutation.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField label="Name" required error={errors.roleName?.message}>
            {(props) => (
              <Input {...props} {...register("roleName")} autoFocus />
            )}
          </FormField>

          <FormField
            label="Code"
            required
            error={errors.roleCode?.message}
            hint="Stable identifier, e.g. translator_jp"
          >
            {(props) => (
              <Input
                {...props}
                {...register("roleCode")}
                className="font-mono"
              />
            )}
          </FormField>

          <FormField
            label="Description"
            error={errors.description?.message}
            hint="What this role is for — shown above the matrix"
          >
            {(props) => (
              <Textarea {...props} {...register("description")} rows={2} />
            )}
          </FormField>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
