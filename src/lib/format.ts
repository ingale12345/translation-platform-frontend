import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"

/**
 * Display formatting. Centralised so every date in the console reads the same way — a
 * screen that rolls its own `toLocaleString` drifts from the rest within a release.
 */

const toDate = (value: string | Date | undefined | null): Date | null => {
  if (!value) {
    return null
  }

  const date = typeof value === "string" ? parseISO(value) : value

  return isValid(date) ? date : null
}

/** `18 Aug 2026, 14:30` — the default for timestamps in tables and drawers. */
export const formatDateTime = (
  value: string | Date | undefined | null
): string => {
  const date = toDate(value)

  return date ? format(date, "dd MMM yyyy, HH:mm") : "—"
}

/** `18 Aug 2026` — for dates where the time carries no meaning. */
export const formatDate = (value: string | Date | undefined | null): string => {
  const date = toDate(value)

  return date ? format(date, "dd MMM yyyy") : "—"
}

/** `3 hours ago` — for activity feeds, where recency matters more than the exact time. */
export const formatRelative = (
  value: string | Date | undefined | null
): string => {
  const date = toDate(value)

  return date ? formatDistanceToNow(date, { addSuffix: true }) : "—"
}

/** `JD` — avatar fallback. */
export const initials = (first?: string, last?: string): string => {
  const a = first?.trim()?.[0] ?? "?"
  const b = last?.trim()?.[0] ?? ""

  return `${a}${b}`.toUpperCase()
}

export const fullName = (
  user: { firstName?: string; lastName?: string } | undefined
): string =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unknown user"

/** `1,204` — thousands separators for counts. */
export const formatNumber = (value: number): string => value.toLocaleString()

/** `72%` from a 0–100 value. */
export const formatPercent = (value: number): string => `${Math.round(value)}%`

/** Truncates to `max` characters with an ellipsis, without cutting mid-word where possible. */
export const truncate = (value: string, max: number): string => {
  if (value.length <= max) {
    return value
  }

  const clipped = value.slice(0, max)
  const lastSpace = clipped.lastIndexOf(" ")

  return `${lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped}…`
}
