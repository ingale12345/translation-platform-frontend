import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/common/form-field"
import { MultiSelect } from "@/components/common/multi-select"
import { SelectField } from "@/components/common/select-field"
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
import { useAllLanguages } from "@/features/languages/hooks"
import { useCreateProject, useUpdateProject } from "@/features/projects/hooks"
import {
  useActiveOrganizationId,
  useMemberships,
} from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import type { Project } from "@/types/models"

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
  code: z
    .string()
    .min(2, "At least 2 characters")
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, digits and underscores only"),
  description: z.string().max(500).optional(),
  defaultLanguage: z.string().min(2, "Pick a source language"),
  supportedLanguages: z.array(z.string()).min(1, "Pick at least one language"),
})

type ProjectForm = z.infer<typeof schema>

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent when creating. */
  project?: Project
}

/**
 * Create or edit a project.
 *
 * Creating one is not just an insert: the server gives the new project its own copy of
 * the system roles and, unless the creator already holds organization-level authority,
 * makes them its manager. Without that a project is invisible the moment it is created —
 * no roles to grant anything, no members to hold them.
 *
 * `code` is immutable after creation, for the same reason as an application's: it is a
 * stable identifier other things are keyed on.
 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: ProjectFormDialogProps) {
  const organizationId = useActiveOrganizationId()
  const memberships = useMemberships()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const languagesQuery = useAllLanguages({ sortAsc: "sortOrder" })

  const isEdit = Boolean(project)
  const languages = languagesQuery.data ?? []

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      defaultLanguage: "en",
      supportedLanguages: ["en"],
    },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    reset(
      project
        ? {
            name: project.name,
            code: project.code,
            description: project.description ?? "",
            defaultLanguage: project.defaultLanguage,
            supportedLanguages: project.supportedLanguages,
          }
        : {
            name: "",
            code: "",
            description: "",
            defaultLanguage: "en",
            supportedLanguages: ["en"],
          }
    )
  }, [open, project, reset])

  const supportedLanguages = watch("supportedLanguages")
  const mutation = isEdit ? updateProject : createProject

  // Creating a project needs an organization. Any membership carries it, and with one
  // organization per installation they all carry the same one.
  const resolvedOrganizationId =
    organizationId ?? memberships.data?.[0]?.organizationId ?? null

  const onSubmit = handleSubmit((values) => {
    if (!resolvedOrganizationId) {
      toast.error("No organization found for this account")
      return
    }

    const handlers = {
      onSuccess: () => {
        toast.success(
          isEdit
            ? "Project updated"
            : `${values.name} created — assign a manager to staff it`
        )
        void memberships.refetch()
        onOpenChange(false)
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    }

    if (project) {
      // `code` is deliberately not sent — see the note on this component.
      const { code, ...patch } = values
      void code

      updateProject.mutate(
        {
          id: project._id,
          data: { ...patch, description: patch.description || undefined },
        },
        handlers
      )
      return
    }

    createProject.mutate(
      {
        ...values,
        description: values.description || undefined,
        organizationId: resolvedOrganizationId,
        status: "active",
        settings: { defaultNamespace: "common" },
      },
      handlers
    )
  })

  const languageOptions = languages.map((language) => ({
    value: language.code,
    label: language.name,
    hint: language.nativeName,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Project settings apply to every application inside it."
              : "A project groups the applications one team ships together. It starts with its own set of roles."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {mutation.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(mutation.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField label="Name" required error={errors.name?.message}>
            {(props) => <Input {...props} {...register("name")} autoFocus />}
          </FormField>

          <FormField
            label="Code"
            required
            error={errors.code?.message}
            hint={
              isEdit
                ? "The code identifies the project and cannot be changed."
                : "Short identifier, e.g. BANKING."
            }
          >
            {(props) => (
              <Input
                {...props}
                {...register("code")}
                disabled={isEdit}
                className="font-mono"
              />
            )}
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            {(props) => (
              <Textarea {...props} {...register("description")} rows={2} />
            )}
          </FormField>

          <FormField
            label="Languages"
            required
            error={errors.supportedLanguages?.message}
            hint="Applications in this project can use any of these."
          >
            {(props) => (
              <Controller
                control={control}
                name="supportedLanguages"
                render={({ field }) => (
                  <MultiSelect
                    {...props}
                    options={languageOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select languages"
                  />
                )}
              />
            )}
          </FormField>

          <FormField
            label="Source language"
            required
            error={errors.defaultLanguage?.message}
            hint="The language keys are authored in."
          >
            {(props) => (
              <Controller
                control={control}
                name="defaultLanguage"
                render={({ field }) => (
                  <SelectField
                    {...props}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select a language"
                    options={supportedLanguages.map((code) => ({
                      value: code,
                      label:
                        languages.find((language) => language.code === code)
                          ?.name ?? code,
                      hint: code,
                    }))}
                  />
                )}
              />
            )}
          </FormField>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
