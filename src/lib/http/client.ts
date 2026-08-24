import axios from "axios"
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios"

import { env } from "@/config/env"
import { ApiError, toApiError } from "./errors"
import { getRequestContext, notifyUnauthorized } from "./request-context"

/**
 * The one axios instance the whole app talks through.
 *
 * Everything that must happen on *every* call lives here — bearer token, tenant headers,
 * error normalisation — so no service or hook ever reaches for `axios` directly and no
 * screen can accidentally send an untenanted request.
 */
export const http: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: {
    "Content-Type": "application/json",
  },
})

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * Opts a request out of the global 401 handler. Only the login call sets it: a wrong
     * password would otherwise read as an expired session and log the user out.
     */
    skipAuthRedirect?: boolean
    /**
     * Sends no `X-Project-Id`, so the server scopes the request to everything the caller
     * may see rather than to the project in the switcher. Set from `ListQuery.unscoped`.
     */
    skipProjectHeader?: boolean
  }
}

type Config = InternalAxiosRequestConfig

http.interceptors.request.use((config: Config) => {
  const { accessToken, organizationId, projectId } = getRequestContext()

  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`)
  }

  // Tenant scope. The backend resolves authorization from these, so sending them on every
  // request is what makes project switching work without threading ids through each call.
  if (organizationId) {
    config.headers.set("X-Organization-Id", organizationId)
  }

  if (projectId && !config.skipProjectHeader) {
    config.headers.set("X-Project-Id", projectId)
  }

  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)
    const config = axios.isAxiosError(error)
      ? (error.config as Config | undefined)
      : undefined

    // An expired or revoked token invalidates the whole session, not just this call.
    // The login request opts out, so a wrong password does not read as a session timeout.
    if (apiError.isUnauthenticated && !config?.skipAuthRedirect) {
      notifyUnauthorized()
    }

    return Promise.reject(apiError)
  }
)

export { ApiError }
