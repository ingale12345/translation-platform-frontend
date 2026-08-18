import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, Loader2Icon, UserPlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/common/form-field"
import { UserAvatar } from "@/components/common/user-avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useInviteProjectMember } from "@/features/project-members/hooks"
import { useActiveTenant, useCurrentUser } from "@/features/session/hooks"
import { useAllUsers } from "@/features/users/hooks"
import { fullName } from "@/lib/format"
import { errorMessage } from "@/lib/http/errors"
import type { Id } from "@/types/api"
import type { ProjectMember, Role } from "@/types/models"

const schema = z.object({
  email: z.email("Enter a valid email address"),
})

type InviteForm = z.infer<typeof schema>

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: Role[]
  /** Members already in this project, so an existing one is caught before submitting. */
  existingMembers: ProjectMember[]
}

/**
 * Invites a user to the project.
 *
 * The user must already exist on the platform: `POST /users` is open registration, so
 * creating an account on someone's behalf from here would let any project admin mint
 * platform accounts. Looking the address up first makes that boundary visible instead of
 * silently doing the wrong thing.
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
  roles,
  existingMembers,
}: InviteMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/*
          The body is a separate component so it unmounts with the dialog. Its lookup and
          role selection therefore reset by construction, rather than by an effect that
          re-runs on every `open` change and has to remember to clear each field.
        */}
        <InviteMemberForm
          onClose={() => onOpenChange(false)}
          roles={roles}
          existingMembers={existingMembers}
        />
      </DialogContent>
    </Dialog>
  )
}

function InviteMemberForm({
  onClose,
  roles,
  existingMembers,
}: {
  onClose: () => void
  roles: Role[]
  existingMembers: ProjectMember[]
}) {
  const { organizationId, projectId } = useActiveTenant()
  const currentUser = useCurrentUser()
  const inviteMember = useInviteProjectMember()

  const [lookupEmail, setLookupEmail] = useState<string | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  const lookupQuery = useAllUsers(
    { where: { email: lookupEmail ?? "" }, limit: 1 },
    { enabled: Boolean(lookupEmail) }
  )

  const foundUser = lookupQuery.data?.[0]
  const alreadyMember = foundUser
    ? existingMembers.some((member) => member.userId === foundUser._id)
    : false

  const onLookup = handleSubmit((values) =>
    setLookupEmail(values.email.trim().toLowerCase())
  )

  const toggleRole = (roleId: Id) =>
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId]
    )

  const submit = () => {
    if (
      !foundUser ||
      !organizationId ||
      !projectId ||
      !currentUser ||
      selectedRoleIds.length === 0
    ) {
      return
    }

    inviteMember.mutate(
      {
        organizationId,
        projectId,
        userId: foundUser._id,
        roleIds: selectedRoleIds,
        status: "invited",
        invitedBy: currentUser._id,
      },
      {
        onSuccess: () => {
          toast.success(`${fullName(foundUser)} invited`)
          onClose()
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite member</DialogTitle>
        <DialogDescription>
          Find an existing platform account, then choose the roles they hold
          here.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5">
        {inviteMember.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage(inviteMember.error)}
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onLookup} className="flex items-end gap-2" noValidate>
          <FormField
            label="Email"
            required
            error={errors.email?.message}
            className="flex-1"
          >
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="off"
                autoFocus
                {...register("email")}
              />
            )}
          </FormField>
          <Button
            type="submit"
            variant="outline"
            disabled={lookupQuery.isFetching}
          >
            {lookupQuery.isFetching ? (
              <Loader2Icon className="animate-spin" />
            ) : null}
            Find
          </Button>
        </form>

        {lookupEmail && !lookupQuery.isFetching ? (
          foundUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg border p-3">
                <UserAvatar user={foundUser} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {fullName(foundUser)}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {foundUser.email}
                  </p>
                </div>
                <CheckIcon className="size-4 text-emerald-600" />
              </div>

              {alreadyMember ? (
                <Alert>
                  <AlertDescription>
                    This user is already a member of the project. Change their
                    roles from the members table instead.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    Roles <span className="text-destructive">*</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Permissions are the union of every role selected.
                  </p>
                  <div className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-1">
                    {roles.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        This project has no roles yet. Create one first.
                      </p>
                    ) : (
                      roles.map((role) => (
                        <label
                          key={role._id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                        >
                          <Checkbox
                            checked={selectedRoleIds.includes(role._id)}
                            onCheckedChange={() => toggleRole(role._id)}
                          />
                          <span className="flex-1">{role.roleName}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No account found for that address. The person needs to register
                on the platform before they can be invited to a project.
              </AlertDescription>
            </Alert>
          )
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={
            !foundUser ||
            alreadyMember ||
            selectedRoleIds.length === 0 ||
            inviteMember.isPending
          }
        >
          <UserPlusIcon />
          {inviteMember.isPending ? "Inviting…" : "Send invitation"}
        </Button>
      </DialogFooter>
    </>
  )
}
