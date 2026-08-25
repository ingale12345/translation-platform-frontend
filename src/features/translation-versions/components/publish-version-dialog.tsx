import { AlertTriangleIcon, LoaderCircleIcon, RocketIcon } from "lucide-react"
import { toast } from "sonner"

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
import { usePublishVersion } from "@/features/translation-versions/hooks"
import { errorMessage } from "@/lib/http/errors"
import type { TranslationVersion } from "@/types/models"

interface PublishVersionDialogProps {
  version: TranslationVersion | null
  /** What is live right now, so the dialog can say what is being replaced. */
  current: TranslationVersion | null
  applicationName: string
  onOpenChange: (open: boolean) => void
}

/**
 * Confirms the one action that changes what users see.
 *
 * Publishing is cheap to do and expensive to get wrong, so the dialog states the
 * consequence in the two directions that actually matter — how many keys arrive, and how
 * many stop being served — rather than asking "are you sure?" over a version number.
 *
 * Rolling *back* is the same operation on an older version, which is why the copy works
 * for both and the confirm button does not say "publish" when the target is behind the
 * current one.
 */
export function PublishVersionDialog({
  version,
  current,
  applicationName,
  onOpenChange,
}: PublishVersionDialogProps) {
  const publish = usePublishVersion()

  const isRollback = Boolean(
    version && current && version.version < current.version
  )

  const confirm = () => {
    if (!version) {
      return
    }

    publish.mutate(version._id, {
      onSuccess: () => {
        toast.success(
          isRollback
            ? `Rolled ${applicationName} back to version ${version.version}`
            : `Version ${version.version} is live for ${applicationName}`
        )
        onOpenChange(false)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  return (
    <Dialog open={Boolean(version)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {version ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {isRollback ? "Roll back to" : "Publish"} version{" "}
                {version.version}
              </DialogTitle>
              <DialogDescription>
                {applicationName} · {version.statistics.total} keys,{" "}
                {version.statistics.ready} signed off
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm">
                {current ? (
                  <>
                    Exports and the runtime API currently serve{" "}
                    <strong>version {current.version}</strong>. They will serve{" "}
                    <strong>version {version.version}</strong> immediately after
                    this.
                  </>
                ) : (
                  <>
                    Nothing has been published for this application yet. From
                    now on exports and the runtime API will serve exactly the key
                    set of version {version.version}.
                  </>
                )}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="Added"
                  value={version.statistics.added}
                  tone="text-emerald-600"
                />
                <Stat
                  label="Restored"
                  value={version.statistics.restored}
                  tone="text-violet-600"
                />
                <Stat
                  label="Dropped"
                  value={version.statistics.disabled}
                  tone={
                    version.statistics.disabled > 0
                      ? "text-destructive"
                      : undefined
                  }
                />
              </div>

              {version.statistics.disabled > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon className="size-4" />
                  <AlertDescription>
                    {version.statistics.disabled} key
                    {version.statistics.disabled === 1 ? "" : "s"} dropped in
                    this version will stop being delivered. Anything still asking
                    for {version.statistics.disabled === 1 ? "it" : "them"} at
                    runtime gets nothing back.
                  </AlertDescription>
                </Alert>
              ) : null}

              {isRollback ? (
                <Alert>
                  <AlertDescription>
                    Rolling back changes only which key set is delivered. No
                    translation is reverted — every string keeps the text and
                    status it has now.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirm}
                disabled={publish.isPending}
                variant={
                  version.statistics.disabled > 0 ? "destructive" : "default"
                }
              >
                {publish.isPending ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" /> Publishing…
                  </>
                ) : (
                  <>
                    <RocketIcon />
                    {isRollback
                      ? `Roll back to v${version.version}`
                      : `Publish v${version.version}`}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </p>
    </div>
  )
}
