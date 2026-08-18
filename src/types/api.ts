/**
 * The request/response contract shared by every service on the platform.
 *
 * The backend is FeathersJS, so every list response is `{ total, limit, skip, data }` and
 * every error is `{ name, message, code, className }`. Modelling that once here is what
 * lets `createResourceService` and `createResourceHooks` stay fully generic.
 */

/** A MongoDB ObjectId, serialised as a string on the wire. */
export type Id = string

/** Audit columns every collection carries (`baseSchema` on the backend). */
export interface AuditFields {
  createdBy?: Id
  updatedBy?: Id
  createdAt?: string
  updatedAt?: string
  deletedBy?: Id
  deletedAt?: string
  deleted?: boolean
  isActive?: boolean
  isDeleted?: boolean
}

/** Anything the API can address by id. The constraint used across the generic layer. */
export interface Entity extends AuditFields {
  _id: Id
}

/** A Feathers paginated `find` result. */
export interface Paginated<T> {
  total: number
  limit: number
  skip: number
  data: T[]
}

/** The JSON body a Feathers error handler returns. */
export interface ApiErrorBody {
  name: string
  message: string
  code: number
  className: string
  data?: unknown
  errors?: unknown
}

/* -------------------------------------------------------------------------- *
 * Query model
 * -------------------------------------------------------------------------- */

/**
 * Comparison operators the backend allows per property. Mirrors the adapter's operator
 * list plus `$exists`, which `buildQuerySchema` declares on every field.
 */
export interface FieldOperators<V> {
  $in?: V[]
  $nin?: V[]
  $lt?: V
  $lte?: V
  $gt?: V
  $gte?: V
  $ne?: V
  $exists?: boolean
  /** String fields only. Always pair with `$options: 'i'` — see `contains()`. */
  $regex?: string
  $options?: "i"
}

/** Either an exact match or an operator object. */
export type FieldFilter<V> = V | FieldOperators<V>

export type Filters<T> = {
  [K in keyof T]?: FieldFilter<T[K]>
}

/** Property filters plus the two logical combinators Feathers supports. */
export type Where<T> = Filters<T> & {
  $or?: Filters<T>[]
  $and?: Filters<T>[]
}

/** String keys of a model — the only things that can be sorted or selected. */
export type FieldName<T> = Extract<keyof T, string>

/** Accepts a single field or a list, so callers do not have to wrap one value in an array. */
export type OneOrMany<T> = T | T[]

/**
 * A list request in the shape the UI thinks in. `buildListParams` translates it into the
 * flat query the backend's `normalize-query` hook expects (`limit`, `skip`, `sortAsc`,
 * `sortDesc`, `select`, `isExists`, `isNotExists`, `paginate`), so no screen has to know
 * about `$limit` / `$sort` syntax.
 */
export interface ListQuery<T> {
  /** Property filters — `{ status: 'active', _id: { $in: [...] } }`. */
  where?: Where<T>
  limit?: number
  skip?: number
  /** Ascending sort field(s). Combined with `sortDesc` into a single `$sort`. */
  sortAsc?: OneOrMany<FieldName<T>>
  /** Descending sort field(s). Defaults to `createdAt` server-side when both are absent. */
  sortDesc?: OneOrMany<FieldName<T>>
  /** Projection — only these fields come back. */
  select?: FieldName<T>[]
  /** Fields that must be present on the document. */
  isExists?: OneOrMany<FieldName<T>>
  /** Fields that must be absent — the idiomatic "not soft-deleted" filter. */
  isNotExists?: OneOrMany<FieldName<T>>
  /** Pass `false` to get every match as a plain array instead of a page. */
  paginate?: false
}

/** Page state as list screens hold it, before it becomes `limit` / `skip`. */
export interface PageState {
  pageIndex: number
  pageSize: number
}

export const DEFAULT_PAGE_SIZE = 25
