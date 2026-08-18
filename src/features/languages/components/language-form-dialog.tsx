import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
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
import { Switch } from "@/components/ui/switch"
import { useCreateLanguage } from "@/features/languages/hooks"
import { errorMessage } from "@/lib/http/errors"

const schema = z.object({
  code: z
    .string()
    .min(2, "At least 2 characters")
    .max(20)
    .regex(
      /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
      "A BCP 47 tag, e.g. en, ja, pt-BR"
    ),
  name: z.string().min(2, "At least 2 characters"),
  nativeName: z.string().min(1, "Required"),
  locale: z.string().min(2, "Required"),
  rtl: z.boolean(),
  sortOrder: z.number({ error: "Enter a number" }).int().min(0),
})

type LanguageForm = z.infer<typeof schema>

interface LanguageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Adds a language to the **global** catalogue.
 *
 * Deliberately create-only. Editing a language's code would orphan every translation
 * keyed by it across every project, and the console has no safe path for that — a
 * mistyped code is corrected by adding the right one and disabling the wrong one.
 */
export function LanguageFormDialog({
  open,
  onOpenChange,
}: LanguageFormDialogProps) {
  const createLanguage = useCreateLanguage()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LanguageForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      nativeName: "",
      locale: "",
      rtl: false,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, reset])

  const onSubmit = handleSubmit((values) => {
    createLanguage.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.name} added to the catalogue`)
        onOpenChange(false)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add language</DialogTitle>
          <DialogDescription>
            Languages are shared across every project on the platform.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5"
          noValidate
        >
          {createLanguage.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(createLanguage.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Code"
              required
              error={errors.code?.message}
              hint="BCP 47, e.g. pt-BR"
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("code")}
                  className="font-mono"
                  autoFocus
                />
              )}
            </FormField>

            <FormField
              label="Locale"
              required
              error={errors.locale?.message}
              hint="e.g. pt_BR"
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("locale")}
                  className="font-mono"
                />
              )}
            </FormField>
          </div>

          <FormField
            label="Name"
            required
            error={errors.name?.message}
            hint="In English"
          >
            {(props) => <Input {...props} {...register("name")} />}
          </FormField>

          <FormField
            label="Native name"
            required
            error={errors.nativeName?.message}
            hint="As speakers write it — 日本語, Português"
          >
            {(props) => <Input {...props} {...register("nativeName")} />}
          </FormField>

          <FormField label="Sort order" error={errors.sortOrder?.message}>
            {(props) => (
              <Input
                {...props}
                type="number"
                {...register("sortOrder", { valueAsNumber: true })}
              />
            )}
          </FormField>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Right to left</p>
              <p className="text-xs text-muted-foreground">
                Arabic, Hebrew, Farsi and similar.
              </p>
            </div>
            <Controller
              control={control}
              name="rtl"
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
          <Button onClick={onSubmit} disabled={createLanguage.isPending}>
            {createLanguage.isPending ? "Adding…" : "Add language"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
