import { QueryClient } from "@tanstack/react-query"

import { isApiError } from "@/lib/http/errors"

/**
 * Cache and retry policy for the whole app.
 *
 * The important decision is the retry rule: a 4xx means the request was wrong and will be
 * wrong again, so retrying it only delays the error the user needs to see. Network
 * failures and 5xx are transient and worth a couple of attempts.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) {
          return false
        }

        return failureCount < 2
      },
    },
    mutations: {
      // A mutation is not idempotent — a retried create can produce two records.
      retry: false,
    },
  },
})
