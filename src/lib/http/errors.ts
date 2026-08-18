import axios from "axios"

import type { ApiErrorBody } from "@/types/api"

/**
 * Every rejection that leaves the HTTP layer is an `ApiError`, so callers never have to
 * branch on "is this an AxiosError, a network failure, or something the server said?".
 */
export class ApiError extends Error {
  /** The Feathers error name — `BadRequest`, `NotAuthenticated`, `Forbidden`, … */
  readonly errorName: string
  /** HTTP status. `0` when the request never reached the server. */
  readonly status: number
  readonly className: string
  /** Per-field messages, when the failure was schema validation. */
  readonly fieldErrors: Record<string, string>
  readonly body?: ApiErrorBody

  constructor(init: {
    message: string
    errorName: string
    status: number
    className: string
    fieldErrors?: Record<string, string>
    body?: ApiErrorBody
    cause?: unknown
  }) {
    super(init.message, { cause: init.cause })
    this.name = "ApiError"
    this.errorName = init.errorName
    this.status = init.status
    this.className = init.className
    this.fieldErrors = init.fieldErrors ?? {}
    this.body = init.body
  }

  get isUnauthenticated() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }

  get isNotFound() {
    return this.status === 404
  }

  get isConflict() {
    return this.status === 409
  }

  /** A network/timeout failure — worth retrying, unlike a 4xx. */
  get isNetworkError() {
    return this.status === 0
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError

/**
 * Feathers reports schema failures in `errors`, either as `{ field: message }` or as the
 * raw AJV array. Both are flattened to `{ field: message }` so a form can drop them
 * straight onto its inputs.
 */
const toFieldErrors = (errors: unknown): Record<string, string> => {
  if (!errors) {
    return {}
  }

  if (Array.isArray(errors)) {
    const out: Record<string, string> = {}

    for (const entry of errors) {
      if (!entry || typeof entry !== "object") {
        continue
      }

      const ajv = entry as {
        instancePath?: string
        params?: { missingProperty?: string }
        message?: string
      }
      const field =
        ajv.params?.missingProperty ?? ajv.instancePath?.replace(/^\//, "")

      if (field && ajv.message) {
        out[field] = ajv.message
      }
    }

    return out
  }

  if (typeof errors === "object") {
    return Object.fromEntries(
      Object.entries(errors as Record<string, unknown>).map(
        ([field, message]) => [
          field,
          typeof message === "string" ? message : JSON.stringify(message),
        ]
      )
    )
  }

  return {}
}

const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again."

/** Normalises anything thrown by axios — or by our own code — into an `ApiError`. */
export const toApiError = (error: unknown): ApiError => {
  if (isApiError(error)) {
    return error
  }

  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined

    if (!error.response) {
      return new ApiError({
        message:
          error.code === "ECONNABORTED"
            ? "The request timed out."
            : NETWORK_MESSAGE,
        errorName: "NetworkError",
        status: 0,
        className: "network-error",
        cause: error,
      })
    }

    return new ApiError({
      message: body?.message ?? error.message,
      errorName: body?.name ?? "GeneralError",
      status: body?.code ?? error.response.status,
      className: body?.className ?? "general-error",
      fieldErrors: toFieldErrors(body?.errors),
      body,
      cause: error,
    })
  }

  return new ApiError({
    message: error instanceof Error ? error.message : "Something went wrong.",
    errorName: "GeneralError",
    status: 0,
    className: "general-error",
    cause: error,
  })
}

/** The message to show a user. Keeps 5xx internals out of the UI. */
export const errorMessage = (error: unknown): string => {
  const apiError = toApiError(error)

  if (apiError.status >= 500) {
    return "Something went wrong on our side. Please try again."
  }

  return apiError.message
}
