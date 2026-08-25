import { AlertTriangleIcon, LoaderCircleIcon, ScissorsIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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
import { useCutVersion } from "@/features/translation-versions/hooks"
import { useActiveTenant } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import type { Application, TranslationVersion } from "@/types/models"

interface CutVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: Application | undefined
  /** The version currently live, so the dialog can say what this one follows. */
  published: TranslationVersion | null
  /** The highest version cut so far, published or not. */
  latest: TranslationVersion | null
}

/**
 * Freezes the current key set into the next version.
 *
 * This is the step that used to happen invisibly on every import, and moving it here is
 * the point: a release is something a person decides has happened, after the strings are
 * translated and reviewed — not a side effect of a developer running a build script.
 *
 * The dialog deliberately does not offer "publish immediately". Cutting is reversible in
 * the sense that nobody is affected by it; publishing is not. Collapsing them into one
 * button would put the irreversible half behind the reversible half's confirmation.
 */
export function CutVersionDialog({
  open,
  onOpenChange,
  application,
  published,
  latest,
}: CutVersionDialogProps) {
  const { organizationId, projectId } = useActiveTenant()
  const cut = useCutVersion()
  const [note, setNote] = useState("")

  const nextNumber = (latest?.version ?? 0) + 1

  const submit = () => {
    if (!application || !organizationId || !projectId) {
      return
    }

    cut.mutate(
      {
        organizationId,
        projectId,
        applicationId: application._id,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (version) => {
          toast.success(
            `Version ${version.version} frozen — ${version.statistics.total} keys`
          )
          setNote("")
          onOpenChange(false)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Freeze version {nextNumber}</DialogTitle>
          <DialogDescription>
            {application?.name} · records which keys belong to this release
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Every key currently in the working set is frozen into version{" "}
            {nextNumber}, including anything added since the last freeze and
            anything an import has disabled. Nothing ships yet — publishing this
            version is a separate step.
          </p>

          {published ? (
            <Alert>
              <AlertDescription>
                Version {published.version} stays live until you publish this
                one, so your applications are unaffected by freezing it.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangleIcon className="size-4" />
              <AlertDescription>
                Nothing has been published for this application yet, so it
                currently delivers whatever is active. Publishing version{" "}
                {nextNumber} is what starts pinning that to a release.
              </AlertDescription>
            </Alert>
          )}

          <FormField
            label="Note"
            hint="Why this release exists. Shown in the version list."
          >
            {(props) => (
              <Input
                {...props}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Sprint 12 sign-off"
                autoFocus
              />
            )}
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={cut.isPending || !application}>
            {cut.isPending ? (
              <>
                <LoaderCircleIcon className="animate-spin" /> Freezing…
              </>
            ) : (
              <>
                <ScissorsIcon /> Freeze version {nextNumber}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
