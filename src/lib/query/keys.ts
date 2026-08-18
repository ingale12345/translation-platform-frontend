import type { Id, ListQuery } from "@/types/api"

/**
 * Query keys for one resource, built from its service path.
 *
 * The hierarchy matters: `all` → `lists()` → `list(query)` and `all` → `detail(id)`. A
 * mutation invalidates `all` and every cached page and detail underneath it goes stale in
 * one call, which is why keys are never assembled ad hoc at the call site.
 */
export const createResourceKeys = <TQuery>(path: string) => {
  const all = [path] as const

  return {
    all,
    lists: () => [...all, "list"] as const,
    list: (query?: ListQuery<TQuery>) => [...all, "list", query ?? {}] as const,
    details: () => [...all, "detail"] as const,
    detail: (id: Id | undefined) => [...all, "detail", id] as const,
    /** Anything a feature caches that is neither a list nor a record. */
    scoped: (
      ...segments: ReadonlyArray<string | number | object | undefined>
    ) => [...all, ...segments] as const,
  }
}

export type ResourceKeys<TQuery> = ReturnType<typeof createResourceKeys<TQuery>>

/** Keys for the session-scoped endpoints, which are not resources. */
export const sessionKeys = {
  all: ["session"] as const,
  memberships: () => ["session", "memberships"] as const,
  permissions: (projectId: Id | null) =>
    ["session", "permissions", projectId] as const,
}
