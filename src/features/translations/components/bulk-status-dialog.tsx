import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { FormField } from "@/components/common/form-field"
import { StatusChip } from "@/components/common/status-chip"
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
import { Textarea } from "@/components/ui/textarea"
import { useBulkStatus } from "@/features/translations/hooks"
import { errorMessage } from "@/lib/http/errors"
import { statusMeta } from "@/lib/translation-status"
import type { Id } from "@/types/api"
import type { TranslationStatus } from "@/types/models"
import { SKIP_REASON_LABEL } from "@/types/operations"
import type {
  BulkStatusCell,
  BulkStatusResult,
  BulkStatusSkip,
} from "@/types/operations"
import type { SelectionSummary } from "../cell-selection"

const STATUS_ORDER: Array<TranslationStatus | "MISSING"> = [
  "MISSING",
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "PUBLISHED",
]

interface BulkStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: TranslationStatus
  projectId: Id | null
  applicationId: Id | null
  /** The exact cells ticked in the grid. */
  cells: BulkStatusCell[]
  /** What those cells currently are, for the confirmation summary. */
  summary: SelectionSummary
  onDone: () => void
}

/**
 * Confirms and runs a bulk status change.
 *
 * The selection already says which cells — it is a set of key × language pairs the user
 * ticked — so this dialog no longer asks for a language scope. What it adds is the two
 * things a toolbar button cannot: a last look at what the selection actually contains
 * before a status moves, and somewhere to show what the server refused to do afterwards.
 * A run that silently moves 37 of 40 cells is the failure mode worth designing against.
 */
export function BulkStatusDialog({
  open,
  onOpenChange,
  status,
  projectId,
  applicationId,
  cells,
  summary,
  onDone,
}: BulkStatusDialogProps) {
  const [note, setNote] = useState("")
  const [result, setResult] = useState<BulkStatusResult | null>(null)
  const bulkStatus = useBulkStatus()

  const meta = statusMeta(status)

  const close = () => {
    setResult(null)
    setNote("")
    onOpenChange(false)
  }

  const run = () => {
    if (!projectId || !applicationId || cells.length === 0) {
      return
    }

    bulkStatus.mutate(
      {
        projectId,
        applicationId,
        status,
        cells,
        comment: note.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setResult(data)

          if (data.updated > 0) {
            toast.success(
              `${data.updated} cell${data.updated === 1 ? "" : "s"} moved to ${meta.label}`
            )
          }

          onDone()
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/*
              After a run the selection has been cleared, so `summary` is empty — the
              heading has to describe the result rather than a selection that no longer
              exists, or it reads "Set 0 cells to Published" over a list of what moved.
            */}
            {result
              ? `Moved ${result.updated} of ${result.examined} cell${result.examined === 1 ? "" : "s"} to`
              : `Set ${summary.cells} cell${summary.cells === 1 ? "" : "s"} to`}
            <StatusChip status={status} />
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Here is what changed."
              : `Across ${summary.keys} key${summary.keys === 1 ? "" : "s"}. The server checks each cell and skips the ones it cannot move.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <BulkResult result={result} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground">
                What you selected, by current status
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {STATUS_ORDER.filter((item) => summary.byStatus.has(item)).map(
                  (item) => (
                    <span key={item} className="flex items-center gap-1">
                      <StatusChip status={item} size="sm" />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {summary.byStatus.get(item)}
                      </span>
                    </span>
                  )
                )}
              </div>
            </div>

            <FormField
              label="Note"
              hint="Recorded on every history entry this creates — useful when someone asks why forty cells moved at once."
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="e.g. Sprint 12 sign-off"
                />
              )}
            </FormField>

            {status === "PUBLISHED" ? (
              <Alert>
                <AlertDescription>
                  Only approved cells can be published. Anything still in draft
                  or review is skipped and listed afterwards.
                </AlertDescription>
              </Alert>
            ) : null}

            {summary.empty > 0 && status !== "REVIEW" ? (
              <Alert>
                <AlertDescription>
                  {summary.empty} selected cell
                  {summary.empty === 1 ? " has" : "s have"} no text yet.
                  Approving or publishing an empty string would ship a blank
                  under a status that says a human checked it, so
                  {summary.empty === 1 ? " it is" : " they are"} skipped.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                onClick={run}
                disabled={bulkStatus.isPending || cells.length === 0}
              >
                {bulkStatus.isPending ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" /> Applying…
                  </>
                ) : (
                  `Set ${meta.label}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkResult({ result }: { result: BulkStatusResult }) {
  // Grouped by reason: forty rows saying "no translation yet" is noise, one line saying
  // "40 cells: no translation yet" with the keys under it is an answer.
  const groups = useMemo(() => {
    const byReason = new Map<BulkStatusSkip["reason"], BulkStatusSkip[]>()

    for (const skip of result.skipped) {
      const list = byReason.get(skip.reason) ?? []
      list.push(skip)
      byReason.set(skip.reason, list)
    }

    return Array.from(byReason.entries())
  }, [result.skipped])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Checked" value={result.examined} />
        <Stat label="Moved" value={result.updated} tone="text-emerald-600" />
        <Stat
          label="Skipped"
          value={result.skipped.length}
          tone={result.skipped.length > 0 ? "text-amber-600" : undefined}
        />
      </div>

      {result.skipped.length === 0 ? (
        <Alert>
          <CheckCircle2Icon className="size-4" />
          <AlertDescription>
            Every selected cell moved to {result.status.toLowerCase()}.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {groups.map(([reason, skips]) => (
            <div key={reason} className="rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <AlertTriangleIcon className="size-3.5 text-amber-500" />
                {skips.length} skipped — {SKIP_REASON_LABEL[reason]}
              </p>
              <ul className="mt-2 space-y-1">
                {skips.slice(0, 12).map((skip) => (
                  <li
                    key={`${skip.translationKeyId}:${skip.languageCode}`}
                    className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                  >
                    <span className="truncate">{skip.key}</span>
                    <span className="shrink-0">· {skip.languageCode}</span>
                    {skip.currentStatus ? (
                      <StatusChip status={skip.currentStatus} size="sm" />
                    ) : null}
                  </li>
                ))}
                {skips.length > 12 ? (
                  <li className="text-[11px] text-muted-foreground">
                    …and {skips.length - 12} more
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className="rounded-lg border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </p>
    </div>
  )
}
