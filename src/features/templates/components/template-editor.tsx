import { InfoIcon } from "lucide-react"

import { FormField } from "@/components/common/form-field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TEMPLATE_TOKENS,
  renderExportPreview,
  renderImportPreview,
} from "@/lib/template-preview"
import type { TemplateExportConfig, TemplateImportConfig } from "@/types/models"

interface TemplateEditorProps {
  importConfig: TemplateImportConfig
  exportConfig: TemplateExportConfig
  onImportChange: (config: TemplateImportConfig) => void
  onExportChange: (config: TemplateExportConfig) => void
  disabled?: boolean
}

/**
 * The import and export config editors, each beside a live sample of what it produces.
 *
 * The preview is the whole reason this screen exists: `fileStart` / `fileRow` /
 * `separator` / `fileEnd` are unreadable as four text inputs, and a template that emits
 * a trailing comma only shows itself as broken when you look at the assembled file.
 */
export function TemplateEditor({
  importConfig,
  exportConfig,
  onImportChange,
  onExportChange,
  disabled,
}: TemplateEditorProps) {
  return (
    <Tabs defaultValue="export">
      <TabsList>
        <TabsTrigger value="export">Export</TabsTrigger>
        <TabsTrigger value="import">Import</TabsTrigger>
      </TabsList>

      <TabsContent value="export" className="mt-4">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <ToggleRow
              label="Export enabled"
              description="Allow this template to generate translation bundles."
              checked={exportConfig.enabled}
              disabled={disabled}
              onChange={(enabled) =>
                onExportChange({ ...exportConfig, enabled })
              }
            />

            <FormField
              label="Row pattern"
              required
              hint="Repeated for every key. Use the tokens listed below."
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={exportConfig.fileRow}
                  disabled={disabled}
                  rows={2}
                  className="font-mono text-xs"
                  onChange={(event) =>
                    onExportChange({
                      ...exportConfig,
                      fileRow: event.target.value,
                    })
                  }
                />
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="File start"
                hint="Written once, before the rows"
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={exportConfig.fileStart ?? ""}
                    disabled={disabled}
                    rows={2}
                    className="font-mono text-xs"
                    onChange={(event) =>
                      onExportChange({
                        ...exportConfig,
                        fileStart: event.target.value,
                      })
                    }
                  />
                )}
              </FormField>

              <FormField label="File end" hint="Written once, after the rows">
                {(props) => (
                  <Textarea
                    {...props}
                    value={exportConfig.fileEnd ?? ""}
                    disabled={disabled}
                    rows={2}
                    className="font-mono text-xs"
                    onChange={(event) =>
                      onExportChange({
                        ...exportConfig,
                        fileEnd: event.target.value,
                      })
                    }
                  />
                )}
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Row separator"
                hint="Between rows, not after the last"
              >
                {(props) => (
                  <Input
                    {...props}
                    value={(exportConfig.separator ?? "").replace(/\n/g, "\\n")}
                    disabled={disabled}
                    className="font-mono text-xs"
                    onChange={(event) =>
                      onExportChange({
                        ...exportConfig,
                        separator: event.target.value.replace(/\\n/g, "\n"),
                      })
                    }
                  />
                )}
              </FormField>

              <FormField label="Encoding">
                {(props) => (
                  <Input
                    {...props}
                    value={exportConfig.encoding}
                    disabled={disabled}
                    className="font-mono text-xs"
                    onChange={(event) =>
                      onExportChange({
                        ...exportConfig,
                        encoding: event.target.value,
                      })
                    }
                  />
                )}
              </FormField>
            </div>

            <ToggleRow
              label="Include empty values"
              description="Write a row even when the translation is missing."
              checked={exportConfig.includeEmptyValues}
              disabled={disabled}
              onChange={(includeEmptyValues) =>
                onExportChange({ ...exportConfig, includeEmptyValues })
              }
            />
          </div>

          <PreviewPane
            title="Sample output"
            content={renderExportPreview(exportConfig)}
          />
        </div>
      </TabsContent>

      <TabsContent value="import" className="mt-4">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <ToggleRow
              label="Import enabled"
              description="Allow files in this format to be uploaded."
              checked={importConfig.enabled}
              disabled={disabled}
              onChange={(enabled) =>
                onImportChange({ ...importConfig, enabled })
              }
            />

            <FormField
              label="Row pattern"
              required
              hint="How one key/value line is laid out"
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={importConfig.fileRow}
                  disabled={disabled}
                  rows={2}
                  className="font-mono text-xs"
                  onChange={(event) =>
                    onImportChange({
                      ...importConfig,
                      fileRow: event.target.value,
                    })
                  }
                />
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Row separator">
                {(props) => (
                  <Input
                    {...props}
                    value={(importConfig.separator ?? "").replace(/\n/g, "\\n")}
                    disabled={disabled}
                    className="font-mono text-xs"
                    onChange={(event) =>
                      onImportChange({
                        ...importConfig,
                        separator: event.target.value.replace(/\\n/g, "\n"),
                      })
                    }
                  />
                )}
              </FormField>

              <FormField label="Encoding">
                {(props) => (
                  <Input
                    {...props}
                    value={importConfig.encoding}
                    disabled={disabled}
                    className="font-mono text-xs"
                    onChange={(event) =>
                      onImportChange({
                        ...importConfig,
                        encoding: event.target.value,
                      })
                    }
                  />
                )}
              </FormField>
            </div>

            <ToggleRow
              label="File has a header row"
              description="Skip the first line when parsing."
              checked={importConfig.hasHeader}
              disabled={disabled}
              onChange={(hasHeader) =>
                onImportChange({ ...importConfig, hasHeader })
              }
            />
          </div>

          <PreviewPane
            title="Expected input"
            content={renderImportPreview(importConfig)}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  )
}

function PreviewPane({ title, content }: { title: string; content: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-[10px] text-muted-foreground">3 sample keys</span>
      </div>

      <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {content}
      </pre>

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
          <InfoIcon className="size-3.5" /> Available tokens
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          {TEMPLATE_TOKENS.map((token) => (
            <div key={token.token} className="contents">
              <dt className="font-mono text-muted-foreground">{token.token}</dt>
              <dd className="text-muted-foreground">{token.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
