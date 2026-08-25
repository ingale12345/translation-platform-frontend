import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  Loader2Icon,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/common/form-field"
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
import { apiTokensService } from "@/services"
import { useActiveTenant } from "@/features/session/hooks"
import { env } from "@/config/env"
import { errorMessage } from "@/lib/http/errors"
import type { Application, ApiTokenCreated } from "@/types/models"

const schema = z.object({
  name: z.string().min(2, "Give it a name you will recognise later").max(100),
  applicationId: z.string().min(1, "Choose an application"),
  expiresAt: z.string().optional().or(z.literal("")),
})

type TokenForm = z.infer<typeof schema>

interface CreateTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
  onCreated: () => void
}

/**
 * Issues a token, and shows the secret once.
 *
 * The one-time reveal is not a UX flourish — it is forced by the storage. The server keeps
 * a SHA-256 hash and nothing else, so after this dialog closes there is no copy of the
 * secret anywhere to show. Saying that plainly here is the difference between an admin
 * writing it down now and one discovering next week that "reveal token" does not exist.
 */
export function CreateTokenDialog({
  open,
  onOpenChange,
  applications,
  onCreated,
}: CreateTokenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <CreateTokenBody
          key={open ? "open" : "closed"}
          applications={applications}
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateTokenBody({
  applications,
  onClose,
  onCreated,
}: {
  applications: Application[]
  onClose: () => void
  onCreated: () => void
}) {
  const { organizationId, projectId } = useActiveTenant()
  const [issued, setIssued] = useState<ApiTokenCreated | null>(null)
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TokenForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      applicationId: applications[0]?._id ?? "",
      expiresAt: "",
    },
  })

  const applicationId = watch("applicationId")

  const submit = handleSubmit(async (values) => {
    if (!organizationId || !projectId) {
      return
    }

    setPending(true)
    setError(null)

    try {
      // Called through the service rather than a mutation hook: the response carries the
      // one field that exists nowhere else, and it has to reach this component intact
      // rather than be normalised into the list cache.
      const created = (await apiTokensService.create({
        organizationId,
        projectId,
        applicationId: values.applicationId,
        name: values.name.trim(),
        permissions: ["translations:read"],
        enabled: true,
        ...(values.expiresAt
          ? { expiresAt: new Date(values.expiresAt).toISOString() }
          : {}),
      })) as ApiTokenCreated

      setIssued(created)
      onCreated()
    } catch (cause) {
      setError(cause)
      toast.error(errorMessage(cause))
    } finally {
      setPending(false)
    }
  })

  if (issued) {
    return (
      <IssuedToken
        issued={issued}
        application={applications.find((item) => item._id === issued.applicationId)}
        onClose={onClose}
      />
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New API token</DialogTitle>
        <DialogDescription>
          A read-only credential scoped to one application. It fetches whatever
          that application&rsquo;s published version currently delivers.
        </DialogDescription>
      </DialogHeader>

      <form
        id="create-token-form"
        onSubmit={submit}
        className="space-y-4"
        noValidate
      >
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          label="Name"
          required
          error={errors.name?.message}
          hint="Where this token lives — “Storefront production”, “iOS build”."
        >
          {(props) => <Input {...props} autoFocus {...register("name")} />}
        </FormField>

        <FormField
          label="Application"
          required
          error={errors.applicationId?.message}
          hint="The token can read this application's strings and no others."
        >
          {(props) => (
            <SelectField
              {...props}
              value={applicationId}
              onChange={(value) => setValue("applicationId", value as string)}
              options={applications.map((application) => ({
                value: application._id,
                label: application.name,
                hint: application.type,
              }))}
            />
          )}
        </FormField>

        <FormField
          label="Expires"
          error={errors.expiresAt?.message}
          hint="Leave blank for a token that does not expire."
        >
          {(props) => <Input {...props} type="date" {...register("expiresAt")} />}
        </FormField>
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-token-form"
          disabled={isPending || applications.length === 0}
        >
          {isPending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
          {isPending ? "Issuing…" : "Issue token"}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * The secret, plus the request that uses it.
 *
 * Showing the curl alongside the token is deliberate: the token is only useful once
 * somebody knows what to do with it, and an admin who has to go and find the endpoint in
 * documentation will paste the secret into a chat window while they look.
 */
function IssuedToken({
  issued,
  application,
  onClose,
}: {
  issued: ApiTokenCreated
  application: Application | undefined
  onClose: () => void
}) {
  const [copied, setCopied] = useState<"token" | "curl" | null>(null)

  const language = application?.defaultLanguage ?? "en"
  const curl = `curl -H "X-Api-Key: ${issued.token}" \\\n  "${env.apiUrl}/translations/bundle?languageCode=${language}&format=nested"`

  const copy = async (what: "token" | "curl", text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error("Could not copy — select the text and copy it manually")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{issued.name}</DialogTitle>
        <DialogDescription>
          Copy it now. This is the only time it can be shown.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Alert>
          <AlertTriangleIcon className="size-4" />
          <AlertDescription>
            The server stores a one-way hash of this token, not the token — so
            there is no way to look it up again. If it is lost, revoke this one
            and issue another.
          </AlertDescription>
        </Alert>

        <div>
          <p className="mb-1.5 text-sm font-medium">Token</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted px-3 py-2 font-mono text-sm">
              {issued.token}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy("token", issued.token)}
            >
              {copied === "token" ? <CheckIcon /> : <CopyIcon />}
              {copied === "token" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-medium">Fetching translations with it</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy("curl", curl)}
            >
              {copied === "curl" ? <CheckIcon /> : <CopyIcon />}
              {copied === "curl" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-[11px] leading-relaxed">
            {curl}
          </pre>
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            <p>
              Two filters decide what comes back:{" "}
              <strong className="font-medium text-foreground">
                the published version
              </strong>{" "}
              chooses which keys exist, and each cell must be signed off to carry
              a value. A key added since the last publish is not in the response,
              even once its translation is approved.
            </p>
            <p>
              The response includes{" "}
              <code className="font-mono">publishedVersion</code> so a client can
              tell which release it received. Add{" "}
              <code className="font-mono">&amp;includeApproved=true</code> for a
              staging build that wants the next release early.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </>
  )
}
