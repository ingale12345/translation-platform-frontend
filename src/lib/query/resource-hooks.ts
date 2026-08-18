import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query"

import type { ApiError } from "@/lib/http/errors"
import { createResourceKeys } from "./keys"
import type { ResourceService } from "@/services/resource"
import type { Entity, Id, ListQuery, Paginated, Where } from "@/types/api"
import { DEFAULT_PAGE_SIZE } from "@/types/api"

/** Options a caller may pass through, minus the parts the factory owns. */
type QueryOpts<TData> = Omit<
  UseQueryOptions<TData, ApiError, TData>,
  "queryKey" | "queryFn"
>

/**
 * `TOnMutateResult` is whatever an `onMutate` returned; this factory never sets one, so
 * it is always `undefined` here — it is threaded through only so a caller's own
 * `onMutate` / `onSuccess` pair stays type-safe.
 */
type MutationOpts<TData, TVars> = Omit<
  UseMutationOptions<TData, ApiError, TVars, unknown>,
  "mutationFn"
>

export interface PatchVars<TPatch> {
  id: Id
  data: TPatch
}

export interface PatchWhereVars<TPatch, TQuery> {
  where: Where<TQuery>
  data: TPatch
}

/**
 * The TanStack Query layer for one resource.
 *
 * Pairs with `createResourceService`: the service knows how to talk to the API, these
 * hooks know how to cache it. Because both are generated from the same generics, a
 * feature gets typed `useList` / `useCreate` / … for the cost of one line, and cache
 * invalidation is identical everywhere instead of being re-decided per screen.
 *
 * @example
 * const projects = createResourceHooks(projectsService)
 * const { data } = projects.useList({ where: { status: "active" }, limit: 25 })
 */
export const createResourceHooks = <
  TModel extends Entity,
  TCreate,
  TPatch,
  TQuery = TModel,
>(
  service: ResourceService<TModel, TCreate, TPatch, TQuery>
) => {
  const keys = createResourceKeys<TQuery>(service.path)

  /** Every list and detail for this resource is refetched. */
  const useInvalidate = () => {
    const queryClient = useQueryClient()

    return () => queryClient.invalidateQueries({ queryKey: keys.all })
  }

  /** One page. `enabled: false` keeps a dependent list from firing before its id exists. */
  const useList = (
    query?: ListQuery<TQuery>,
    options?: QueryOpts<Paginated<TModel>>
  ) =>
    useQuery({
      queryKey: keys.list(query),
      queryFn: ({ signal }) => service.list(query, { signal }),
      ...options,
    })

  /** Every match as a flat array — for pickers and selects, not for tables. */
  const useListAll = (
    query?: Omit<ListQuery<TQuery>, "paginate">,
    options?: QueryOpts<TModel[]>
  ) =>
    useQuery({
      queryKey: keys.scoped("all-records", query ?? {}),
      queryFn: ({ signal }) => service.listAll(query, { signal }),
      ...options,
    })

  /**
   * Page-by-page loading for long lists. Paging is derived from `total` / `skip` on the
   * response, so the caller never tracks offsets by hand.
   */
  const useInfiniteList = (
    query?: Omit<ListQuery<TQuery>, "skip">,
    options?: Omit<
      UseInfiniteQueryOptions<
        Paginated<TModel>,
        ApiError,
        // `TData` defaults to `TQueryFnData`, not `InfiniteData<…>`. Leaving it at the
        // default types `data` as a single page, so `data.pages` does not exist and every
        // caller has to cast. Naming it here is what makes the hook usable.
        InfiniteData<Paginated<TModel>>,
        QueryKey,
        number
      >,
      "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
    >
  ) => {
    const limit = query?.limit ?? DEFAULT_PAGE_SIZE

    return useInfiniteQuery({
      queryKey: keys.scoped("infinite", query ?? {}),
      queryFn: ({ pageParam, signal }) =>
        service.list(
          { ...query, limit, skip: pageParam as number },
          { signal }
        ),
      initialPageParam: 0,
      getNextPageParam: (lastPage: Paginated<TModel>) => {
        const loaded = lastPage.skip + lastPage.data.length

        return loaded < lastPage.total ? loaded : undefined
      },
      ...options,
    })
  }

  const useOne = (
    id: Id | undefined,
    query?: Pick<ListQuery<TQuery>, "select">,
    options?: QueryOpts<TModel>
  ) =>
    useQuery({
      queryKey: keys.detail(id),
      queryFn: ({ signal }) => service.get(id as Id, query, { signal }),
      enabled: Boolean(id),
      ...options,
    })

  const useCreate = (options?: MutationOpts<TModel, TCreate>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: (data: TCreate) => service.create(data),
      ...options,
      onSuccess: async (created, variables, onMutateResult, context) => {
        queryClient.setQueryData(keys.detail(created._id), created)
        await queryClient.invalidateQueries({ queryKey: keys.all })
        await options?.onSuccess?.(created, variables, onMutateResult, context)
      },
    })
  }

  const useUpdate = (options?: MutationOpts<TModel, PatchVars<TPatch>>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ id, data }: PatchVars<TPatch>) => service.patch(id, data),
      ...options,
      onSuccess: async (updated, variables, onMutateResult, context) => {
        queryClient.setQueryData(keys.detail(variables.id), updated)
        await queryClient.invalidateQueries({ queryKey: keys.all })
        await options?.onSuccess?.(updated, variables, onMutateResult, context)
      },
    })
  }

  const useUpdateWhere = (
    options?: MutationOpts<TModel[], PatchWhereVars<TPatch, TQuery>>
  ) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ where, data }: PatchWhereVars<TPatch, TQuery>) =>
        service.patchWhere(where, data),
      ...options,
      onSuccess: async (updated, variables, onMutateResult, context) => {
        await queryClient.invalidateQueries({ queryKey: keys.all })
        await options?.onSuccess?.(updated, variables, onMutateResult, context)
      },
    })
  }

  const useRemove = (options?: MutationOpts<TModel, Id>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: (id: Id) => service.remove(id),
      ...options,
      onSuccess: async (removed, id, onMutateResult, context) => {
        queryClient.removeQueries({ queryKey: keys.detail(id) })
        await queryClient.invalidateQueries({ queryKey: keys.all })
        await options?.onSuccess?.(removed, id, onMutateResult, context)
      },
    })
  }

  return {
    keys,
    service,
    useInvalidate,
    useList,
    useListAll,
    useInfiniteList,
    useOne,
    useCreate,
    useUpdate,
    useUpdateWhere,
    useRemove,
  }
}

export type ResourceHooks<
  TModel extends Entity,
  TCreate,
  TPatch,
  TQuery = TModel,
> = ReturnType<typeof createResourceHooks<TModel, TCreate, TPatch, TQuery>>
