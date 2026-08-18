import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

/**
 * Programmatic navigation to a string path, for the same reason as `AppLink`.
 *
 * `href` is the router's supported string form of a navigation target: a relative value
 * stays a client-side transition, and only an absolute URL triggers a document load.
 */
export function useAppNavigate() {
  const navigate = useNavigate()

  return useCallback((to: string) => navigate({ href: to }), [navigate])
}
