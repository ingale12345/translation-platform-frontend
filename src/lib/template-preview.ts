import type {
  Template,
  TemplateExportConfig,
  TemplateImportConfig,
} from "@/types/models"

/**
 * Renders a sample file from a template's config, so the editor shows the shape of the
 * output instead of leaving the author to imagine it from four separate text fields.
 *
 * The authoritative renderer is `src/services/translations/export.class.ts` on the
 * backend. This file must substitute the same tokens the same way — if the two disagree,
 * the preview stops describing the file it claims to preview, so change both together.
 *
 * The one thing this cannot show is escaping: the server escapes values per file type
 * (quotes in JSON, newlines in .properties), and the sample strings here are chosen to
 * need none.
 */

/**
 * Tokens a template row may reference.
 *
 * `$key` is canonical — it is what every seeded template uses. `{key}` is accepted as an
 * alias because the console shipped with braces, and quietly failing to substitute a
 * template someone authored against this preview would be worse than two spellings.
 */
export const TEMPLATE_TOKENS = [
  { token: "$key", description: "The translation key" },
  { token: "$value", description: "The translated string" },
  { token: "$namespace", description: "The key's namespace" },
  { token: "$language", description: "Language code, e.g. ja" },
  { token: "$index", description: "0-based row number" },
] as const

interface SampleRow {
  key: string
  value: string
  namespace: string
  language: string
}

const SAMPLE_ROWS: SampleRow[] = [
  { key: "login_button", value: "Login", namespace: "common", language: "en" },
  {
    key: "logout_button",
    value: "Logout",
    namespace: "common",
    language: "en",
  },
  {
    key: "welcome_message",
    value: "Welcome, {name}!",
    namespace: "common",
    language: "en",
  },
]

/** An empty value, to show what `includeEmptyValues` actually does. */
const EMPTY_ROW: SampleRow = {
  key: "delete_button",
  value: "",
  namespace: "common",
  language: "en",
}

const TOKEN =
  /\$(key|value|namespace|language|index)\b|\{(key|value|namespace|language|index)\}/g

const substitute = (pattern: string, row: SampleRow, index: number): string =>
  // One pass, not five sequential replaces: `welcome_message` below contains `{name}`,
  // and a second pass over an already-substituted string would treat the application's
  // own placeholder as a template token.
  pattern.replace(TOKEN, (_match, dollar?: string, braced?: string) => {
    switch (dollar ?? braced) {
      case "key":
        return row.key
      case "value":
        return row.value
      case "namespace":
        return row.namespace
      case "language":
        return row.language
      default:
        return String(index)
    }
  })

/**
 * Builds the sample output for an export config.
 *
 * `separator` goes *between* rows, not after the last one — a trailing comma is exactly
 * the mistake that makes generated JSON unparseable, and seeing it here is the point of
 * the preview.
 */
export const renderExportPreview = (config: TemplateExportConfig): string => {
  const rows = config.includeEmptyValues
    ? [...SAMPLE_ROWS, EMPTY_ROW]
    : SAMPLE_ROWS

  if (!config.fileRow.trim()) {
    return "// Set a row pattern to see the output."
  }

  const body = rows
    .map((row, index) => substitute(config.fileRow, row, index))
    .join(config.separator ?? "\n")

  // `fileStart` / `fileEnd` are substituted too — an ARB header carries `$language`.
  const context: SampleRow = {
    key: "",
    value: "",
    namespace: "common",
    language: "en",
  }

  return [
    config.fileStart ? substitute(config.fileStart, context, 0) : "",
    body,
    config.fileEnd ? substitute(config.fileEnd, context, rows.length) : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * The import side has no output to render, so the preview shows what the parser expects
 * to receive — the same rows, formatted by the import row pattern.
 */
export const renderImportPreview = (config: TemplateImportConfig): string => {
  if (!config.fileRow.trim()) {
    return "// Set a row pattern to see the expected input."
  }

  const header = config.hasHeader ? "key,value" : null
  const body = SAMPLE_ROWS.map((row, index) =>
    substitute(config.fileRow, row, index)
  ).join(config.separator ?? "\n")

  return [config.fileStart, header, body, config.fileEnd]
    .filter(Boolean)
    .join("\n")
}

/** Sensible starting configs per file type, so a new template is not a blank form. */
export const DEFAULT_CONFIGS: Record<
  Template["fileType"],
  {
    extension: string
    exportRow: string
    start?: string
    end?: string
    separator?: string
  }
> = {
  JSON: {
    extension: "json",
    exportRow: '  "$key": "$value"',
    start: "{",
    end: "}",
    separator: ",\n",
  },
  PROPERTIES: {
    extension: "properties",
    exportRow: "$key=$value",
    separator: "\n",
  },
  ARB: {
    extension: "arb",
    exportRow: '  "$key": "$value"',
    start: '{\n  "@@locale": "$language",',
    end: "}",
    separator: ",\n",
  },
  XML: {
    extension: "xml",
    exportRow: '  <string name="$key">$value</string>',
    start: '<?xml version="1.0" encoding="utf-8"?>\n<resources>',
    end: "</resources>",
  },
  YAML: { extension: "yaml", exportRow: "$key: $value" },
  CSV: { extension: "csv", exportRow: "$key,$value", start: "key,value" },
  CUSTOM: { extension: "txt", exportRow: "$key=$value" },
}
