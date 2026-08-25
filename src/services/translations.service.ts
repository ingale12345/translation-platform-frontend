import { http } from "@/lib/http/client"
import type {
  BulkStatusRequest,
  BulkStatusResult,
  TranslationExportRequest,
  TranslationExportResult,
  TranslationImportRequest,
  TranslationImportResult,
} from "@/types/operations"

/**
 * Translation operations — the endpoints that act rather than store.
 *
 * They go through the same axios instance as every resource, so they inherit the auth
 * header, the tenant headers and the error normalisation. What they do not inherit is
 * `createResourceService`, because none of them has a collection to list or an id to get.
 */
export const translationOperationsService = {
  /**
   * `POST /translations/bulk-status` — move many cells to one status.
   *
   * The server enforces the ladder and the permission per cell, and returns what it
   * skipped and why. The console shows that list rather than a bare success count: "37
   * approved, 3 skipped" is only useful if the user can find out which three.
   */
  async bulkStatus(request: BulkStatusRequest): Promise<BulkStatusResult> {
    const { data } = await http.post<BulkStatusResult>(
      "/translations/bulk-status",
      request
    )

    return data
  },

  /**
   * `POST /translations/export` — render one language into a file.
   *
   * The file comes back in the response body rather than as a URL: an export is project
   * content, and streaming it to an authenticated caller avoids parking it somewhere that
   * then needs protecting separately. The browser turns it into a download.
   */
  async render(
    request: TranslationExportRequest
  ): Promise<TranslationExportResult> {
    const { data } = await http.post<TranslationExportResult>(
      "/translations/export",
      request
    )

    return data
  },

  /**
   * `POST /translations/import` — reconcile the application's key set against a file.
   *
   * Called twice for every real import: once with `dryRun: true` to build the preview, and
   * again without it to commit. That is not a round trip wasted — the whole point of the
   * preview is that it is produced by the same code that will do the work, so what the
   * user approves and what happens cannot drift apart.
   *
   * The file never leaves the request. Its text rides in the body and is parsed
   * synchronously; nothing is stored, so there is no upload to resume and no artifact to
   * clean up.
   */
  async runImport(
    request: TranslationImportRequest
  ): Promise<TranslationImportResult> {
    const { data } = await http.post<TranslationImportResult>(
      "/translations/import",
      request
    )

    return data
  },
}
