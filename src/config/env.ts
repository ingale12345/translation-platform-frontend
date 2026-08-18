/**
 * Typed access to the Vite environment. Reading `import.meta.env` directly anywhere else
 * spreads untyped `string | undefined` through the app and hides a missing variable until
 * a request 404s at runtime.
 */

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`
    )
  }

  return value
}

export const env = {
  /** Base URL of the FeathersJS management API, e.g. http://localhost:3030 */
  apiUrl: required(import.meta.env.VITE_API_URL, "VITE_API_URL"),
  /** Request timeout in milliseconds. */
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT ?? 30_000),
  appName: import.meta.env.VITE_APP_NAME ?? "Localize",
  isDev: import.meta.env.DEV,
} as const
