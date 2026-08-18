import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
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
import { SelectField } from "@/components/common/select-field"
import { Textarea } from "@/components/ui/textarea"
import { useActiveTenant } from "@/features/session/hooks"
import { useCreateTemplate } from "@/features/templates/hooks"
import { errorMessage } from "@/lib/http/errors"
import { DEFAULT_CONFIGS } from "@/lib/template-preview"
import type { Template, TemplateFileType } from "@/types/models"

const FILE_TYPES: TemplateFileType[] = [
  "JSON",
  "PROPERTIES",
  "ARB",
  "XML",
  "YAML",
  "CSV",
  "CUSTOM",
]

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
  code: z
    .string()
    .min(2, "At least 2 characters")
    .max(50)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, digits and underscores only"),
  description: z.string().max(500).optional(),
  fileType: z.enum(FILE_TYPES as [TemplateFileType, ...TemplateFileType[]]),
  fileExtension: z.string().min(1, "Required").max(20),
})

type TemplateForm = z.infer<typeof schema>

interface TemplateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (template: Template) => void
}

/**
 * Creates a template with a starting config for its file type.
 *
 * The row patterns are seeded from `DEFAULT_CONFIGS` rather than left blank: a JSON
 * template that does not know it needs braces and a comma separator is a broken template,
 * and nobody writes that from memory. The author refines it in the editor afterwards.
 */
export function TemplateFormDialog({
  open,
  onOpenChange,
  onCreated,
}: TemplateFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Separate component so the form unmounts — and resets — with the dialog. */}
        <TemplateForm
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  )
}

function TemplateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated?: (template: Template) => void
}) {
  const { organizationId, projectId } = useActiveTenant()
  const createTemplate = useCreateTemplate()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TemplateForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      fileType: "JSON",
      fileExtension: "json",
    },
  })

  const onSubmit = handleSubmit((values) => {
    if (!organizationId || !projectId) {
      return
    }

    const defaults = DEFAULT_CONFIGS[values.fileType]

    createTemplate.mutate(
      {
        organizationId,
        projectId,
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        fileType: values.fileType,
        fileExtension: values.fileExtension,
        importConfig: {
          enabled: true,
          fileRow: defaults.exportRow,
          separator: defaults.separator,
          encoding: "UTF-8",
          hasHeader: values.fileType === "CSV",
        },
        exportConfig: {
          enabled: true,
          fileStart: defaults.start,
          fileRow: defaults.exportRow,
          fileEnd: defaults.end,
          separator: defaults.separator,
          encoding: "UTF-8",
          includeEmptyValues: false,
        },
        isSystem: false,
        status: "ACTIVE",
      },
      {
        onSuccess: (created) => {
          toast.success(`${created.name} created`)
          onCreated?.(created)
          onClose()
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>New template</DialogTitle>
        <DialogDescription>
          Starts from a sensible config for the file type. Refine it in the
          editor.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={onSubmit}
        className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5"
        noValidate
      >
        {createTemplate.error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage(createTemplate.error)}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField label="Name" required error={errors.name?.message}>
          {(props) => <Input {...props} {...register("name")} autoFocus />}
        </FormField>

        <FormField label="Code" required error={errors.code?.message}>
          {(props) => (
            <Input {...props} {...register("code")} className="font-mono" />
          )}
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="File type"
            required
            error={errors.fileType?.message}
          >
            {(props) => (
              <Controller
                control={control}
                name="fileType"
                render={({ field }) => (
                  <SelectField
                    {...props}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                      // Keep the extension in step with the type — a JSON template with a
                      // .properties extension exports files nothing can open.
                      setValue(
                        "fileExtension",
                        DEFAULT_CONFIGS[value as TemplateFileType].extension
                      )
                    }}
                    options={FILE_TYPES.map((type) => ({
                      value: type,
                      label: type,
                    }))}
                  />
                )}
              />
            )}
          </FormField>

          <FormField
            label="Extension"
            required
            error={errors.fileExtension?.message}
          >
            {(props) => (
              <Input
                {...props}
                {...register("fileExtension")}
                className="font-mono"
              />
            )}
          </FormField>
        </div>

        <FormField label="Description" error={errors.description?.message}>
          {(props) => (
            <Textarea {...props} {...register("description")} rows={2} />
          )}
        </FormField>
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={createTemplate.isPending}>
          {createTemplate.isPending ? "Creating…" : "Create template"}
        </Button>
      </DialogFooter>
    </>
  )
}
