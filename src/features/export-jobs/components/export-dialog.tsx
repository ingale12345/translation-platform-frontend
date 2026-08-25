import { DownloadIcon, InfoIcon, LoaderCircleIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

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
import { useAllApplications } from "@/features/applications/hooks"
import { useRenderExport } from "@/features/export-jobs/hooks"
import { useAllTemplates } from "@/features/templates/hooks"
import { useActiveProjectId } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"
import { downloadTextFile } from "@/lib/download"
import type { Id } from "@/types/api"
import type { TranslationExportResult } from "@/types/operations"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selects the application the user was already looking at. */
  defaultApplicationId?: Id | null
  languageLabels?: Map<string, string>
}

/**
 * Starts an export and hands the file to the browser.
 *
 * The rule the summary exists to make visible: **only approved and published cells are
 * exported.** Everything else comes out empty, so a bundle can never carry a string
 * nobody signed off on. That is a surprising outcome the first time it happens — a
 * translator sees their work missing from the file — so the result panel names how many
 * values were withheld and why, rather than reporting a bare success.
 */
export function ExportDialog({
  open,
  onOpenChange,
  defaultApplicationId,
  languageLabels,
}: ExportDialogProps) {
  const projectId = useActiveProjectId()
  const renderExport = useRenderExport()

  const [applicationId, setApplicationId] = useState<Id | null>(
    defaultApplicationId ?? null
  )
  const [templateId, setTemplateId] = useState<Id | null>(null)
  const [languageCode, setLanguageCode] = useState<string | null>(null)
  const [result, setResult] = useState<TranslationExportResult | null>(null)

  const applicationsQuery = useAllApplications(
    {
      where: { projectId: projectId ?? "", status: "active" },
      sortAsc: "name",
    },
    { enabled: Boolean(projectId) }
  )
  const templatesQuery = useAllTemplates(
    {
      where: { projectId: projectId ?? "", status: "ACTIVE" },
      sortAsc: "name",
    },
    { enabled: Boolean(projectId) }
  )

  const applications = useMemo(
    () => applicationsQuery.data ?? [],
    [applicationsQuery.data]
  )
  const application =
    applications.find((item) => item._id === applicationId) ?? applications[0]

  // Only templates that can actually write a file — an import-only template in this list
  // would be an option that fails on submit.
  const templates = useMemo(
    () =>
      (templatesQuery.data ?? []).filter((item) => item.exportConfig.enabled),
    [templatesQuery.data]
  )

  const languages = application?.supportedLanguages ?? []
  const effectiveTemplateId = templateId ?? templates[0]?._id ?? null
  const effectiveLanguage =
    languageCode && languages.includes(languageCode)
      ? languageCode
      : (application?.defaultLanguage ?? languages[0] ?? null)

  const close = () => {
    setResult(null)
    onOpenChange(false)
  }

  const run = () => {
    if (
      !projectId ||
      !application ||
      !effectiveTemplateId ||
      !effectiveLanguage
    ) {
      return
    }

    renderExport.mutate(
      {
        projectId,
        applicationId: application._id,
        templateId: effectiveTemplateId,
        languageCode: effectiveLanguage,
      },
      {
        onSuccess: (data) => {
          setResult(data)
          downloadTextFile(data.fileName, data.content)
          toast.success(`${data.fileName} downloaded`)
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export translations</DialogTitle>
          <DialogDescription>
            One file, one language. Two filters apply: the file contains the keys
            in the published version, and only cells that are approved or signed
            off carry a value.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ExportSummary result={result} />
        ) : (
          <div className="space-y-4">
            <FormField label="Application" required>
              {(props) => (
                <SelectField
                  {...props}
                  value={application?._id ?? null}
                  onChange={(value) => {
                    setApplicationId(value as Id)
                    setLanguageCode(null)
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

            <FormField label="Language" required>
              {(props) => (
                <SelectField
                  {...props}
                  value={effectiveLanguage}
                  onChange={(value) => setLanguageCode(value as string)}
                  placeholder="Select a language"
                  options={languages.map((code) => ({
                    value: code,
                    label: languageLabels?.get(code) ?? code,
                    hint: code,
                  }))}
                />
              )}
            </FormField>

            <FormField
              label="Format"
              required
              hint="Templates define the file layout. Manage them under Templates."
            >
              {(props) => (
                <SelectField
                  {...props}
                  value={effectiveTemplateId}
                  onChange={(value) => setTemplateId(value as Id)}
                  placeholder="Select a template"
                  options={templates.map((item) => ({
                    value: item._id,
                    label: item.name,
                    hint: `.${item.fileExtension}`,
                  }))}
                />
              )}
            </FormField>

            {templates.length === 0 ? (
              <Alert variant="destructive">
                <AlertDescription>
                  This project has no export-enabled template. Create one under
                  Templates first.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  downloadTextFile(result.fileName, result.content)
                }
              >
                <DownloadIcon /> Download again
              </Button>
              <Button onClick={close}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                onClick={run}
                disabled={
                  renderExport.isPending ||
                  !application ||
                  !effectiveTemplateId ||
                  !effectiveLanguage
                }
              >
                {renderExport.isPending ? (
                  <>
                    <LoaderCircleIcon className="animate-spin" /> Building…
                  </>
                ) : (
                  <>
                    <DownloadIcon /> Export
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExportSummary({ result }: { result: TranslationExportResult }) {
  const { statistics } = result

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm">{result.fileName}</p>
        {/*
          Which snapshot this file is of. Without it, "why is my new string missing"
          has no checkable answer — the key may simply not be in the live version yet.
        */}
        <p className="text-xs text-muted-foreground">
          {result.publishedVersion === null
            ? "no published version — all active keys"
            : `keys from version ${result.publishedVersion}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Keys" value={statistics.total} />
        <Stat
          label="Exported"
          value={statistics.translated}
          tone="text-emerald-600"
        />
        <Stat
          label="Empty"
          value={statistics.missing}
          tone={statistics.missing > 0 ? "text-amber-600" : undefined}
        />
      </div>

      {statistics.withheld > 0 ? (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertDescription>
            {statistics.withheld} translation
            {statistics.withheld === 1 ? " was" : "s were"} written but not yet
            approved, so {statistics.withheld === 1 ? "it" : "they"} exported
            empty. Approve {statistics.withheld === 1 ? "it" : "them"} and
            export again to include {statistics.withheld === 1 ? "it" : "them"}.
          </AlertDescription>
        </Alert>
      ) : null}

      {statistics.translated === 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            Nothing in this language is approved yet, so the file is empty.
          </AlertDescription>
        </Alert>
      ) : null}

      {result.publishedVersion === null ? (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertDescription>
            This application has no published version, so the file contains every
            active key. Once a version is published, exports contain that
            version's key set instead — a key added afterwards will not appear
            until the next version is published.
          </AlertDescription>
        </Alert>
      ) : null}

      <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed">
        {result.content.slice(0, 2000) || "(empty file)"}
      </pre>
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
