import { Link } from "@tanstack/react-router"
import type { ComponentProps, ReactNode } from "react"

type LinkProps = Omit<ComponentProps<typeof Link>, "to">

interface AppLinkProps extends LinkProps {
  /** An in-app path, e.g. "/audit". */
  to: string
  children?: ReactNode
}

/**
 * An in-app link whose target is a plain string.
 *
 * TanStack Router types `to` against the route tree, but the tree is assembled from the
 * very modules that render these links, so inside a page component the tree is only
 * partly known and a perfectly valid path like "/audit" is rejected. Routing app links
 * through here states that once instead of scattering casts.
 *
 * The trade-off is real: these paths are checked by the router at runtime, not by the
 * compiler. Lazy page routes were tried and do not fix it — the cycle runs through
 * `AppShell`, which the tree imports statically and which renders its own links. Breaking
 * it properly means file-based routing with a generated route tree; tracked in
 * docs/UI_PLAN.md §6.
 *
 * `useAppNavigate` in `lib/navigate.ts` is the same escape for programmatic navigation.
 */
export function AppLink({ to, children, ...props }: AppLinkProps) {
  return (
    <Link to={to} {...props}>
      {children}
    </Link>
  )
}
