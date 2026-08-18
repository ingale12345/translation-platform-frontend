import { useEffect, useRef, useState } from "react"

import { StatusChip } from "@/components/common/status-chip"
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
import { formatDateTime } from "@/lib/format"
import type { TranslationKey } from "@/types/models"

interface CellEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  translationKey: TranslationKey | undefined
  languageCode: string | undefined
  languageName: string | undefined
  /** The same key in the project's source language, shown for reference. */
  sourceValue?: string
  sourceLanguageName?: string
  isSaving: boolean
  onSave: (value: string) => void
}

/**
 * The roomy editor for a translation.
 *
 * The grid's inline editor is right for a button label; it is the wrong shape for a
 * paragraph, where a two-line box hides most of what you are editing. The pencil opens
 * this instead — the same value, with room to read it, the source string beside it for
 * reference, and no risk of losing the draft to a stray click on the grid.
 */
export function CellEditDialog({
  open,
  onOpenChange,
  translationKey,
  languageCode,
  languageName,
  sourceValue,
  sourceLanguageName,
  isSaving,
  onSave,
}: CellEditDialogProps) {
  const cell = languageCode
    ? translationKey?.translations[languageCode]
    : undefined
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load the current value each time the dialog opens on a cell, so reopening after a
  // cancel starts from what is stored rather than the abandoned draft.
  const cellKey =
    open && translationKey && languageCode
      ? `${translationKey._id}:${languageCode}`
      : null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  if (cellKey !== loadedKey) {
    setLoadedKey(cellKey)
    setDraft(cellKey ? (cell?.value ?? "") : "")
  }

  useEffect(() => {
    if (open) {
      // Focus at the end rather than selecting: this editor is for revising long text,
      // where select-all means one keystroke wipes the paragraph.
      const node = textareaRef.current
      node?.focus()
      node?.setSelectionRange(node.value.length, node.value.length)
    }
  }, [open])

  const isDirty = draft !== (cell?.value ?? "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">
              {translationKey
                ? `${translationKey.namespace}.${translationKey.key}`
                : ""}
            </span>
            <StatusChip status={cell?.status} size="sm" />
          </DialogTitle>
          <DialogDescription>
            {languageName ?? languageCode}
            {translationKey?.description
              ? ` · ${translationKey.description}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sourceValue ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                Source · {sourceLanguageName}
              </p>
              <p className="text-sm leading-relaxed">{sourceValue}</p>
            </div>
          ) : null}

          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={10}
            placeholder="Enter the translation…"
            className="resize-y leading-relaxed font-normal"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {draft.length} character{draft.length === 1 ? "" : "s"}
            </span>
            {cell?.updatedAt ? (
              <span>Last edited {formatDateTime(cell.updatedAt)}</span>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)} disabled={isSaving || !isDirty}>
            {isSaving ? "Saving…" : "Save translation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
