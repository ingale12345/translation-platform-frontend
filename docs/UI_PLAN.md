# UI Plan — Translation Platform Console

The design of every screen, the order to build them in, and the backend work each one
depends on.

- **Audience:** whoever picks up the next screen.
- **Companion docs:** [`../README.md`](../README.md) for architecture,
  [`../../translation-platform/docs/RBAC.md`](../../translation-platform/docs/RBAC.md) for
  the permission model.

---

## 1. Product shape

The console is a **project-scoped workspace**. A user belongs to one or more projects,
holds one or more roles in each, and everything they see is filtered by the union of those
roles. Two consequences drive the whole layout:

1. **The active project is ambient, not a URL parameter.** It lives in the session store
   and rides on every request as `X-Project-Id`. Switching project re-scopes the entire
   app, including which nav links exist.
2. **Navigation is derived from permissions.** `config/nav.ts` names the entitlement that
   gates each link. There is no route a role can reach but not use.

### Information architecture

```
Login
└── App shell  (sidebar · topbar · project switcher · permission peek)
    ├── Dashboard         DASHBOARD:read
    ├── Translations      TRANSLATIONS:read      ← the workspace
    ├── Applications      APPLICATIONS:read
    ├── Languages         LANGUAGES:read
    ├─ Access
    │   ├── Members       PROJECT_MEMBERS:read
    │   ├── Roles         ROLES:read
    │   └── API Tokens    API_TOKENS:read
    ├─ Data
    │   ├── Templates     TEMPLATES:read
    │   ├── Import        IMPORT:read
    │   └── Export        EXPORT:read
    └─ System
        ├── Audit Log     AUDIT_LOGS:read
        └── Settings      SETTINGS:read
```

---

## 2. Design language

| Decision | Rule | Why |
|---|---|---|
| **Density** | Compact. 8px rhythm, `h-8` controls, 13–14px body. | The primary screen is a spreadsheet. Comfortable spacing halves the rows on screen. |
| **Colour** | Neutral chrome. Colour carries *state*, never decoration. | When only status is coloured, a reviewer can find the amber cells by scanning. |
| **Status ladder** | `MISSING → DRAFT → REVIEW → APPROVED → PUBLISHED`, defined once in `lib/translation-status.ts`. | zinc → amber → sky → indigo → emerald reads as progress without a legend. |
| **Permissions** | Hide, never disable. | A disabled button raises a question the UI cannot answer inline. The Permissions dialog answers it properly. |
| **Empty states** | Say what to do next. | "No keys match — try clearing the filter" beats "No data". |
| **Destructive actions** | Always confirmed, and the prompt names the consequence. | "This removes their access to the project" beats "Are you sure?". |
| **Loading** | Skeletons shaped like the content. | A spinner over a grid loses the layout; a skeleton grid keeps it. |
| **Theme** | Light and dark are equal citizens, driven by tokens. | Translators work long sessions. |

### Layout patterns

Four shapes cover every screen, so a new page is a choice among them rather than a new
invention:

| Pattern | Screens |
|---|---|
| **Grid** — sticky header + sticky first column, inline edit | Translations |
| **Master / detail** — list rail on the left, document on the right | Roles, Templates |
| **Table** — `PageHeader` + `DataTable` + `Pagination` | Members, API Tokens, Languages, Import, Export |
| **Card grid** — `PageHeader` + responsive cards | Applications |
| **Tabbed form** — `PageHeader` + `Tabs` + explicit save | Settings |
| **Feed** — infinite list of events | Audit Log, Dashboard activity |

---

## 3. Screens

### 3.1 Login — ✅ built

Centred card. Client validation checks shape only; the credential verdict comes from the
API, and the error never says *which* field was wrong — that would let an attacker
enumerate accounts.

### 3.2 App shell — ✅ built

- **Sidebar** — permission-filtered, grouped, collapsible (persisted). A group whose items
  are all hidden disappears with its heading.
- **Topbar** — route-derived title, Permissions dialog, project switcher, account menu.
- **Bootstrap** — the shell picks a project before rendering any page, so no page has to
  handle "no project yet". Falls through to an explicit *No project access* state.

### 3.3 Translations — ✅ built

The signature surface. Keys down the side, languages across the top.

| Element | Behaviour |
|---|---|
| Toolbar | Application select · debounced key search · status filter · Add key · Import / Export (all permission-gated) |
| Coverage strip | % APPROVED-or-PUBLISHED per language, **for the loaded page** |
| Grid | Sticky header and key column; each cell has a status rail, value, chip and hover actions |
| Cell edit | Click the text to edit. Short values (≤80 chars) edit **inline** — `⏎` saves, `esc` cancels. Longer values open the **dialog editor**, with the source string beside them for reference, because a two-row box is the wrong shape for a paragraph. The pencil always opens the dialog. Status advances `MISSING → DRAFT`, `existing → REVIEW` |
| Cell actions | Approve (`DRAFT`/`REVIEW` only), Publish (`APPROVED` only), History, Comments |
| Drawer | Right sheet: cell history, or a comment thread |
| Add key | Dialog creating the key `MISSING` in every supported language, so it lands in a translator's queue rather than shipping placeholder text |
| Read-only banner | Shown when the role lacks `TRANSLATIONS:update`, so a translator understands why nothing is editable |

**Known limits, all backend-dependent:**

| Limit | Impact | Fix |
|---|---|---|
| Status filter runs client-side | Filters the current page, not the project. Labelled as such in the UI. | Backend `GET /translation-keys/by-status` or a denormalised `statusSummary` field |
| Search matches `key` only, not values | Cannot find "the key whose Japanese says X" | Backend `GET /translation-keys/search?q=` across the nested map |
| Cell writes send the whole `translations` object | Two people editing *different languages of the same key* within one round-trip can clobber each other | `PATCH /translation-keys/:id/cell`, or a version field for optimistic concurrency |
| Comment counts are not shown per cell | The badge always reads 0 until the drawer is opened | Backend aggregate, or a per-page comment-count query |
| Import / Export buttons are inert | Gated and visible, but disabled | §3.8 and §3.9 — both need backend workers |

### 3.4 Roles — ✅ built

Master/detail. Role list on the left with a grant count; the entitlement × action matrix
on the right.

- Edits are **staged and saved explicitly** — 15 entitlements × 7 actions at one PATCH per
  toggle would be slow and impossible to cancel.
- Actions an entitlement does not offer render as an **inert dash**, not an unchecked box.
  An unchecked box would imply "off, and you could turn it on".
- System roles (`isSystem`) are read-only, with a banner saying to duplicate instead.

Create, duplicate and rename live in a dialog that owns identity only — grants stay in the
matrix, where they have room. Duplicating is the supported way to derive an editable role
from a locked system one, and it carries the grants over; a fresh role starts with none, so
its author has to state what it may do.

Delete names how many members hold the role, which is the number that makes the decision
real.

**⚠️ A fresh project has no roles**, because nothing seeds system roles per project yet
(§5 item 10). The screen shows an empty state with a create action rather than looking
broken.

**Next:** filter the role list; show which members hold a role from the detail pane.

### 3.5 Members — ✅ built

`PageHeader` + `DataTable`: member, roles, status, joined, manage.

- Roles are **checkboxes, not a select** — the model allows "translator + reviewer", and a
  single-select would make that unrepresentable.
- A member must keep at least one role; stripping the last one is refused with an
  explanation. Removing the member is how access is revoked.

Invite looks the user up by email first: `POST /users` is open registration, so minting a
platform account on someone's behalf from a project screen would cross a boundary. If no
account exists, the dialog says so rather than silently creating one.

Removal is a `PATCH { status: 'removed' }`, not a delete — the member record carries the
audit trail for everything they translated, and the backend fails authorization on
`removed` immediately either way.

**Next:** resend invitation; show pending invitations distinctly.

---

### 3.6 Applications — ✅ built

**Pattern:** card grid.

Each card carries the platform badge, name, `code` in mono, and its language chips (the
source language marked with `·`). Edit and delete appear on hover.

- Create/edit dialog: name, code, description, platform, languages, default language,
  `apiEnabled`.
- **`code` is immutable after creation.** It appears in the consumption API URL, so
  changing it silently breaks every deployed client fetching by that path.
- The language multi-select offers only the project's enabled set, and the default-language
  select narrows to what is selected — a subset constraint the form makes unrepresentable
  rather than validating after the fact.

**Next:** key counts and a coverage bar per card (needs the same aggregate as §5 item 4);
archive as a distinct action from delete.

### 3.7 Languages — ✅ built

**Pattern:** two tables on one page.

1. *Enabled in this project* — the source language is badged and cannot be disabled;
   the others offer "Make source" and "Disable".
2. *Available in the catalogue* — everything else, with "Enable".

- Enabling is a `PATCH /projects/:id` against `supportedLanguages`, **not** a write to
  `languages`. Getting that backwards would let one project's choice change every other
  project's.
- Adding to the catalogue is create-only: editing a language `code` would orphan every
  translation keyed by it across every project, and there is no safe path for that.
- Disabling warns that existing translations are kept but stop being exported.

**Next:** drag-to-reorder the enabled list (writes `sortOrder`).

### 3.8 Import — job history ✅ · wizard blocked

**Built:** the job history table — file, application, language, status, per-run statistics,
and expandable per-line errors.

**Not built, deliberately:** the upload wizard. `POST /import-jobs` records a job, but
nothing transfers or parses the file, so a job started from the console would sit at
`QUEUED` forever. The page says so instead of offering a button that produces a dead
record.

**Pattern when it lands:** wizard, then the existing job table.

```
1 Source      application · language · template
2 Upload      drag-and-drop, extension validated against the template
3 Preview     diff: added / updated / unchanged / skipped / failed, per key
4 Apply       confirm, then poll the job
```

- Job history table below: file, language, status, statistics, duration. Failed rows expand
  to the per-line `errors[]`.
- **Depends on:** file upload — the service has `filePath`, so the backend needs a multipart
  endpoint or a signed-URL flow, plus the `POST /import-jobs/:id/preview` and `/apply`
  methods that `docs/API.md` lists as planned.

### 3.9 Export — job history ✅ · start blocked

**Built:** the job history table — file, application, language, status, key counts, and
the failure reason when there is one.

**Not built, deliberately:** starting an export, for the same reason as Import — no worker
renders the file, so the download would never appear.

**When it lands:** pick application, languages, template and a status floor (default:
published only), then poll to `COMPLETED`. Serve the finished artifact from an
authenticated endpoint — an export bundle is project content, not a public asset, and a
plain link would also be inert inside a sandboxed embed.

### 3.10 Templates — ✅ built

**Pattern:** master/detail.

The detail pane tabs between the export and import configs, each beside a **live preview**
rendering three sample keys through the template. The preview is the point — four text
fields are unreadable, and a template that emits a trailing comma only shows itself as
broken in the assembled file.

- New templates start from a per-file-type default (`lib/template-preview.ts`) rather than
  blank: nobody writes JSON brace-and-comma scaffolding from memory.
- Changing the file type updates the extension with it.
- Config edits are staged and saved explicitly, like the roles matrix.
- System templates are read-only, same rule as system roles.

**⚠️ The preview is a client-side approximation.** `renderExportPreview` defines the token
set (`{key}`, `{value}`, `{namespace}`, `{language}`, `{index}`); the authoritative
renderer is the export worker, which does not exist yet. **If the worker adopts different
tokens, this preview becomes a lie — change both together.**

### 3.11 API Tokens — list and revoke ✅ · create blocked

**Built:** the table — name, `tokenPrefix`, application, scope, last used, expiry — plus
revoke and delete.

- Revoke is a `PATCH { enabled: false }`, not a delete, so the audit trail keeps the
  record. The delete confirm says as much.

**Not built, deliberately:** creating a token. `apiTokensDataSchema` accepts `tokenHash`
from the client, which would mean the browser minting the secret *and* choosing its own
hash — a credential nobody can trust. The server has to generate both and return the
plaintext exactly once. Withheld rather than shipped broken.

**When it lands:** show the plaintext in a dialog after create, with a copy button and an
unmissable "you will not see this again".

### 3.12 Audit Log — ✅ built

**Pattern:** infinite feed.

Rows show actor, description, entity type and relative time; those with a recorded change
expand to a before/after pair. The expander only appears when there is something behind it
— a chevron that reveals nothing teaches people to stop clicking.

Filters: free-text over `action`, and entity type.

**⚠️ Still empty in practice.** Nothing on the backend writes activity logs yet, so this
screen will show its empty state until that lands (§5 item 9).

**Next:** actor and date-range filters.

### 3.13 Settings — ✅ built

**Pattern:** tabbed form.

- *General* — name, description, logo, default namespace. `code` is shown read-only: it
  identifies the project in the consumption API.
- *Features* — the four `settings` toggles.
- *Danger zone* — archive, **not yet wired**: the confirm needs to name how many
  applications and keys go with it, and that count needs the aggregate in §5 item 4.

Languages are deliberately *not* here — they live on the Languages screen beside the global
catalogue. Splitting one model across two screens is worse than the extra click.

### 3.14 Dashboard — ✅ built

**Pattern:** stat cards + meters + activity feed.

- Four stat cards: keys, applications, awaiting review, ready to publish. Each links into
  the screen that acts on it.
- Coverage by language, and cells by status, as horizontal meters reading from the one
  status table.
- Recent activity, gated on `AUDIT_LOGS:read`.

**⚠️ Status and coverage are computed from a 500-key sample**, because status lives inside
each key's nested `translations` map and Feathers cannot aggregate over it. The cards say
"across a sample of N of M keys" whenever the project is larger. A dashboard that quietly
rounds down is worse than one that admits its scope — do not remove that label before §5
item 4 lands.

Meters are deliberately plain CSS, not a charting library. If real charts are added here,
load the `dataviz` skill first.

---

## 4. Build order

Each step is shippable on its own.

Steps 1–5, 9, 10 and 11 shipped. What is left is blocked on backend work, not on UI
decisions — each entry names the item in §5 it waits on.

| # | Work | Status |
|---|---|---|
| 1 | Applications + Languages CRUD | ✅ |
| 2 | Add-key dialog, in the grid | ✅ |
| 3 | Members invite flow | ✅ |
| 4 | Roles create / duplicate / delete | ✅ |
| 5 | Templates + preview | ✅ |
| 6 | Export — start a job | Blocked on §5 item 6 (render worker) |
| 7 | Import wizard | Blocked on §5 item 7 (upload endpoint) |
| 8 | API Tokens — create | Blocked on §5 item 8 (server-minted tokens) |
| 9 | Audit Log | ✅ UI · empty until §5 item 9 writes logs |
| 10 | Settings | ✅ except archive, which needs §5 item 4 |
| 11 | Dashboard | ✅ sampled · exact once §5 item 4 lands |

Nothing in the console now depends on further UI design to be useful. The next meaningful
increment is backend.

---

## 5. Backend dependencies

Collected from the sections above. Items marked **done** were added while wiring the
console.

| # | Need | For | Status |
|---|---|---|---|
| 1 | `GET /me/memberships`, `GET /me/permissions` | Project switcher, all permission gating | **done** |
| 2 | `$regex` / `$options` in the allowed operator set | Every search box | **done** |
| 3 | Real `dataSchema`s for the nine stub services | Any create through those services | **done** |
| 4 | Server-side status aggregate (or a denormalised `statusSummary`) | Translations status filter beyond one page · exact dashboard figures · archive confirm counts | open |
| 5 | Search across translated values | Finding a key by its content | open |
| 6 | Export render worker | Starting an export; serve the artifact from an authenticated endpoint | open |
| 7 | File upload + parse for import | Import wizard | open |
| 8 | Server-minted API tokens, plaintext returned once | Creating API tokens | open |
| 9 | Activity logs actually written | Audit Log has UI but no data | open |
| 10 | System roles seeded per project | A fresh project has no roles at all | open |
| 11 | Single-cell patch, or optimistic concurrency on `translations` | Concurrent cell edits clobbering each other | open |
| 12 | Refresh tokens | Sessions end at JWT expiry (1 day) | open |
| 13 | Template render engine matching `lib/template-preview.ts` tokens | The preview is only truthful if the worker agrees | open |

Item 4 is the highest-leverage: it unblocks three screens at once.

### Fixed since the console first ran

Four defects found by running the app against real data, all backend:

| Defect | Symptom in the console | Fix |
|---|---|---|
| ObjectId strings not coerced inside `$in` / `$nin` | Every join returned empty: no roles, no project names, an empty sidebar for **every** role including super admin | `hooks/coerce-object-ids.ts` |
| `users` query resolver scoped `_id` to the caller | Members table showed "Unknown user", audit log had no actors, invite-by-email found nobody | Scoped to users sharing a project — `common/utils/visible-users.ts` |
| `DropdownMenuLabel` outside a `DropdownMenuGroup` | Profile menu crashed the page | Wrapped in `DropdownMenuGroup` (Base UI's `GroupLabel` reads a context the group provides) |
| Base UI `Select.Value` renders the raw value | Dropdowns showed database ids instead of names | `components/common/select-field.tsx` renders the option's label |

The first two are worth remembering as a pair: both were *silent*. A query that matches
nothing looks identical to a project with no data, so the console rendered empty states
rather than errors and the failure read as "the UI is not finished".

---

## 6. Accessibility and quality bar

Applies to every screen, not just new ones:

- Every icon-only control has an `aria-label`; the Translations grid relies on them
  heavily.
- The grid is keyboard-operable: `⏎` saves, `esc` cancels. **Open:** arrow-key movement
  between cells.
- Derived state is computed in render, never synced by an effect. Where local state must
  follow an external change, it is adjusted during render (`SearchInput`, the roles and
  templates drafts) — the `react-hooks/set-state-in-effect` lint rule enforces this.
- Status is never conveyed by colour alone — every chip carries its label.
- Wide content scrolls inside its own container; the page body never scrolls sideways.
- Skeletons match the shape of what they replace.
- Both themes are checked before a screen is called done.

### Known tooling limitation

`Link to="/audit"` and `redirect({ to })` do **not** typecheck against the route tree.
The router's registered type is computed from a tree whose components import the router,
so path literals collapse to a half-built union. Two escapes are in place, each documented
at its definition: `AppLink` (`components/common/app-link.tsx`) for links, and
`redirectForward` (`app/routes.tsx`) for redirects. Paths are therefore validated by the
router at runtime, not by the compiler.

Lazy page routes were tried as a fix and do not work — the cycle runs through `AppShell`,
which the tree imports statically and which renders its own links. Breaking it properly
means moving to file-based routing with a generated route tree. Lazy routes were kept
regardless: they cut the initial bundle from 891 kB to 391 kB.
