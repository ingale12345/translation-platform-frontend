import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import type { ApiError } from "@/lib/http/errors"
import { contains } from "@/lib/http/params"
import { createResourceHooks } from "@/lib/query/resource-hooks"
import { translationCommentsService, translationKeysService } from "@/services"
import type { Id, ListQuery } from "@/types/api"
import type {
  TranslationKey,
  TranslationStatus,
  TranslationValue,
} from "@/types/models"

export const translationKeyQueries = createResourceHooks(translationKeysService)

export const {
  keys: translationKeyKeys,
  useList: useTranslationKeysQuery,
  useInfiniteList: useInfiniteTranslationKeys,
  useOne: useTranslationKey,
  useCreate: useCreateTranslationKey,
  useUpdate: useUpdateTranslationKey,
  useRemove: useRemoveTranslationKey,
} = translationKeyQueries

export const translationCommentQueries = createResourceHooks(
  translationCommentsService
)

export const {
  keys: translationCommentKeys,
  useList: useTranslationCommentsQuery,
  useCreate: useCreateTranslationComment,
  useUpdate: useUpdateTranslationComment,
  useRemove: useRemoveTranslationComment,
} = translationCommentQueries

/* -------------------------------------------------------------------------- *
 * Grid query
 * -------------------------------------------------------------------------- */

export interface TranslationGridFilters {
  projectId: Id | null
  applicationId: Id | null
  /** Free text across the key name. */
  search?: string
  namespace?: string
  limit?: number
  skip?: number
}

/**
 * One page of translation keys for the grid.
 *
 * Search hits `key` only. Matching on translated *values* would mean a regex over every
 * language inside a nested object, which Mongo cannot index — the backend exposes a
 * dedicated search endpoint for that, and it is listed in the UI plan as a follow-up.
 */
export const useTranslationGrid = (filters: TranslationGridFilters) => {
  const query = useMemo<ListQuery<TranslationKey>>(() => {
    const where: NonNullable<ListQuery<TranslationKey>["where"]> = {}

    if (filters.projectId) {
      where.projectId = filters.projectId
    }

    if (filters.applicationId) {
      where.applicationId = filters.applicationId
    }

    if (filters.namespace) {
      where.namespace = filters.namespace
    }

    const search = filters.search?.trim()
    if (search) {
      where.key = contains(search)
    }

    return {
      where,
      limit: filters.limit ?? 50,
      skip: filters.skip ?? 0,
      sortAsc: "key",
    }
  }, [
    filters.projectId,
    filters.applicationId,
    filters.namespace,
    filters.search,
    filters.limit,
    filters.skip,
  ])

  return useTranslationKeysQuery(query, {
    enabled: Boolean(filters.projectId && filters.applicationId),
    // Keeps the previous page on screen while the next one loads, so typing in the search
    // box does not blank the grid on every keystroke.
    placeholderData: (previous) => previous,
  })
}

/* -------------------------------------------------------------------------- *
 * Cell mutations
 * -------------------------------------------------------------------------- */

/** The next status after an edit: a first value starts as a draft, a change needs review. */
export const nextStatusAfterEdit = (
  current: TranslationValue | undefined,
  value: string
): TranslationStatus => {
  if (!value.trim()) {
    return "MISSING"
  }

  return !current?.value ? "DRAFT" : "REVIEW"
}

interface CellMutationVars {
  translationKey: TranslationKey
  languageCode: string
}

export interface SetCellValueVars extends CellMutationVars {
  value: string
}

export interface SetCellStatusVars extends CellMutationVars {
  status: TranslationStatus
}

/**
 * Writes one cell.
 *
 * The patch schema rejects dot-notation keys, so the whole `translations` map is sent
 * back with the one language replaced. That is a read-modify-write: two people editing
 * *different languages of the same key* within one request round-trip can clobber each
 * other. Optimistic concurrency (a version field, or a `PATCH /translation-keys/:id/cell`
 * endpoint) is the fix, and is tracked in the UI plan.
 */
const patchCell = (
  translationKey: TranslationKey,
  languageCode: string,
  patch: Partial<TranslationValue>
) => ({
  translations: {
    ...translationKey.translations,
    [languageCode]: {
      ...translationKey.translations[languageCode],
      ...patch,
    } as TranslationValue,
  },
})

export const useSetCellValue = () => {
  const queryClient = useQueryClient()

  return useMutation<TranslationKey, ApiError, SetCellValueVars>({
    mutationFn: ({ translationKey, languageCode, value }) => {
      const current = translationKey.translations[languageCode]

      return translationKeysService.patch(
        translationKey._id,
        patchCell(translationKey, languageCode, {
          value,
          status: nextStatusAfterEdit(current, value),
          updatedAt: new Date().toISOString(),
        })
      )
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: translationKeyKeys.all }),
  })
}

export const useSetCellStatus = () => {
  const queryClient = useQueryClient()

  return useMutation<TranslationKey, ApiError, SetCellStatusVars>({
    mutationFn: ({ translationKey, languageCode, status }) =>
      translationKeysService.patch(
        translationKey._id,
        patchCell(translationKey, languageCode, { status })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: translationKeyKeys.all }),
  })
}

/* -------------------------------------------------------------------------- *
 * Derived views
 * -------------------------------------------------------------------------- */

/**
 * Percentage of cells at APPROVED or PUBLISHED, per language.
 *
 * Computed over the loaded page only — it describes what is on screen, which is why the
 * UI labels it "coverage on this page" rather than project completeness.
 */
export const useCoverage = (
  rows: TranslationKey[] | undefined,
  languageCodes: string[]
): Record<string, number> =>
  useMemo(() => {
    const coverage: Record<string, number> = {}

    for (const code of languageCodes) {
      const cells = (rows ?? [])
        .map((row) => row.translations[code])
        .filter(Boolean)
      const done = cells.filter(
        (cell) => cell.status === "APPROVED" || cell.status === "PUBLISHED"
      ).length

      coverage[code] =
        cells.length > 0 ? Math.round((done / cells.length) * 100) : 0
    }

    return coverage
  }, [rows, languageCodes])

/** Comments on one cell, newest last so the thread reads top to bottom. */
export const useCellComments = (
  translationKeyId: Id | undefined,
  languageCode: string | undefined
) =>
  useTranslationCommentsQuery(
    {
      where: {
        translationKeyId: translationKeyId ?? "",
        languageCode: languageCode ?? "",
      },
      sortAsc: "createdAt",
      limit: 100,
    },
    { enabled: Boolean(translationKeyId && languageCode) }
  )
