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
