import { createResourceHooks } from "@/lib/query/resource-hooks"
import { translationHistoryService } from "@/services"
import type { Id } from "@/types/api"

/** Read-only: the server writes history, a client only ever reads it. */
export const translationHistoryQueries = createResourceHooks(
  translationHistoryService
)

export const { keys: translationHistoryKeys } = translationHistoryQueries

/**
 * History for **one cell** — one key, one language.
 *
 * Deliberately the only way to read history. A project accumulates a row per cell per
 * edit, so "all history" is unbounded and gets slower every day it is used; nothing in
 * the console needs it, and an accidental unfiltered call would be invisible in
 * development and painful in production.
 *
 * Disabled until both ids are known, so opening the drawer is what triggers the request
 * rather than rendering the grid behind it.
 */
export const useCellHistory = (
  translationKeyId: Id | undefined,
  languageCode: string | undefined
) =>
  translationHistoryQueries.useList(
    {
      where: {
        translationKeyId: translationKeyId ?? "",
        languageCode: languageCode ?? "",
      },
      sortDesc: "changedAt",
      limit: 50,
    },
    { enabled: Boolean(translationKeyId && languageCode) }
  )
