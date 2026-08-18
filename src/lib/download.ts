/**
 * Hands a generated file to the browser.
 *
 * The export endpoint returns the file in the response body rather than a URL, so there
 * is nothing to link to — a blob URL is created, clicked and revoked immediately. Not
 * revoking it would pin the whole file in memory for the life of the tab, and export
 * bundles are not small.
 */
export const downloadTextFile = (
  fileName: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
): void => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
