/**
 * The ambient values every request needs — access token and tenant scope — held outside
 * React and outside the session store.
 *
 * The axios interceptors need them, and the session store needs axios (to log in), so a
 * direct import either way would be circular. This module is the seam: the store pushes
 * values in, the interceptors read them out, and neither imports the other.
 */

export interface RequestContext {
  accessToken: string | null
  organizationId: string | null
  projectId: string | null
}

let context: RequestContext = {
  accessToken: null,
  organizationId: null,
  projectId: null,
}

export const getRequestContext = (): RequestContext => context

export const setRequestContext = (patch: Partial<RequestContext>): void => {
  context = { ...context, ...patch }
}

export const clearRequestContext = (): void => {
  context = { accessToken: null, organizationId: null, projectId: null }
}

/**
 * Called when the API rejects the current token. The app registers a handler that clears
 * the session and sends the user to /login; the HTTP layer stays unaware of routing.
 */
type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

export const setUnauthorizedHandler = (
  handler: UnauthorizedHandler | null
): void => {
  onUnauthorized = handler
}

export const notifyUnauthorized = (): void => {
  onUnauthorized?.()
}
