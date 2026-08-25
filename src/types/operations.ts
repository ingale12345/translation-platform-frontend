/**
 * Contracts for the endpoints that *do* something rather than store something.
 *
 * These are operations, not resources: they have no collection, no id and no list, so
 * they sit outside `createResourceService` and its generic CRUD shape. Each one mirrors
 * a TypeBox schema on the server — see `src/services/translations/` there.
 */
import type { Id } from "./api"
import type { TranslationStatus } from "./models"

/* -------------------------------------------------------------------------- *
 * Bulk status
 * -------------------------------------------------------------------------- */

export interface BulkStatusFilter {
  namespace?: string
  search?: string
  /** Only move cells currently at one of these statuses. */
  fromStatus?: TranslationStatus[]
}

/** One cell: a key and a language. The unit a status actually moves. */
export interface BulkStatusCell {
  translationKeyId: Id
  languageCode: string
}

export interface BulkStatusRequest {
  projectId: Id
  applicationId: Id
  status: TranslationStatus
  /**
   * The exact cells ticked in the grid — arbitrary key × language pairs.
   *
   * This is what the console sends. A status belongs to a cell, not to a key: the German
   * of a string can be ready to publish while its Japanese is still in review, so a
   * selection that could only name whole keys forced the user to move both or neither.
   */
  cells?: BulkStatusCell[]
  /** Languages to touch on each selected key. Omit for every language it has. */
  languageCodes?: string[]
  /** Whole-key selection, for callers that work in keys rather than cells. */
  translationKeyIds?: Id[]
  /**
   * Server-resolved selection. One of `cells`, `translationKeyIds` or `filter` is required
   * — the server refuses a call with none rather than treating it as "everything".
   */
  filter?: BulkStatusFilter
  /** Recorded on every history row the operation writes. */
  comment?: string
  limit?: number
}

/** Why one cell was left alone. Each maps to a sentence the console shows the user. */
export type BulkStatusSkipReason =
  | "empty-value"
  | "already-at-status"
  | "invalid-transition"
  | "language-not-on-key"

export interface BulkStatusSkip {
  translationKeyId: Id
  namespace: string
  key: string
  languageCode: string
  currentStatus: TranslationStatus | null
  reason: BulkStatusSkipReason
}

export interface BulkStatusResult {
  status: TranslationStatus
  /** Cells considered — the exact selection, or selected keys × requested languages. */
  examined: number
  updated: number
  updatedKeys: number
  skipped: BulkStatusSkip[]
}

export const SKIP_REASON_LABEL: Record<BulkStatusSkipReason, string> = {
  "empty-value": "no translation yet",
  "already-at-status": "already at that status",
  "invalid-transition": "not allowed from its current status",
  "language-not-on-key": "language not on this key",
}

/* -------------------------------------------------------------------------- *
 * Export
 * -------------------------------------------------------------------------- */

export interface TranslationExportRequest {
  projectId: Id
  applicationId: Id
  templateId: Id
  languageCode: string
  namespace?: string
  /** Record an export-jobs row for the history screen. Defaults to true. */
  record?: boolean
  limit?: number
}

export interface TranslationExportStatistics {
  /** Keys considered. */
  total: number
  /** Keys whose value was exported — approved or published. */
  translated: number
  /** Keys that exported as empty, for any reason. */
  missing: number
  published: number
  approved: number
  /** Keys that hold text but were withheld because it is not approved. */
  withheld: number
}

export interface TranslationExportResult {
  fileName: string
  fileExtension: string
  content: string
  languageCode: string
  templateId: Id
  statistics: TranslationExportStatistics
  jobId: Id | null
}

/* -------------------------------------------------------------------------- *
 * Import
 * -------------------------------------------------------------------------- */

export interface TranslationImportRequest {
  projectId: Id
  applicationId: Id
  templateId: Id
  /** The file's language. Defaults to the application's source language. */
  languageCode?: string
  fileName: string
  content: string
  /** Namespace for keys the file gives no dotted prefix. */
  defaultNamespace?: string
  /**
   * Parse and reconcile, report, write nothing.
   *
   * The console always runs this first. "This will disable 47 keys" is something a person
   * has to see *before* the import, not discover afterwards.
   */
  dryRun?: boolean
  note?: string
}

export type ImportChangeKind =
  | "added"
  | "updated"
  | "unchanged"
  | "disabled"
  | "restored"

export interface ImportChange {
  namespace: string
  key: string
  change: ImportChangeKind
  oldValue?: string
  newValue?: string
}

export interface ImportStatistics {
  /** Keys in the file. */
  total: number
  added: number
  updated: number
  unchanged: number
  /** Present before, absent from this file — disabled, not deleted. */
  disabled: number
  /** Disabled by an earlier import and back in this one, translations intact. */
  restored: number
  /** Console-created keys the file did not mention, and which were left alone. */
  manualUntouched: number
}

export interface ImportError {
  line?: number
  key?: string
  message: string
}

export interface TranslationImportResult {
  dryRun: boolean
  /** The run receipt. `null` on a dry run — nothing was written. */
  jobId: Id | null
  languageCode: string
  statistics: ImportStatistics
  /** Every row the import touched or would touch. Capped server-side at 500. */
  changes: ImportChange[]
  errors: ImportError[]
}

/** Labels for the change kinds, so the preview and the run log agree on wording. */
export const IMPORT_CHANGE_LABEL: Record<ImportChangeKind, string> = {
  added: "New key",
  updated: "Source text changed",
  unchanged: "Unchanged",
  disabled: "No longer in the file",
  restored: "Back in the file",
}
