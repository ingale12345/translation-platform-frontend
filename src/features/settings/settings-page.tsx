import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangleIcon } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/common/form-field"
import { PageHeader } from "@/components/common/page-header"
import { QueryBoundary } from "@/components/common/query-boundary"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useProject, useUpdateProject } from "@/features/projects/hooks"
import { useActiveProjectId, usePermissions } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import { ENTITLEMENTS } from "@/lib/rbac"

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
  description: z.string().max(500).optional(),
  logo: z.string().optional(),
  settings: z.object({
    allowMachineTranslation: z.boolean(),
    allowClientTranslation: z.boolean(),
    allowApiAccess: z.boolean(),
    autoTranslateNewKeys: z.boolean(),
    defaultNamespace: z.string().max(100).optional(),
  }),
})

type SettingsForm = z.infer<typeof schema>

/**
 * Project configuration.
 *
 * Languages are deliberately absent — they live on the Languages screen, where the global
 * catalogue is visible alongside them. Splitting one model across two screens is worse
 * than the extra click.
 */
export function SettingsPage() {
  const projectId = useActiveProjectId()
  const { can } = usePermissions()
  const canUpdate = can(ENTITLEMENTS.SETTINGS, "update")

  const projectQuery = useProject(projectId ?? undefined)
  const updateProject = useUpdateProject()
  const project = projectQuery.data

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      logo: "",
      settings: {
        allowMachineTranslation: false,
        allowClientTranslation: false,
        allowApiAccess: false,
        autoTranslateNewKeys: false,
        defaultNamespace: "common",
      },
    },
  })

  // Fill the form once the project arrives, and again after a save so `isDirty` resets.
  useEffect(() => {
    if (!project) {
      return
    }

    reset({
      name: project.name,
      description: project.description ?? "",
      logo: project.logo ?? "",
      settings: {
        allowMachineTranslation:
          project.settings?.allowMachineTranslation ?? false,
        allowClientTranslation:
          project.settings?.allowClientTranslation ?? false,
        allowApiAccess: project.settings?.allowApiAccess ?? false,
        autoTranslateNewKeys: project.settings?.autoTranslateNewKeys ?? false,
        defaultNamespace: project.settings?.defaultNamespace ?? "common",
      },
    })
  }, [project, reset])

  const onSubmit = handleSubmit((values) => {
    if (!project) {
      return
    }

    updateProject.mutate(
      {
        id: project._id,
        data: {
          name: values.name,
          description: values.description || undefined,
          logo: values.logo || undefined,
          settings: values.settings,
        },
      },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  })

  return (
    <div className="p-5">
      <PageHeader
        title="Settings"
        description={
          project
            ? `Configuration for ${project.name}.`
            : "Project configuration."
        }
        actions={
          canUpdate ? (
            <Button
              onClick={onSubmit}
              disabled={!isDirty || updateProject.isPending}
            >
              {updateProject.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null
        }
      />

      <QueryBoundary
        isLoading={projectQuery.isLoading}
        error={projectQuery.error}
        onRetry={projectQuery.refetch}
      >
        <form onSubmit={onSubmit} className="max-w-2xl" noValidate>
          {updateProject.error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {errorMessage(updateProject.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          {!canUpdate ? (
            <Alert className="mb-4">
              <AlertDescription>
                You can view these settings but not change them.
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="danger">Danger zone</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
              <FormField
                label="Project name"
                required
                error={errors.name?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("name")}
                    disabled={!canUpdate}
                  />
                )}
              </FormField>

              <FormField
                label="Project code"
                hint="The code is fixed at creation — it identifies the project in the consumption API."
              >
                {(props) => (
                  <Input
                    {...props}
                    value={project?.code ?? ""}
                    disabled
                    className="font-mono"
                  />
                )}
              </FormField>

              <FormField
                label="Description"
                error={errors.description?.message}
              >
                {(props) => (
                  <Textarea
                    {...props}
                    {...register("description")}
                    rows={3}
                    disabled={!canUpdate}
                  />
                )}
              </FormField>

              <FormField label="Logo URL" error={errors.logo?.message}>
                {(props) => (
                  <Input
                    {...props}
                    {...register("logo")}
                    disabled={!canUpdate}
                  />
                )}
              </FormField>

              <FormField
                label="Default namespace"
                error={errors.settings?.defaultNamespace?.message}
                hint="Pre-filled when a new translation key is created."
              >
                {(props) => (
                  <Input
                    {...props}
                    {...register("settings.defaultNamespace")}
                    disabled={!canUpdate}
                    className="font-mono"
                  />
                )}
              </FormField>
            </TabsContent>

            <TabsContent value="features" className="mt-4 space-y-3">
              <FeatureToggle
                control={control}
                name="settings.allowApiAccess"
                disabled={!canUpdate}
                title="Consumption API"
                description="Let applications fetch translations at runtime with an API token."
              />
              <FeatureToggle
                control={control}
                name="settings.allowClientTranslation"
                disabled={!canUpdate}
                title="Client translation"
                description="Allow external client accounts to edit translations in this project."
              />
              <FeatureToggle
                control={control}
                name="settings.allowMachineTranslation"
                disabled={!canUpdate}
                title="Machine translation"
                description="Offer machine-translated suggestions in the grid. Requires a provider to be configured."
              />
              <FeatureToggle
                control={control}
                name="settings.autoTranslateNewKeys"
                disabled={!canUpdate}
                title="Auto-translate new keys"
                description="Machine-translate a key into every language as soon as it is created. Results start as drafts."
              />
            </TabsContent>

            <TabsContent value="danger" className="mt-4">
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangleIcon className="size-4 text-destructive" />
                    Archive project
                  </CardTitle>
                  <CardDescription>
                    Archiving hides the project from every member and stops the
                    consumption API serving its translations. Nothing is
                    deleted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertDescription>
                      Not wired up yet. Archiving needs a confirmation flow that
                      names how many applications and keys go with it — see
                      docs/UI_PLAN.md §3.13.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </QueryBoundary>
    </div>
  )
}

function FeatureToggle({
  control,
  name,
  title,
  description,
  disabled,
}: {
  control: ReturnType<typeof useForm<SettingsForm>>["control"]
  name:
    | "settings.allowMachineTranslation"
    | "settings.allowClientTranslation"
    | "settings.allowApiAccess"
    | "settings.autoTranslateNewKeys"
  title: string
  description: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        )}
      />
    </div>
  )
}
