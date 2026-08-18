import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/common/form-field"
import { MultiSelect } from "@/components/common/multi-select"
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
import { SelectField } from "@/components/common/select-field"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateApplication,
  useUpdateApplication,
} from "@/features/applications/hooks"
import { useActiveTenant } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import type { Application, ApplicationType, Project } from "@/types/models"

/** Every platform the exporter knows how to write a bundle for. */
const APPLICATION_TYPES: ApplicationType[] = [
  "react",
  "angular",
  "vue",
  "flutter",
  "android",
  "ios",
  "java",
  "springboot",
  "node",
  "nestjs",
  "other",
]

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
  code: z
    .string()
    .min(2, "At least 2 characters")
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, digits and underscores only"),
  description: z.string().max(500).optional(),
  type: z.enum(APPLICATION_TYPES as [ApplicationType, ...ApplicationType[]]),
  defaultLanguage: z.string().min(2, "Pick a default language"),
  supportedLanguages: z.array(z.string()).min(1, "Pick at least one language"),
  apiEnabled: z.boolean(),
  apiVersion: z.string().min(1),
})

type ApplicationForm = z.infer<typeof schema>

interface ApplicationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent when creating. */
  application?: Application
  /** The languages this project has enabled — an app may only use a subset. */
  project: Project | undefined
  languageLabels: Map<string, { name: string; nativeName: string }>
}

/**
 * Create or edit an application.
 *
 * `code` is immutable after creation: it appears in the consumption API URL
 * (`/api/projects/…/applications/{code}/translations/…`), so changing it silently breaks
 * every deployed client that fetches translations by that path.
 */
export function ApplicationFormDialog({
  open,
  onOpenChange,
  application,
  project,
  languageLabels,
}: ApplicationFormDialogProps) {
  const { organizationId, projectId } = useActiveTenant()
  const createApplication = useCreateApplication()
  const updateApplication = useUpdateApplication()

  const isEdit = Boolean(application)
  const projectLanguages = project?.supportedLanguages ?? []

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ApplicationForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      type: "react",
      defaultLanguage: project?.defaultLanguage ?? "",
      supportedLanguages: project?.defaultLanguage
        ? [project.defaultLanguage]
        : [],
      apiEnabled: true,
      apiVersion: "v1",
    },
  })

  // Reset on open so a cancelled edit does not leak into the next one the user opens.
  useEffect(() => {
    if (!open) {
      return
    }

    reset(
      application
        ? {
            name: application.name,
            code: application.code,
            description: application.description ?? "",
            type: application.type,
            defaultLanguage: application.defaultLanguage,
            supportedLanguages: application.supportedLanguages,
            apiEnabled: application.apiEnabled,
            apiVersion: application.apiVersion,
          }
        : {
            name: "",
            code: "",
            description: "",
            type: "react",
            defaultLanguage: project?.defaultLanguage ?? "",
            supportedLanguages: project?.defaultLanguage
              ? [project.defaultLanguage]
              : [],
            apiEnabled: true,
            apiVersion: "v1",
          }
    )
  }, [open, application, project, reset])

  const supportedLanguages = watch("supportedLanguages")
  const mutation = isEdit ? updateApplication : createApplication

  const onSubmit = handleSubmit((values) => {
    if (!organizationId || !projectId) {
      return
    }

    const payload = {
      ...values,
      description: values.description || undefined,
      organizationId,
      projectId,
      // Archiving happens from the card menu, not this form — a status select here would
      // let someone archive an application while editing its name.
      status: application?.status ?? ("active" as const),
    }

    const handlers = {
      onSuccess: () => {
        toast.success(isEdit ? "Application updated" : `${values.name} created`)
        onOpenChange(false)
      },
      onError: (error: unknown) => toast.error(errorMessage(error)),
    }

    if (application) {
      // `code` is deliberately not sent: see the note on this component.
      const { code, ...patch } = payload
      void code
      updateApplication.mutate({ id: application._id, data: patch }, handlers)
      return
    }

    createApplication.mutate(payload, handlers)
  })

  const languageOptions = projectLanguages.map((code) => ({
    value: code,
    label: languageLabels.get(code)?.name ?? code,
    hint: code,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit application" : "New application"}
          </DialogTitle>
          <DialogDescription>
            An application owns its own keys, languages and export format.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="max-h-[60vh] space-y-4 overflow-y-auto px-1"
          noValidate
        >
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
                ? "The code appears in the consumption API URL and cannot be changed."
                : "Used in the consumption API URL. Uppercase, e.g. HQ_ADMIN."
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

          <FormField label="Platform" required error={errors.type?.message}>
            {(props) => (
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <SelectField
                    {...props}
                    value={field.value}
                    onChange={field.onChange}
                    options={APPLICATION_TYPES.map((type) => ({
                      value: type,
                      label: type,
                    }))}
                  />
                )}
              />
            )}
          </FormField>

          <FormField
            label="Languages"
            required
            error={errors.supportedLanguages?.message}
            hint="Only languages enabled on the project can be used here."
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
            label="Default language"
            required
            error={errors.defaultLanguage?.message}
            hint="Source language for this application. Must be one of the languages above."
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
                      label: languageLabels.get(code)?.name ?? code,
                      hint: code,
                    }))}
                  />
                )}
              />
            )}
          </FormField>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Consumption API</p>
              <p className="text-xs text-muted-foreground">
                Let this application fetch translations at runtime with an API
                token.
              </p>
            </div>
            <Controller
              control={control}
              name="apiEnabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
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
                : "Create application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
