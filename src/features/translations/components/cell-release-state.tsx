import { CircleSlashIcon, PackageCheckIcon, PackageIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useTranslationVersions } from "@/features/translation-versions/hooks"
import { cn } from "@/lib/utils"
import type { TranslationKey, TranslationValue } from "@/types/models"

/**
 * Whether this key is part of the version the application currently delivers.
 *
 * The same predicate the server applies in `common/utils/published-version.ts`. Duplicated
 * here rather than fetched because it is four comparisons on fields the grid already has,
 * and a round trip per open cell to be told something the client can work out is a worse
 * trade than the duplication — but it does mean the two must be changed together.
 */
const isInPublishedVersion = (
  key: TranslationKey,
  publishedVersion: number | null
): boolean => {
  if (publishedVersion === null) {
    return key.rowStatus !== "DISABLED"
  }

  const arrived = key.firstSeenVersion ?? null

  if (arrived === null || arrived > publishedVersion) {
    return false
  }

  const dropped = key.disabledInVersion ?? null
  const restored = key.restoredInVersion ?? null

  if (dropped === null || dropped > publishedVersion) {
    return true
  }

  return restored !== null && restored <= publishedVersion
}

/**
 * Where this cell stands with respect to releases.
 *
 * Two independent gates decide whether an application receives a string, and confusing
 * them is the single most common question this product produces: **the published version**
 * decides which keys exist, and **the cell's status** decides whether it carries a value.
 * A string can be signed off for weeks and still not be delivered because the release
 * carrying it has not shipped — so the panel states both, and says which one is blocking.
 */
export function CellReleaseState({
  translationKey,
  cell,
}: {
  translationKey: TranslationKey | undefined
  cell: TranslationValue | undefined
}) {
  const versionsQuery = useTranslationVersions(
    {
      where: {
        applicationId: translationKey?.applicationId ?? "",
        status: "PUBLISHED",
      },
      limit: 1,
    },
    { enabled: Boolean(translationKey?.applicationId) }
  )

  if (!translationKey || versionsQuery.isLoading) {
    return null
  }

  const live = versionsQuery.data?.data[0] ?? null
  const publishedVersion = live?.version ?? null
  const inRelease = isInPublishedVersion(translationKey, publishedVersion)
  const isSignedOff = cell?.status === "PUBLISHED"
  const delivered = inRelease && isSignedOff && Boolean(cell?.value)

  const frozenInto = translationKey.firstSeenVersion ?? null
  const droppedIn = translationKey.disabledInVersion ?? null

  // Why it is not delivered, in the order a person would ask. Version first: no amount of
  // approving fixes a key that is not in the shipped release.
  const blocker = delivered
    ? null
    : !inRelease
      ? publishedVersion === null
        ? "this key is disabled"
        : frozenInto === null
          ? `not in any release yet — it will ship once a version cut after now is published`
          : frozenInto > publishedVersion
            ? `frozen into version ${frozenInto}, which is not published yet (v${publishedVersion} is live)`
            : `dropped in version ${droppedIn}, which is live`
      : !cell?.value
        ? "there is no translation yet"
        : `the cell is ${String(cell.status ?? "not signed off").toLowerCase()}, not signed off`

  const Icon = delivered
    ? PackageCheckIcon
    : inRelease
      ? PackageIcon
      : CircleSlashIcon

  return (
    <div className="mt-2 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            delivered ? "text-emerald-600" : "text-muted-foreground"
          )}
        />
        <span className="text-xs font-medium">
          {delivered ? "Delivered to applications" : "Not delivered"}
        </span>

        {frozenInto !== null ? (
          <Badge variant="outline" className="font-mono text-[10px]">
            in v{frozenInto}
            {droppedIn !== null ? ` – v${droppedIn}` : ""}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            not in a release
          </Badge>
        )}

        {publishedVersion !== null ? (
          <Badge className="border-transparent bg-emerald-500/15 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
            v{publishedVersion} live
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            nothing published
          </Badge>
        )}
      </div>

      {blocker ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Because {blocker}.</p>
      ) : null}
    </div>
  )
}
