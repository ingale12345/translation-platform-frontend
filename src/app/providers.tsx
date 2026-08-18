import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useEffect } from "react"
import type { ReactNode } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { env } from "@/config/env"
import { setUnauthorizedHandler } from "@/lib/http/request-context"
import { useSessionStore } from "@/stores/session.store"
import { queryClient } from "./query-client"

/**
 * Every cross-cutting provider, in one place.
 *
 * Also registers the 401 handler: the HTTP layer cannot import the session store without
 * a cycle, so the wiring happens here, where both are already in scope.
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      useSessionStore.getState().signOut()
      queryClient.clear()
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          {children}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
      {env.isDev ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}
