import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, Loader2Icon, SaveIcon, UserPlusIcon } from "lucide-react"
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
import { SelectField } from "@/components/common/select-field"
import {
  useInviteProjectMember,
  useUpdateProjectMember,
} from "@/features/project-members/hooks"
import { useActiveTenant, usePermissions } from "@/features/session/hooks"
import { useAllUsers, useCreateUser, useUpdateUser } from "@/features/users/hooks"
import { fullName } from "@/lib/format"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type { ProjectMember, Role, User } from "@/types/models"

const MEMBER_STATUSES = ["active", "invited", "inactive", "blocked"] as const

const accountSchema = z.object({
  email: z.email("Enter a valid email address"),
  firstName: z.string().min(1, "Required").max(60),
  lastName: z.string().min(1, "Required").max(60),
  // Long enough to be worth setting, short enough that an admin will actually type it and
  // read it out. The account holder changes it from Settings afterwards.
  password: z.string().min(8, "At least 8 characters").max(128),
})

const profileSchema = z.object({
  firstName: z.string().min(1, "Required").max(60),
  lastName: z.string().min(1, "Required").max(60),
  phone: z.string().max(15).optional().or(z.literal("")),
  password: z
    .string()
    .max(128)
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || value.length >= 8, {
      message: "At least 8 characters",
    }),
})

type AccountForm = z.infer<typeof accountSchema>
type ProfileForm = z.infer<typeof profileSchema>

/** `null` opens the dialog in create mode; a row opens it on that person. */
export interface EditingMember {
  member: ProjectMember
  user: User | undefined
  roles: Role[]
}

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: Role[]
  existingMembers: ProjectMember[]
  editing: EditingMember | null
}

/**
 * Adds a member, or edits one.
 *
 * There is no email invitation flow, deliberately: an installation runs inside one firm's
 * own systems and may have no mail infrastructure at all, so the platform admin creates
 * the account outright — address, name, and a first password they hand over — instead of
 * sending a link and hoping it arrives. "Send invitation" was a button that never sent
 * anything.
 *
 * Two ways in, because they are genuinely different acts:
 *
 * - **New account** mints a platform account *and* adds it to this project. Only a
 *   platform admin can do it: accounts belong to the organization, and the server refuses
 *   a project manager here (`authorizeUsers` asks the organization tier).
 * - **Existing account** adds somebody who already has one — which is how a manager staffs
 *   their project, and how one person ends up on several.
 */
export function MemberFormDialog({
  open,
  onOpenChange,
  roles,
  existingMembers,
  editing,
}: MemberFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/*
          Keyed so switching between "add" and editing a specific person remounts the body:
          its form state and role selection reset by construction, rather than through an
          effect that has to remember to clear every field.
        */}
        {editing ? (
          <EditMemberForm
            key={`edit:${editing.member._id}`}
            editing={editing}
            roles={roles}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <AddMemberForm
            key="add"
            roles={roles}
            existingMembers={existingMembers}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- *
 * Add
 * -------------------------------------------------------------------------- */

function AddMemberForm({
  roles,
  existingMembers,
  onClose,
}: {
  roles: Role[]
  existingMembers: ProjectMember[]
  onClose: () => void
}) {
  const { can, isOrganizationMember } = usePermissions()
  // Minting an account is organization authority. Offering the tab to a manager who will
  // only be refused by the server is worse than not offering it.
  const canCreateAccounts =
    isOrganizationMember && can(ENTITLEMENTS.PROJECT_MEMBERS, "create")

  const [mode, setMode] = useState<"new" | "existing">(
    canCreateAccounts ? "new" : "existing"
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add member</DialogTitle>
        <DialogDescription>
          {mode === "new"
            ? "Create the account and hand over the password — there is no invitation email."
            : "Find an account that already exists, then choose the roles they hold here."}
        </DialogDescription>
      </DialogHeader>

      {canCreateAccounts ? (
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <ModeTab
            isActive={mode === "new"}
            onClick={() => setMode("new")}
            label="New account"
          />
          <ModeTab
            isActive={mode === "existing"}
            onClick={() => setMode("existing")}
            label="Existing account"
          />
        </div>
      ) : null}

      {mode === "new" ? (
        <NewAccountForm roles={roles} onClose={onClose} />
      ) : (
        <ExistingAccountForm
          roles={roles}
          existingMembers={existingMembers}
          onClose={onClose}
        />
      )}
    </>
  )
}

function ModeTab({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-background shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

function NewAccountForm({
  roles,
  onClose,
}: {
  roles: Role[]
  onClose: () => void
}) {
  const { organizationId, projectId } = useActiveTenant()
  const createUser = useCreateUser()
  const addMember = useInviteProjectMember()
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { email: "", firstName: "", lastName: "", password: "" },
  })

  const isPending = createUser.isPending || addMember.isPending
  const error = createUser.error ?? addMember.error

  const submit = handleSubmit(async (values) => {
    if (!organizationId || !projectId || selectedRoleIds.length === 0) {
      return
    }

    try {
      // Two writes, in order: the account has to exist before it can hold a membership.
      // If the second fails the account survives, which is recoverable — the admin adds
      // them from the "Existing account" tab — where the reverse would leave a membership
      // pointing at nobody.
      const user = await createUser.mutateAsync({
        email: values.email.trim().toLowerCase(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        password: values.password,
        status: "active",
        emailVerified: true,
      })

      await addMember.mutateAsync({
        organizationId,
        projectId,
        userId: user._id,
        roleIds: selectedRoleIds,
        status: "active",
        joinedAt: new Date().toISOString(),
      })

      toast.success(`${fullName(user)} added — give them the password you set`)
      onClose()
    } catch (cause) {
      toast.error(errorMessage(cause))
    }
  })

  return (
    <>
      <form
        id="new-account-form"
        onSubmit={submit}
        className="max-h-[60vh] space-y-4 overflow-y-auto px-0.5"
        noValidate
      >
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" required error={errors.firstName?.message}>
            {(props) => <Input {...props} autoFocus {...register("firstName")} />}
          </FormField>
          <FormField label="Last name" required error={errors.lastName?.message}>
            {(props) => <Input {...props} {...register("lastName")} />}
          </FormField>
        </div>

        <FormField label="Email" required error={errors.email?.message}>
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="off"
              {...register("email")}
            />
          )}
        </FormField>

        <FormField
          label="Password"
          required
          error={errors.password?.message}
          hint="Set it here and pass it on. They can change it from Settings once they are in."
        >
          {(props) => (
            <Input
              {...props}
              type="text"
              autoComplete="new-password"
              {...register("password")}
            />
          )}
        </FormField>

        <RolePicker
          roles={roles}
          selectedRoleIds={selectedRoleIds}
          onChange={setSelectedRoleIds}
        />
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="new-account-form"
          disabled={isPending || selectedRoleIds.length === 0}
        >
          {isPending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
          {isPending ? "Creating…" : "Create member"}
        </Button>
      </DialogFooter>
    </>
  )
}

function ExistingAccountForm({
  roles,
  existingMembers,
  onClose,
}: {
  roles: Role[]
  existingMembers: ProjectMember[]
  onClose: () => void
}) {
  const { organizationId, projectId } = useActiveTenant()
  const addMember = useInviteProjectMember()

  const [lookupEmail, setLookupEmail] = useState<string | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.email("Enter a valid email address") })),
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

  const submit = () => {
    if (!foundUser || !organizationId || !projectId || selectedRoleIds.length === 0) {
      return
    }

    addMember.mutate(
      {
        organizationId,
        projectId,
        userId: foundUser._id,
        roleIds: selectedRoleIds,
        status: "active",
        joinedAt: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(`${fullName(foundUser)} added to the project`)
          onClose()
        },
        onError: (cause) => toast.error(errorMessage(cause)),
      }
    )
  }

  return (
    <>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-0.5">
        {addMember.error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(addMember.error)}</AlertDescription>
          </Alert>
        ) : null}

        <form
          onSubmit={handleSubmit((values) =>
            setLookupEmail(values.email.trim().toLowerCase())
          )}
          className="flex items-end gap-2"
          noValidate
        >
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
          <Button type="submit" variant="outline" disabled={lookupQuery.isFetching}>
            {lookupQuery.isFetching ? <Loader2Icon className="animate-spin" /> : null}
            Find
          </Button>
        </form>

        {lookupEmail && !lookupQuery.isFetching ? (
          foundUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg border p-3">
                <UserAvatar user={foundUser} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fullName(foundUser)}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {foundUser.email}
                  </p>
                </div>
                <CheckIcon className="size-4 text-emerald-600" />
              </div>

              {alreadyMember ? (
                <Alert>
                  <AlertDescription>
                    Already a member of this project. Edit their roles from the
                    members table instead.
                  </AlertDescription>
                </Alert>
              ) : (
                <RolePicker
                  roles={roles}
                  selectedRoleIds={selectedRoleIds}
                  onChange={setSelectedRoleIds}
                />
              )}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                No account for that address. Use the <b>New account</b> tab to
                create one — or ask a platform admin to, if you cannot see it.
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
            addMember.isPending
          }
        >
          <UserPlusIcon />
          {addMember.isPending ? "Adding…" : "Add to project"}
        </Button>
      </DialogFooter>
    </>
  )
}

/* -------------------------------------------------------------------------- *
 * Edit
 * -------------------------------------------------------------------------- */

/**
 * Edits the person and their membership together.
 *
 * They are two records — the account belongs to the organization, the membership to this
 * project — but from a members table they read as one thing, and an admin fixing a
 * misspelled surname should not have to know which collection it lives in. Only the parts
 * that actually changed are sent, so a manager who may edit roles but not accounts does
 * not trip the users guard by resubmitting an unchanged name.
 */
function EditMemberForm({
  editing,
  roles,
  onClose,
}: {
  editing: EditingMember
  roles: Role[]
  onClose: () => void
}) {
  const { can, isOrganizationMember } = usePermissions()
  const canEditAccount =
    isOrganizationMember && can(ENTITLEMENTS.PROJECT_MEMBERS, "update")

  const updateUser = useUpdateUser()
  const updateMember = useUpdateProjectMember()

  const { member, user } = editing
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id[]>(member.roleIds)
  const [status, setStatus] = useState<string>(member.status)

  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      phone: user?.phone ?? "",
      password: "",
    },
  })

  const isPending = updateUser.isPending || updateMember.isPending
  const error = updateUser.error ?? updateMember.error

  const submit = handleSubmit(async (values) => {
    try {
      if (canEditAccount && user) {
        const profile: Record<string, unknown> = {}

        if (dirtyFields.firstName) profile.firstName = values.firstName.trim()
        if (dirtyFields.lastName) profile.lastName = values.lastName.trim()
        if (dirtyFields.phone) profile.phone = values.phone?.trim() || undefined
        // An empty box means "leave it alone", not "set an empty password".
        if (values.password) profile.password = values.password

        if (Object.keys(profile).length > 0) {
          await updateUser.mutateAsync({ id: user._id, data: profile })
        }
      }

      const membership: Record<string, unknown> = {}
      const rolesChanged =
        selectedRoleIds.length !== member.roleIds.length ||
        selectedRoleIds.some((id) => !member.roleIds.includes(id))

      if (rolesChanged) membership.roleIds = selectedRoleIds
      if (status !== member.status) membership.status = status

      if (Object.keys(membership).length > 0) {
        await updateMember.mutateAsync({ id: member._id, data: membership })
      }

      toast.success(`${fullName(user)} updated`)
      onClose()
    } catch (cause) {
      toast.error(errorMessage(cause))
    }
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit member</DialogTitle>
        <DialogDescription>
          <span className="font-mono text-xs">{user?.email}</span>
        </DialogDescription>
      </DialogHeader>

      <form
        id="edit-member-form"
        onSubmit={submit}
        className="max-h-[60vh] space-y-4 overflow-y-auto px-0.5"
        noValidate
      >
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        {canEditAccount ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="First name"
                required
                error={errors.firstName?.message}
              >
                {(props) => <Input {...props} {...register("firstName")} />}
              </FormField>
              <FormField
                label="Last name"
                required
                error={errors.lastName?.message}
              >
                {(props) => <Input {...props} {...register("lastName")} />}
              </FormField>
            </div>

            <FormField label="Phone" error={errors.phone?.message}>
              {(props) => <Input {...props} {...register("phone")} />}
            </FormField>

            <FormField
              label="Set a new password"
              error={errors.password?.message}
              hint="Leave blank to keep the current one."
            >
              {(props) => (
                <Input
                  {...props}
                  type="text"
                  autoComplete="new-password"
                  {...register("password")}
                />
              )}
            </FormField>
          </>
        ) : (
          <Alert>
            <AlertDescription>
              Account details are managed by a platform admin. You can change
              this person&rsquo;s roles and status in the project.
            </AlertDescription>
          </Alert>
        )}

        <FormField label="Membership status">
          {(props) => (
            <SelectField
              {...props}
              value={status}
              onChange={setStatus}
              options={MEMBER_STATUSES.map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              }))}
            />
          )}
        </FormField>

        <RolePicker
          roles={roles}
          selectedRoleIds={selectedRoleIds}
          onChange={setSelectedRoleIds}
        />
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-member-form"
          disabled={isPending || selectedRoleIds.length === 0}
        >
          {isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  )
}

/* -------------------------------------------------------------------------- *
 * Shared
 * -------------------------------------------------------------------------- */

function RolePicker({
  roles,
  selectedRoleIds,
  onChange,
}: {
  roles: Role[]
  selectedRoleIds: Id[]
  onChange: (roleIds: Id[]) => void
}) {
  const toggle = (roleId: Id) =>
    onChange(
      selectedRoleIds.includes(roleId)
        ? selectedRoleIds.filter((id) => id !== roleId)
        : [...selectedRoleIds, roleId]
    )

  return (
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
                onCheckedChange={() => toggle(role._id)}
              />
              <span className="flex-1">{role.roleName}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
