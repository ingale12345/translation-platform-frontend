import { useMutation, useQueryClient } from "@tanstack/react-query"

import { translationKeyKeys } from "@/features/translations/hooks"
import type { ApiError } from "@/lib/http/errors"
import { createResourceHooks } from "@/lib/query/resource-hooks"
import { translationVersionsService } from "@/services"
import { translationOperationsService } from "@/services/translations.service"
import type { Id } from "@/types/api"
import type {
  TranslationVersion,
  TranslationVersionCreate,
} from "@/types/models"
import type {
  TranslationImportRequest,
  TranslationImportResult,
} from "@/types/operations"

export const translationVersionQueries = createResourceHooks(
  translationVersionsService
)

export const {
  keys: translationVersionKeys,
  useList: useTranslationVersions,
  useListAll: useAllTranslationVersions,
  useOne: useTranslationVersion,
} = translationVersionQueries

/**
 * Cuts a version — freezes the current key set into a numbered snapshot.
 *
 * Nothing about what users see changes here. The cut decides what a release *contains*;
 * publishing decides when it ships. Keeping them apart is what lets a release be assembled
 * and reviewed without the assembling being visible to anyone's application.
 *
 * The key cache is invalidated because cutting writes to the keys themselves — each one
 * gains the version stamp that records its membership.
 */
export const useCutVersion = () => {
  const queryClient = useQueryClient()

  return useMutation<TranslationVersion, ApiError, TranslationVersionCreate>({
    mutationFn: (payload) => translationVersionsService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: translationVersionKeys.all })
      void queryClient.invalidateQueries({ queryKey: translationKeyKeys.all })
    },
  })
}

/**
 * Publishes a version — the act that changes what production serves.
 *
 * The server demotes whatever was published before, so the caller never has to sequence
 * two writes and can never leave two versions claiming to be live. See
 * `hooks/publish-version.ts` on the API.
 *
 * Both caches are invalidated because publishing changes the *answer to a different
 * question*: which keys are in the shipped set. The grid's disabled rows and the export
 * contents both move, and neither is derived from the versions list.
 */
export const usePublishVersion = () => {
  const queryClient = useQueryClient()

  return useMutation<TranslationVersion, ApiError, Id>({
    mutationFn: (id) =>
      translationVersionsService.patch(id, { status: "PUBLISHED" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: translationVersionKeys.all })
      void queryClient.invalidateQueries({ queryKey: translationKeyKeys.all })
    },
  })
}

/**
 * Runs an import, or previews one.
 *
 * A dry run touches nothing, so it deliberately does *not* invalidate anything — a
 * preview that refetched the grid would suggest something had happened. Only the real
 * run clears the caches.
 */
export const useRunImport = () => {
  const queryClient = useQueryClient()

  return useMutation<TranslationImportResult, ApiError, TranslationImportRequest>({
    mutationFn: (request) => translationOperationsService.runImport(request),
    onSuccess: (result) => {
      if (result.dryRun) {
        return
      }

      void queryClient.invalidateQueries({ queryKey: translationVersionKeys.all })
      void queryClient.invalidateQueries({ queryKey: translationKeyKeys.all })
    },
  })
}
