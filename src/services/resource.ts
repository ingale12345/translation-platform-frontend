import type { AxiosRequestConfig } from "axios"

import { http } from "@/lib/http/client"
import { buildListParams } from "@/lib/http/params"
import type { Entity, Id, ListQuery, Paginated, Where } from "@/types/api"

/**
 * A typed client for one Feathers service.
 *
 * `TModel` is what comes back, `TCreate` is the POST body, `TPatch` is the PATCH body.
 * They differ in practice — a create omits `_id` and the audit columns, a patch is
 * partial — so keeping them separate stops a screen from posting a whole entity where the
 * backend's data schema only accepts a subset.
 *
 * `TQuery` defaults to `TModel` and only differs where a service exposes virtual query
 * fields the model itself does not carry.
 */
export interface ResourceService<
  TModel extends Entity,
  TCreate = Omit<TModel, keyof Entity>,
  TPatch = Partial<TCreate>,
  TQuery = TModel,
> {
  readonly path: string

  /** `GET /path` — one page of results. */
  list(
    query?: ListQuery<TQuery>,
    config?: AxiosRequestConfig
  ): Promise<Paginated<TModel>>
  /** `GET /path?paginate=false` — every match, for pickers and exports. */
  listAll(
    query?: Omit<ListQuery<TQuery>, "paginate">,
    config?: AxiosRequestConfig
  ): Promise<TModel[]>
  /** `GET /path/:id` */
  get(
    id: Id,
    query?: Pick<ListQuery<TQuery>, "select">,
    config?: AxiosRequestConfig
  ): Promise<TModel>
  /** `POST /path` */
  create(data: TCreate, config?: AxiosRequestConfig): Promise<TModel>
  /** `POST /path` with an array body — Feathers creates them all in one call. */
  createMany(data: TCreate[], config?: AxiosRequestConfig): Promise<TModel[]>
  /** `PATCH /path/:id` */
  patch(id: Id, data: TPatch, config?: AxiosRequestConfig): Promise<TModel>
  /** `PATCH /path` with a filter — bulk update every matching record. */
  patchWhere(
    where: Where<TQuery>,
    data: TPatch,
    config?: AxiosRequestConfig
  ): Promise<TModel[]>
  /** `DELETE /path/:id` */
  remove(id: Id, config?: AxiosRequestConfig): Promise<TModel>
  /** `DELETE /path` with a filter — bulk delete every matching record. */
  removeWhere(
    where: Where<TQuery>,
    config?: AxiosRequestConfig
  ): Promise<TModel[]>
}

/**
 * Builds the CRUD client for a Feathers service path.
 *
 * Every service on the platform follows the same REST conventions, so this exists once
 * and each feature is a single line rather than seven near-identical axios calls.
 *
 * @example
 * export const projectsService = createResourceService<Project, ProjectCreate, ProjectPatch>("projects")
 */
export const createResourceService = <
  TModel extends Entity,
  TCreate = Omit<TModel, keyof Entity>,
  TPatch = Partial<TCreate>,
  TQuery = TModel,
>(
  path: string
): ResourceService<TModel, TCreate, TPatch, TQuery> => {
  const url = (id?: Id) => (id ? `/${path}/${id}` : `/${path}`)

  return {
    path,

    async list(query, config) {
      const { data } = await http.get<Paginated<TModel>>(url(), {
        ...config,
        skipProjectHeader: query?.unscoped,
        params: { ...buildListParams(query), ...config?.params },
      })

      return data
    },

    async listAll(query, config) {
      const { data } = await http.get<TModel[]>(url(), {
        ...config,
        skipProjectHeader: query?.unscoped,
        params: {
          ...buildListParams({ ...query, paginate: false }),
          ...config?.params,
        },
      })

      return data
    },

    async get(id, query, config) {
      const { data } = await http.get<TModel>(url(id), {
        ...config,
        params: { ...buildListParams(query), ...config?.params },
      })

      return data
    },

    async create(payload, config) {
      const { data } = await http.post<TModel>(url(), payload, config)

      return data
    },

    async createMany(payload, config) {
      const { data } = await http.post<TModel[]>(url(), payload, config)

      return data
    },

    async patch(id, payload, config) {
      const { data } = await http.patch<TModel>(url(id), payload, config)

      return data
    },

    async patchWhere(where, payload, config) {
      const { data } = await http.patch<TModel[]>(url(), payload, {
        ...config,
        params: { ...buildListParams<TQuery>({ where }), ...config?.params },
      })

      return data
    },

    async remove(id, config) {
      const { data } = await http.delete<TModel>(url(id), config)

      return data
    },

    async removeWhere(where, config) {
      const { data } = await http.delete<TModel[]>(url(), {
        ...config,
        params: { ...buildListParams<TQuery>({ where }), ...config?.params },
      })

      return data
    },
  }
}
