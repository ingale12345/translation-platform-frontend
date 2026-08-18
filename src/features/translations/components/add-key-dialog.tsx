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
import { useCreateTranslationKey } from "@/features/translations/hooks"
import { useActiveTenant, useCurrentUser } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import type { Id } from "@/types/api"
import type { Application, TranslationValue } from "@/types/models"

const schema = z.object({
  namespace: z.string().min(1, "Required").max(100),
  key: z
    .string()
    .min(1, "Required")
    .max(500)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Letters, digits, dots, dashes and underscores only"
    ),
  description: z.string().max(1000).optional(),
  tags: z.string().optional(),
})

type AddKeyForm = z.infer<typeof schema>

interface AddKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: Application | undefined
  /** Keys already on this page, so a duplicate is caught before the round-trip. */
  existingKeys: string[]
  languageLabels: Map<string, string>
}

/**
 * Creates a translation key across every language the application supports.
 *
 * Only the **source language** gets a value here. Asking for all of them up front is how
 * placeholder text ends up published — the other languages start `MISSING`, which is what
 * puts them in a translator's queue.
 */
export function AddKeyDialog({
  open,
  onOpenChange,
  application,
  existingKeys,
  languageLabels,
}: AddKeyDialogProps) {
  const { organizationId, projectId } = useActiveTenant()
  const user = useCurrentUser()
  const createKey = useCreateTranslationKey()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<AddKeyForm>({
    resolver: zodResolver(schema),
    defaultValues: { namespace: "common", key: "", description: "", tags: "" },
  })

  useEffect(() => {
    if (open) {
      reset({ namespace: "common", key: "", description: "", tags: "" })
    }
  }, [open, reset])

  const sourceLanguage = application?.defaultLanguage
  const otherLanguages = (application?.supportedLanguages ?? []).filter(
    (code) => code !== sourceLanguage
  )
  const keyValue = watch("key")

  const onSubmit = handleSubmit((values) => {
    if (!application || !organizationId || !projectId || !user) {
      return
    }

    if (existingKeys.includes(values.key)) {
      setError("key", {
        message: "A key with this name already exists on this page",
      })
      return
    }

    // Every supported language gets an entry, so the grid has a cell to render and the
    // coverage meter counts this key as outstanding rather than ignoring it.
    const translations = Object.fromEntries(
      application.supportedLanguages.map((code): [string, TranslationValue] => [
        code,
        {
          value: "",
          status: "MISSING",
          updatedBy: user._id as Id,
          updatedAt: new Date().toISOString(),
        },
      ])
    )

    createKey.mutate(
      {
        organizationId,
        projectId,
        applicationId: application._id,
        namespace: values.namespace,
        key: values.key,
        description: values.description || undefined,
        tags: values.tags
          ? values.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        translations,
      },
      {
        onSuccess: () => {
          toast.success(`${values.key} created`)
          onOpenChange(false)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add translation key</DialogTitle>
          <DialogDescription>
            {application ? `In ${application.name}.` : ""} Translations start
            empty and are filled in from the grid.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="max-h-[65vh] space-y-4 overflow-y-auto px-0.5"
          noValidate
        >
          {createKey.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(createKey.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <FormField
              label="Namespace"
              required
              error={errors.namespace?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("namespace")}
                  className="font-mono"
                />
              )}
            </FormField>

            <FormField
              label="Key"
              required
              error={errors.key?.message}
              hint="How your code refers to this string"
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("key")}
                  className="font-mono"
                  placeholder="login_button"
                  autoFocus
                />
              )}
            </FormField>
          </div>

          {keyValue ? (
            <p className="rounded-md bg-muted/50 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
              {watch("namespace")}.{keyValue}
            </p>
          ) : null}

          <FormField
            label="Description"
            error={errors.description?.message}
            hint="Context for translators — where this appears, and what it means"
          >
            {(props) => (
              <Textarea {...props} {...register("description")} rows={2} />
            )}
          </FormField>

          <FormField
            label="Tags"
            error={errors.tags?.message}
            hint="Comma separated"
          >
            {(props) => (
              <Input
                {...props}
                {...register("tags")}
                placeholder="ui, button"
              />
            )}
          </FormField>

          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Created as <span className="font-medium">Missing</span> in{" "}
            {sourceLanguage ? (
              <>
                <span className="font-medium">
                  {languageLabels.get(sourceLanguage) ?? sourceLanguage}
                </span>
                {otherLanguages.length > 0
                  ? ` and ${otherLanguages.length} other language${otherLanguages.length === 1 ? "" : "s"}`
                  : ""}
              </>
            ) : (
              "every supported language"
            )}
            . Fill them in from the grid.
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={createKey.isPending || !application}
          >
            {createKey.isPending ? "Creating…" : "Create key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
