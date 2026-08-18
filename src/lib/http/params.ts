import type { ListQuery, OneOrMany } from "@/types/api"

/**
 * Translates a `ListQuery<T>` into the flat query object axios serialises onto the URL.
 *
 * The backend's app-level `normalize-query` hook accepts UI-friendly aliases and rewrites
 * them into Feathers syntax before validation:
 *
 *   limit / skip          → $limit / $skip
 *   sortAsc / sortDesc    → $sort: { field: 1 | -1 }
 *   select                → $select
 *   isExists / isNotExists→ field: { $exists: true | false }
 *   paginate=false        → params.paginate = false
 *
 * Filters in `where` are already Feathers syntax (`{ $in: [...] }`) and pass straight
 * through. Undefined and empty values are dropped so `?status=` never reaches the server,
 * where an empty string would be a real filter rather than "no filter".
 */
export const buildListParams = <T>(
  query: ListQuery<T> = {}
): Record<string, unknown> => {
  const params: Record<string, unknown> = {}

  const where = (query.where ?? {}) as Record<string, unknown>

  for (const [field, value] of Object.entries(where)) {
    if (value === undefined || value === null || value === "") {
      continue
    }

    params[field] = value
  }

  if (query.limit !== undefined) {
    params.limit = query.limit
  }

  if (query.skip !== undefined) {
    params.skip = query.skip
  }

  assign(params, "sortAsc", query.sortAsc)
  assign(params, "sortDesc", query.sortDesc)
  assign(params, "isExists", query.isExists)
  assign(params, "isNotExists", query.isNotExists)

  if (query.select?.length) {
    params.select = query.select
  }

  if (query.paginate === false) {
    params.paginate = false
  }

  return params
}

const assign = (
  params: Record<string, unknown>,
  key: string,
  value: OneOrMany<string> | undefined
) => {
  if (value === undefined) {
    return
  }

  const list = Array.isArray(value) ? value : [value]

  if (list.length > 0) {
    params[key] = list
  }
}

/** Page index / size as the list endpoints want them. */
export const toPageParams = (pageIndex: number, pageSize: number) => ({
  limit: pageSize,
  skip: pageIndex * pageSize,
})

/**
 * Escapes regex metacharacters so a search for `a.b` matches the literal text rather than
 * "a, any character, b". The backend caps pattern length and pins `$options` to `i`; this
 * keeps a user's typing from being read as a pattern in the first place.
 */
export const escapeRegex = (input: string) =>
  input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** A case-insensitive "contains" filter for a single field. */
export const contains = (value: string) => ({
  $regex: escapeRegex(value.trim()),
  $options: "i" as const,
})
