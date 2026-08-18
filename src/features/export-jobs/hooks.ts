import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { ApiError } from "@/lib/http/errors"
import { createResourceHooks } from "@/lib/query/resource-hooks"
import { exportJobsService } from "@/services"
import { translationOperationsService } from "@/services/translations.service"
import type {
  TranslationExportRequest,
  TranslationExportResult,
} from "@/types/operations"

export const exportJobQueries = createResourceHooks(exportJobsService)

export const {
  keys: exportJobKeys,
  useList: useExportJobs,
  useOne: useExportJob,
  useCreate: useCreateExportJob,
} = exportJobQueries

/**
 * Renders an export and returns the file contents.
 *
 * `POST /translations/export` does the work synchronously and records the job itself, so
 * the history list is invalidated on success — the receipt appears without the caller
 * having to create one.
 */
export const useRenderExport = () => {
  const queryClient = useQueryClient()

  return useMutation<
    TranslationExportResult,
    ApiError,
    TranslationExportRequest
  >({
    mutationFn: (request) => translationOperationsService.render(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: exportJobKeys.all })
    },
  })
}
