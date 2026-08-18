import type { TranslationStatus } from "@/types/models"

/**
 * The status ladder is the product's core visual language: every cell, chip and filter
 * reads from this one table, so "approved" is the same indigo everywhere and the order in
 * a filter menu always matches the order of the workflow.
 */
export interface StatusMeta {
  label: string
  /** Order in the workflow, for sorting and for the filter menu. */
  order: number
  /** Small solid dot — chips and legends. */
  dot: string
  /** Chip background + text + ring. */
  chip: string
  /** The 2px rail down the left edge of a grid cell. */
  rail: string
}

export const TRANSLATION_STATUS_META: Record<TranslationStatus, StatusMeta> = {
  MISSING: {
    label: "Missing",
    order: 0,
    dot: "bg-zinc-400 dark:bg-zinc-500",
    chip: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
    rail: "bg-zinc-300 dark:bg-zinc-700",
  },
  DRAFT: {
    label: "Draft",
    order: 1,
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
    rail: "bg-amber-400",
  },
  REVIEW: {
    label: "Review",
    order: 2,
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900",
    rail: "bg-sky-400",
  },
  APPROVED: {
    label: "Approved",
    order: 3,
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
    rail: "bg-indigo-400",
  },
  PUBLISHED: {
    label: "Published",
    order: 4,
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
    rail: "bg-emerald-400",
  },
}

/** Workflow order — MISSING → DRAFT → REVIEW → APPROVED → PUBLISHED. */
export const TRANSLATION_STATUS_FLOW = (
  Object.keys(TRANSLATION_STATUS_META) as TranslationStatus[]
).sort(
  (a, b) => TRANSLATION_STATUS_META[a].order - TRANSLATION_STATUS_META[b].order
)

export const statusMeta = (status: TranslationStatus | undefined): StatusMeta =>
  TRANSLATION_STATUS_META[status ?? "MISSING"]

/** A cell can be approved once it holds a value and has not been approved already. */
export const canApproveStatus = (
  status: TranslationStatus | undefined
): boolean => status === "DRAFT" || status === "REVIEW"

/** Publishing is the last step, and only from APPROVED. */
export const canPublishStatus = (
  status: TranslationStatus | undefined
): boolean => status === "APPROVED"
