import {
  AlertTriangleIcon,
  FileTextIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  UploadIcon,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { FormField } from "@/components/common/form-field"
import { SelectField } from "@/components/common/select-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { useAllApplications } from "@/features/applications/hooks"
import { useActiveProjectId } from "@/features/session/hooks"
import { useAllTemplates } from "@/features/templates/hooks"
import { useRunImport } from "@/features/translation-versions/hooks"
import { errorMessage } from "@/lib/http/errors"
import { cn } from "@/lib/utils"
import type { Id } from "@/types/api"
import type {
  ImportChange,
  ImportChangeKind,
  TranslationImportResult,
} from "@/types/operations"

/** Formats `parseTranslationFile` can read. Anything else is refused, by name. */
const IMPORTABLE = new Set(["JSON", "ARB", "PROPERTIES", "CSV"])

/** A file bigger than this is almost certainly not a translation file. */
const MAX_BYTES = 8_000_000

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultApplicationId?: Id | null
}

/**
 * The import wizard: choose, preview, commit.
 *
 * The preview step is not decoration. An import is the only operation on this platform
 * that can take strings *away* — a key absent from the file gets disabled — and the person
 * running it is usually a developer who exported from a branch and has no idea the file is
 * missing half the app. So the flow refuses to write anything until a dry run has been
 * shown and acknowledged, and the number it puts in front of the user first is the count
 * of keys about to disappear, not the count about to be added.
 *
 * Both steps call the same endpoint with the same payload, differing only in `dryRun`.
 * That is deliberate: a preview produced by separate code would eventually disagree with
 * the thing it claims to predict.
 *
 * What this dialog is careful never to imply is that importing ships anything. It changes
 * the working set; freezing a version and publishing it are separate decisions made
 * elsewhere, by people who may not be the person importing.
 */
export function ImportDialog({
  open,
  onOpenChange,
  defaultApplicationId,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-3xl">
        <ImportBody
          key={open ? "open" : "closed"}
          defaultApplicationId={defaultApplicationId}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ImportBody({
  defaultApplicationId,
  onClose,
}: {
  defaultApplicationId?: Id | null
  onClose: () => void
}) {
  const projectId = useActiveProjectId()
  const runImport = useRunImport()
  const fileInput = useRef<HTMLInputElement>(null)

  const [applicationId, setApplicationId] = useState<Id | null>(
    defaultApplicationId ?? null
  )
  const [templateId, setTemplateId] = useState<Id | null>(null)
  const [languageCode, setLanguageCode] = useState<string | null>(null)
  const [defaultNamespace, setDefaultNamespace] = useState("common")
  const [note, setNote] = useState("")
  const [file, setFile] = useState<{ name: string; content: string } | null>(
    null
  )
  const [preview, setPreview] = useState<TranslationImportResult | null>(null)
  const [applied, setApplied] = useState<TranslationImportResult | null>(null)

  const applicationsQuery = useAllApplications(
    { where: { projectId: projectId ?? "", status: "active" }, sortAsc: "name" },
    { enabled: Boolean(projectId) }
  )
  const templatesQuery = useAllTemplates(
    { where: { projectId: projectId ?? "", status: "ACTIVE" }, sortAsc: "name" },
    { enabled: Boolean(projectId) }
  )

  const applications = useMemo(
    () => applicationsQuery.data ?? [],
    [applicationsQuery.data]
  )
  const application =
    applications.find((item) => item._id === applicationId) ?? applications[0]

  // Only templates whose format the parser understands *and* that have not been marked
  // import-disabled. An option here that fails on submit is worse than no option.
  const templates = useMemo(
    () =>
      (templatesQuery.data ?? []).filter(
        (item) =>
          IMPORTABLE.has(item.fileType) && item.importConfig?.enabled !== false
      ),
    [templatesQuery.data]
  )

  const languages = application?.supportedLanguages ?? []
  const template =
    templates.find((item) => item._id === templateId) ?? templates[0]
  const effectiveLanguage =
    languageCode && languages.includes(languageCode)
      ? languageCode
      : (application?.defaultLanguage ?? languages[0] ?? null)

  const isSourceLanguage = effectiveLanguage === application?.defaultLanguage

  const readFile = async (picked: File) => {
    if (picked.size > MAX_BYTES) {
      toast.error(
        `${picked.name} is ${(picked.size / 1_000_000).toFixed(1)} MB — the limit is 8 MB`
      )
      return
    }

    try {
      setFile({ name: picked.name, content: await picked.text() })
      setPreview(null)
    } catch (cause) {
      toast.error(errorMessage(cause))
    }
  }

  const request = () => ({
    projectId: projectId as Id,
    applicationId: application?._id as Id,
    templateId: template?._id as Id,
    languageCode: effectiveLanguage ?? undefined,
    fileName: file?.name ?? "",
    content: file?.content ?? "",
    defaultNamespace: defaultNamespace.trim() || undefined,
    note: note.trim() || undefined,
  })

  const ready = Boolean(projectId && application && template && file)

  const runPreview = () => {
    if (!ready) {
      return
    }

    runImport.mutate(
      { ...request(), dryRun: true },
      {
        onSuccess: setPreview,
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  const commit = () => {
    if (!ready) {
      return
    }

    runImport.mutate(
      { ...request(), dryRun: false },
      {
        onSuccess: (result) => {
          setApplied(result)
          toast.success(
            `${result.statistics.added} added, ${result.statistics.disabled} disabled`
          )
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  if (applied) {
    return <ImportApplied result={applied} onClose={onClose} />
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import translations</DialogTitle>
        <DialogDescription>
          The file describes what the code contains now. Keys missing from it are
          disabled, not deleted — and nothing reaches your applications until a
          version is frozen and published.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Application" required>
            {(props) => (
              <SelectField
                {...props}
                value={application?._id ?? null}
                onChange={(value) => {
                  setApplicationId(value as Id)
                  setLanguageCode(null)
                  setPreview(null)
                }}
                placeholder="Select an application"
                options={applications.map((item) => ({
                  value: item._id,
                  label: item.name,
                  hint: item.type,
                }))}
              />
            )}
          </FormField>

          <FormField
            label="Format"
            required
            hint="How to read the file. Only importable formats are listed."
          >
            {(props) => (
              <SelectField
                {...props}
                value={template?._id ?? null}
                onChange={(value) => {
                  setTemplateId(value as Id)
                  setPreview(null)
                }}
                placeholder="Select a template"
                options={templates.map((item) => ({
                  value: item._id,
                  label: item.name,
                  hint: `.${item.fileExtension}`,
                }))}
              />
            )}
          </FormField>

          <FormField
            label="Language"
            required
            hint={
              isSourceLanguage
                ? "The source language — this file defines the key set."
                : undefined
            }
          >
            {(props) => (
              <SelectField
                {...props}
                value={effectiveLanguage}
                onChange={(value) => {
                  setLanguageCode(value as string)
                  setPreview(null)
                }}
                placeholder="Select a language"
                options={languages.map((code) => ({
                  value: code,
                  label: code,
                  hint:
                    code === application?.defaultLanguage ? "source" : undefined,
                }))}
              />
            )}
          </FormField>

          <FormField
            label="Default namespace"
            hint="Used for keys the file gives no dotted prefix."
          >
            {(props) => (
              <Input
                {...props}
                value={defaultNamespace}
                onChange={(event) => {
                  setDefaultNamespace(event.target.value)
                  setPreview(null)
                }}
                placeholder="common"
              />
            )}
          </FormField>
        </div>

        {templates.length === 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              This project has no import-enabled template in a readable format.
              JSON, ARB, .properties and CSV can be imported — create a template
              under Templates first.
            </AlertDescription>
          </Alert>
        ) : null}

        {!isSourceLanguage && application ? (
          <Alert>
            <AlertTriangleIcon className="size-4" />
            <AlertDescription>
              {effectiveLanguage} is not {application.name}&rsquo;s source
              language. Importing a translated file still reconciles the key set,
              so keys missing from it will be disabled. Import the source
              language ({application.defaultLanguage}) if you only meant to add
              translations.
            </AlertDescription>
          </Alert>
        ) : null}

        <FileDrop
          file={file}
          accept={template ? `.${template.fileExtension}` : undefined}
          inputRef={fileInput}
          onPick={readFile}
          onClear={() => {
            setFile(null)
            setPreview(null)
          }}
        />

        <FormField label="Note" hint="Recorded on the version — “sprint 12 strings”.">
          {(props) => (
            <Input
              {...props}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
            />
          )}
        </FormField>

        {preview ? <ImportPreview result={preview} /> : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>

        {preview ? (
          <>
            <Button
              variant="outline"
              onClick={runPreview}
              disabled={runImport.isPending}
            >
              <RotateCcwIcon /> Re-check
            </Button>
            <Button
              onClick={commit}
              disabled={runImport.isPending}
              variant={preview.statistics.disabled > 0 ? "destructive" : "default"}
            >
              {runImport.isPending ? (
                <>
                  <LoaderCircleIcon className="animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <UploadIcon /> Apply to working set
                </>
              )}
            </Button>
          </>
        ) : (
          <Button onClick={runPreview} disabled={!ready || runImport.isPending}>
            {runImport.isPending ? (
              <>
                <LoaderCircleIcon className="animate-spin" /> Checking…
              </>
            ) : (
              <>Preview changes</>
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

/**
 * The file picker.
 *
 * Drag-and-drop *and* a button, because the two populations that use this page differ: a
 * developer drags the file straight out of their editor, and a manager who was sent one
 * looks for a button. Supporting only one strands the other.
 */
function FileDrop({
  file,
  accept,
  inputRef,
  onPick,
  onClear,
}: {
  file: { name: string; content: string } | null
  accept?: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (file: File) => void
  onClear: () => void
}) {
  const [isOver, setOver] = useState(false)

  if (file) {
    const lines = file.content.split("\n").length

    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium">{file.name}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {(new Blob([file.content]).size / 1024).toFixed(1)} KB · {lines}{" "}
            lines
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Choose another
        </Button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)

        const dropped = event.dataTransfer.files[0]

        if (dropped) {
          onPick(dropped)
        }
      }}
      className={cn(
        "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <UploadIcon className="mx-auto mb-2 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">Drop the translation file here</p>
      <p className="mb-3 text-xs text-muted-foreground">
        or pick one — up to 8 MB
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0]

          if (picked) {
            onPick(picked)
          }

          // Cleared so picking the same file twice still fires a change event — which is
          // exactly what someone does after editing the file and coming back.
          event.target.value = ""
        }}
      />
    </div>
  )
}

const CHANGE_TONE: Record<ImportChangeKind, string> = {
  added: "text-emerald-600",
  updated: "text-sky-600",
  restored: "text-violet-600",
  disabled: "text-destructive",
  unchanged: "text-muted-foreground",
}

/** What the import will do, with the destructive part first. */
function ImportPreview({ result }: { result: TranslationImportResult }) {
  const { statistics } = result
  const notable = result.changes.filter((item) => item.change !== "unchanged")

  // Disabled rows lead. Everything else is additive and reversible; this is the only part
  // that removes strings from the application.
  const ordered = [
    ...notable.filter((item) => item.change === "disabled"),
    ...notable.filter((item) => item.change !== "disabled"),
  ]

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Preview — nothing has been written
        </p>
        <Badge variant="outline">{result.statistics.total} keys in file</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="In file" value={statistics.total} />
        <Stat label="New" value={statistics.added} tone="text-emerald-600" />
        <Stat label="Changed" value={statistics.updated} tone="text-sky-600" />
        <Stat
          label="Restored"
          value={statistics.restored}
          tone="text-violet-600"
        />
        <Stat
          label="Disabled"
          value={statistics.disabled}
          tone={statistics.disabled > 0 ? "text-destructive" : undefined}
        />
      </div>

      {statistics.disabled > 0 ? (
        <Alert variant="destructive">
          <AlertTriangleIcon className="size-4" />
          <AlertDescription>
            {statistics.disabled} key{statistics.disabled === 1 ? "" : "s"} in
            this application {statistics.disabled === 1 ? "is" : "are"} not in
            the file. {statistics.disabled === 1 ? "It" : "They"} will be
            disabled — kept with all translations and history, and hidden from
            the grid. Applications keep receiving{" "}
            {statistics.disabled === 1 ? "it" : "them"} until a version cut after
            this import is published. Importing a file again with{" "}
            {statistics.disabled === 1 ? "that key" : "those keys"} brings{" "}
            {statistics.disabled === 1 ? "it" : "them"} back whole.
          </AlertDescription>
        </Alert>
      ) : null}

      {statistics.manualUntouched > 0 ? (
        <p className="text-xs text-muted-foreground">
          {statistics.manualUntouched} key
          {statistics.manualUntouched === 1 ? "" : "s"} added in the console
          {statistics.manualUntouched === 1 ? " is" : " are"} not in the file and
          {statistics.manualUntouched === 1 ? " was" : " were"} left alone —
          only imported keys are reconciled.
        </p>
      ) : null}

      {result.errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            {result.errors.length} line
            {result.errors.length === 1 ? "" : "s"} could not be read and will be
            skipped:
            <ul className="mt-1.5 space-y-0.5">
              {result.errors.slice(0, 5).map((error, index) => (
                <li key={index} className="font-mono text-[11px]">
                  {error.line !== undefined ? `L${error.line} · ` : ""}
                  {error.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {ordered.length > 0 ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <tbody>
              {ordered.map((change) => (
                <ChangeRow
                  key={`${change.namespace}.${change.key}`}
                  change={change}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nothing changes — the file matches what is already here.
        </p>
      )}

      {notable.length >= 500 ? (
        <p className="text-[11px] text-muted-foreground">
          Showing the first 500 changes. The import applies all of them.
        </p>
      ) : null}
    </div>
  )
}

function ChangeRow({ change }: { change: ImportChange }) {
  return (
    <tr className="border-b last:border-0">
      <td className="w-32 px-3 py-1.5 align-top">
        <span className={cn("font-medium", CHANGE_TONE[change.change])}>
          {change.change}
        </span>
      </td>
      <td className="px-3 py-1.5 align-top font-mono">
        <span className="text-muted-foreground">{change.namespace}.</span>
        {change.key}
      </td>
      <td className="max-w-0 px-3 py-1.5 align-top">
        {change.change === "updated" ? (
          <div className="space-y-0.5">
            <p className="truncate text-muted-foreground line-through">
              {change.oldValue || "(empty)"}
            </p>
            <p className="truncate">{change.newValue}</p>
          </div>
        ) : (
          <p className="truncate text-muted-foreground">
            {change.change === "disabled"
              ? change.oldValue || "(empty)"
              : change.newValue || "(empty)"}
          </p>
        )}
      </td>
    </tr>
  )
}

/** The receipt, and what still has to happen for any of it to matter. */
function ImportApplied({
  result,
  onClose,
}: {
  result: TranslationImportResult
  onClose: () => void
}) {
  const { statistics } = result

  return (
    <>
      <DialogHeader>
        <DialogTitle>Working set updated</DialogTitle>
        <DialogDescription>
          Translations now reflects the file. Your applications do not — that
          takes a version.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="New" value={statistics.added} tone="text-emerald-600" />
          <Stat label="Changed" value={statistics.updated} tone="text-sky-600" />
          <Stat
            label="Restored"
            value={statistics.restored}
            tone="text-violet-600"
          />
          <Stat
            label="Disabled"
            value={statistics.disabled}
            tone={statistics.disabled > 0 ? "text-destructive" : undefined}
          />
        </div>

        <Alert>
          <AlertDescription>
            Nothing has shipped. Translate and review these strings, then freeze
            a version on the Versions page and publish it — that is the point at
            which exports and the runtime API start delivering this key set.
          </AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </>
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
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  )
}
