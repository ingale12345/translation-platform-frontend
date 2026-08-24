import type { Id } from "@/types/api"
import type { TranslationKey, TranslationStatus } from "@/types/models"
import type { BulkStatusCell } from "@/types/operations"

/**
 * A grid selection, as a set of cells.
 *
 * A status belongs to a *cell*, not to a key: the German of a string can be ready to
 * publish while its Japanese is still in review. Selecting whole rows meant the two moved
 * together or not at all, so the selection is keyed by `keyId:languageCode` and a user is
 * free to tick the German of one key and the Japanese of another in the same action.
 *
 * The set holds strings rather than objects so membership is an O(1) `has` during render —
 * every cell in the grid asks whether it is selected on every pass.
 */
export type CellRef = string

export const cellRef = (translationKeyId: Id, languageCode: string): CellRef =>
  `${translationKeyId}:${languageCode}`

/**
 * Back to the pair the API takes.
 *
 * Splits on the *first* colon only: a language code never contains one, but this way a key
 * id that somehow did would still round-trip.
 */
export const parseCellRef = (ref: CellRef): BulkStatusCell => {
  const separator = ref.indexOf(":")

  return {
    translationKeyId: ref.slice(0, separator),
    languageCode: ref.slice(separator + 1),
  }
}

/** Every cell of one row, in the grid's column order. */
export const rowCellRefs = (
  row: TranslationKey,
  languageCodes: string[]
): CellRef[] => languageCodes.map((code) => cellRef(row._id, code))

/** A key the code no longer contains. Kept and shown, but never exported or delivered. */
export const isDisabledRow = (row: TranslationKey): boolean =>
  row.rowStatus === "DISABLED"

/**
 * Every cell on the page — what the header checkbox ticks.
 *
 * Disabled rows are left out. "Approve everything on this page" should not quietly sign
 * off on strings that no longer exist in the code; they can still be ticked one at a time
 * if somebody genuinely means to.
 */
export const pageCellRefs = (
  rows: TranslationKey[],
  languageCodes: string[]
): CellRef[] =>
  rows
    .filter((row) => !isDisabledRow(row))
    .flatMap((row) => rowCellRefs(row, languageCodes))

/**
 * Toggles a group as a whole: any unticked member selects them all, otherwise clear.
 *
 * "All or nothing" rather than per-cell inversion, because that is what a header or row
 * checkbox is understood to mean — a partially-ticked row should fill up, not invert.
 */
export const toggleGroup = (
  selected: Set<CellRef>,
  refs: CellRef[]
): Set<CellRef> => {
  const next = new Set(selected)
  const isComplete = refs.length > 0 && refs.every((ref) => next.has(ref))

  for (const ref of refs) {
    if (isComplete) {
      next.delete(ref)
    } else {
      next.add(ref)
    }
  }

  return next
}

export const toggleCell = (
  selected: Set<CellRef>,
  ref: CellRef
): Set<CellRef> => {
  const next = new Set(selected)

  if (next.has(ref)) {
    next.delete(ref)
  } else {
    next.add(ref)
  }

  return next
}

export interface SelectionSummary {
  cells: number
  /** How many distinct keys the selection touches, for the "3 keys" half of the label. */
  keys: number
  /** Cell count per current status, so the bar can say what is actually movable. */
  byStatus: Map<TranslationStatus | "MISSING", number>
  /** Selected cells that hold no text — they can never be approved or published. */
  empty: number
}

/**
 * What is currently ticked, described in the terms the action bar needs.
 *
 * Computed from the rows on screen rather than from the refs alone, because a ref carries
 * no status — and "12 cells selected" is much less useful than knowing 9 of them are in
 * review and 3 are already approved.
 */
export const summarizeSelection = (
  selected: Set<CellRef>,
  rows: TranslationKey[]
): SelectionSummary => {
  const byStatus = new Map<TranslationStatus | "MISSING", number>()
  const keys = new Set<Id>()
  let counted = 0
  let empty = 0

  for (const row of rows) {
    for (const [code, cell] of Object.entries(row.translations)) {
      if (!selected.has(cellRef(row._id, code))) {
        continue
      }

      counted += 1
      keys.add(row._id)

      const status = cell.status ?? "MISSING"
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1)

      if (!cell.value?.trim()) {
        empty += 1
      }
    }
  }

  // A ticked language the key has no entry for still counts as selected — the server
  // reports it back as `language-not-on-key` rather than silently ignoring it.
  const missing = selected.size - counted

  if (missing > 0) {
    byStatus.set("MISSING", (byStatus.get("MISSING") ?? 0) + missing)
  }

  return { cells: selected.size, keys: keys.size, byStatus, empty }
}
