# Translation Platform — Console

The web console for the Localization Management Platform. It talks to the FeathersJS API
in [`../translation-platform`](../translation-platform).

**Stack:** React 19 · TypeScript · Vite · Tailwind 4 · shadcn/ui (base-nova) ·
TanStack Query · TanStack Router · axios · Zustand · react-hook-form + Zod

---

## Getting started

```bash
pnpm install
cp .env.example .env      # point VITE_API_URL at the running API
pnpm dev
```

The API must be running separately:

```bash
cd ../translation-platform
docker compose up -d mongodb   # or run mongod yourself
pnpm seed:day0 && pnpm seed:dev
pnpm dev                       # http://localhost:3030
```

| Script | Does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Typecheck (`tsc -b`) then production build |
| `pnpm typecheck` | Types only |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

### Environment

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | yes | Base URL of the management API, e.g. `http://localhost:3030` |
| `VITE_API_TIMEOUT` | no | Request timeout in ms (default `30000`) |
| `VITE_APP_NAME` | no | Product name in the sidebar (default `Localize`) |

`src/config/env.ts` throws on startup if a required variable is missing — a missing base
URL should fail loudly at boot, not as a 404 on the first request.

---

## Architecture

The data layer is built from two generic factories. Adding a backend service to the
console is two lines, and every screen gets the same caching, error handling and query
syntax for free.

```
component
   │  useProjects({ where: { status: "active" }, limit: 25 })
   ▼
features/<domain>/hooks.ts        createResourceHooks(service)   ← TanStack Query
   ▼
services/index.ts                 createResourceService(path)    ← typed CRUD
   ▼
lib/http/client.ts                axios instance                 ← auth + tenant headers
   ▼
FeathersJS API
```

### Directory map

| Path | Holds |
|---|---|
| `src/types/api.ts` | `Paginated<T>`, `ListQuery<T>`, `Where<T>`, `Entity` — the request/response contract |
| `src/types/models.ts` | Domain models mirroring the backend TypeBox schemas, each with `…Create` / `…Patch` |
| `src/types/session.ts` | Auth and `GET /me/*` contracts |
| `src/lib/http/` | axios instance, error normalisation, query-param builder, request context |
| `src/services/` | `createResourceService` plus one typed client per API service |
| `src/lib/query/` | Query-key factory and `createResourceHooks` |
| `src/lib/rbac.ts` | `can()`, entitlement codes, permission-action metadata |
| `src/stores/session.store.ts` | Token, user and active tenant (persisted) |
| `src/features/<domain>/` | Feature hooks, components and pages |
| `src/components/ui/` | shadcn primitives — regenerate with the CLI, avoid hand edits |
| `src/components/common/` | Cross-feature building blocks (see below) |
| `src/components/layout/` | App shell, sidebar, topbar, project switcher |
| `src/app/` | Providers, query client, route tree, router, lazy-page factory |

### The HTTP layer

One axios instance (`src/lib/http/client.ts`) carries everything that must happen on
every call:

- **Bearer token** and the **`X-Organization-Id` / `X-Project-Id`** tenant headers, read
  from `request-context.ts`. The session store pushes values in; the interceptors read
  them out. Neither imports the other, which is what keeps the store ↔ axios dependency
  from becoming a cycle.
- **Error normalisation.** Every rejection is an `ApiError` with `status`, `errorName`,
  `fieldErrors` and helpers like `isForbidden`. Callers never branch on `AxiosError`.
- **401 handling.** A rejected token clears the session. The login request opts out via
  `skipAuthRedirect`, so a wrong password does not read as a session timeout.

### Query syntax

`ListQuery<T>` is written the way a screen thinks, and `buildListParams` translates it
into the aliases the backend's `normalize-query` hook accepts:

```ts
useTranslationKeys({
  where: { projectId, key: contains("login") },
  sortAsc: "key",
  limit: 50,
  skip: 100,
})
// → ?projectId=…&key[$regex]=login&key[$options]=i&sortAsc=key&limit=50&skip=100
```

| `ListQuery` | Wire | Server rewrites to |
|---|---|---|
| `limit` / `skip` | `limit` / `skip` | `$limit` / `$skip` |
| `sortAsc` / `sortDesc` | same | `$sort: { field: ±1 }` |
| `select` | `select` | `$select` |
| `isExists` / `isNotExists` | same | `field: { $exists: … }` |
| `paginate: false` | `paginate=false` | unpaginated array |
| `where` | passed through | Feathers operators (`$in`, `$ne`, `$regex`, …) |

Always build a text filter with `contains()` from `lib/http/params.ts` — it escapes regex
metacharacters so a search for `a.b` matches literal text.

### Adding a service

```ts
// 1. Model it (src/types/models.ts)
export interface Widget extends Entity { projectId: Id; name: string }
export type WidgetCreate = Omit<Widget, keyof Entity>
export type WidgetPatch = Partial<WidgetCreate>

// 2. Register the client (src/services/index.ts)
export const widgetsService = createResourceService<Widget, WidgetCreate, WidgetPatch>("widgets")

// 3. Generate the hooks (src/features/widgets/hooks.ts)
export const widgetQueries = createResourceHooks(widgetsService)
export const {
  useList: useWidgets,
  useOne: useWidget,
  useCreate: useCreateWidget,
  useUpdate: useUpdateWidget,
  useRemove: useRemoveWidget,
} = widgetQueries
```

You now have `useList`, `useListAll`, `useInfiniteList`, `useOne`, `useCreate`,
`useUpdate`, `useUpdateWhere` and `useRemove`, all typed, all invalidating the same key
hierarchy.

---

## Permissions

Permissions come from **one place**: `GET /me/permissions?projectId=…`. The server does
the merge described in [`../translation-platform/docs/RBAC.md`](../translation-platform/docs/RBAC.md)
— union across the member's roles, masked by each entitlement's `applicablePermissions` —
and returns a flat matrix. The client only reads it, so the two can never disagree.

```tsx
// Hide a control
<Can entitlement={ENTITLEMENTS.TRANSLATIONS} action="create">
  <Button>Add key</Button>
</Can>

// Branch on it
const { can } = usePermissions()
const canEdit = can(ENTITLEMENTS.TRANSLATIONS, "update")
```

Three rules:

1. **This is presentation, not enforcement.** The server re-checks every request. The
   point is that a user is never shown a control that would 403.
2. **Hide, do not disable.** A disabled button invites the question "why?"; an absent one
   does not. The Permissions dialog in the topbar answers "why?" properly, with the
   matrix.
3. **While loading, `can()` is `false`.** The UI opens closed rather than flashing a
   button the user is about to lose.

Navigation is derived from the same matrix: `src/config/nav.ts` names the entitlement that
gates each link, so a role without `TRANSLATIONS:read` has no Translations link *and* no
way to reach the page.

---

## Common components

| Component | Use for |
|---|---|
| `PageHeader` | Title + description + actions, on every page |
| `DataTable<TRow>` | Typed list tables with loading / error / empty states |
| `QueryBoundary` | The loading → error → empty → content ladder |
| `EmptyState` | "Nothing here" — say what to do next, not just that it is empty |
| `Can` | Permission gating (use `usePermissions()` when the answer drives more than rendering) |
| `FormField` | Label + control + error, with the `id` wiring done once |
| `MultiSelect` | Multi-select with removable chips |
| `AppLink` | In-app link with a string target — see its note on router typing |
| `SelectField` | Select that renders option **labels**, not raw values |
| `StatusChip` | Translation status, from the one status table |
| `SearchInput` | Debounced search box |
| `Pagination` | Offset paging straight off a Feathers page |
| `ConfirmDialog` | Destructive confirmations |
| `UserAvatar` | Avatar with initials fallback |

The translation status ladder lives in `src/lib/translation-status.ts`. Every chip, rail
and filter reads from it, so `APPROVED` is the same indigo everywhere.

---

## What is built

Every screen in the navigation is built. Three are limited by backend work that does not
exist yet, and say so on the page rather than failing silently.

| Screen | State |
|---|---|
| Login | ✅ |
| App shell — sidebar, topbar, project switcher, permission peek | ✅ |
| Dashboard — coverage, status roll-up, recent activity | ✅ |
| Translations — grid, inline editing, add key, approve/publish, history, comments | ✅ |
| Applications — card grid, create/edit/delete | ✅ |
| Languages — catalogue and per-project enablement | ✅ |
| Members — invite, multi-role assignment, remove | ✅ |
| Roles — matrix editor, create/duplicate/delete | ✅ |
| Templates — config editor with live output preview | ✅ |
| Audit Log — infinite feed with before/after diffs | ✅ |
| Settings — project metadata and feature toggles | ✅ |
| API Tokens | List and revoke ✅ · **create blocked** — the server must mint the token |
| Import | Job history ✅ · **upload blocked** — no endpoint receives or parses a file |
| Export | Job history ✅ · **start blocked** — no worker renders the file |

See [`docs/UI_PLAN.md`](./docs/UI_PLAN.md) for each screen's design, the remaining backend
dependencies, and the known limitations of the translation grid.

---

## Conventions

- **Path alias** `@/` → `src/`.
- **shadcn components** are generated: `pnpm dlx shadcn@latest add <name>`. Prefer wrapping
  in `components/common/` over editing `components/ui/`.
- **Feature folders own their hooks, components and page.** Cross-feature code moves to
  `components/common/` or `lib/`.
- **Never import axios directly.** Go through a service; that is where the auth and tenant
  headers are attached.
- **Never use `ui/select` directly.** Use `SelectField` — Base UI's `Select.Value` renders
  the raw value, so a select over records shows a database id in the trigger.
- **`DropdownMenuLabel` must sit inside a `DropdownMenuGroup`.** Base UI's `GroupLabel`
  reads a context the group provides and throws without it.
- **Comment the "why".** The code says what it does; comments exist for decisions that are
  not obvious from reading it.
- **Pages are code-split.** Add a screen through `lazyPage` in `src/app/routes.tsx`, so the
  initial bundle stays the shell.
- **Derive, do not sync.** A value computable from props or query data is computed in
  render, not copied into state by an effect. Where local state genuinely has to follow an
  external change, adjust it during render (see `SearchInput`) — the lint rule that
  enforces this is on.
