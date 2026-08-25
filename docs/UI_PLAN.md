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
    │   ├── Export        EXPORT:read
    │   └── Versions      TRANSLATIONS:read      ← publish is TRANSLATIONS:publish
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
| **Table** — `PageHeader` + `DataTable` + `Pagination` | Members, API Tokens, Languages, Import, Export, Versions |
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

### 3.2b Projects — ✅ built

A platform admin's home, and the answer to "where do I add a project?".

**Built from `GET /me/memberships`, not `GET /projects`** — that endpoint already answers
the harder question: which projects can this person actually *enter*, whether through an
organization-scoped role or an explicit membership. Listing projects would show a manager
rows they cannot open.

| Element | Behaviour |
|---|---|
| Card per project | Name, code, description, and roll-up stats: apps · members · languages |
| Manager | Avatar and name of whoever holds `PROJECT_MANAGER`. **"No manager assigned" is called out in amber** — an unmanaged project cannot be staffed, so it will quietly stay empty |
| Open | Switches the active project; the existing screens take over from there |
| Manager button | Assigns someone as manager. Adds the role to an existing membership rather than replacing it, so a developer taking over a project keeps their other roles |
| New project | Gated on `PROJECTS:create`, which only an organization-scoped role grants |
| Access note | "org access" when the user reached the project through the organization tier, otherwise the role names |

Three page-scoped queries feed every card rather than one per card — with a dozen projects
that is 3 requests instead of 36.

**Why creating a project is more than an insert:** the server gives the new project its own
copy of the system roles and makes the creator its manager. Without that, a new project has
no roles to grant anything and no members to hold them, so it is invisible to everyone
including whoever created it — which is exactly how it behaved before.

### 3.3 Translations — ✅ built

The signature surface. Keys down the side, languages across the top.

| Element | Behaviour |
|---|---|
| Toolbar | Application select · debounced key search · status filter · Add key · Import / Export · Freeze version (all permission-gated) |
| Coverage strip | % APPROVED-or-PUBLISHED per language, **for the loaded page** |
| Grid | Sticky header and key column; each cell has a status rail, value, chip and hover actions |
| Selection | Checkbox per key and in the header. Cleared on any filter or page change — a selection is a set of ids from the previous result set, and carrying it over would let a bulk action hit rows the user can no longer see |
| Bulk bar | Replaces the toolbar while a selection is live: Send to review · Approve · Publish, each gated by the same permission as its single-cell equivalent |
| Cell edit | Click the text to edit. Short values (≤80 chars) edit **inline** — `⏎` saves, `esc` cancels. Longer values open the **dialog editor**, with the source string beside them for reference, because a two-row box is the wrong shape for a paragraph. The pencil always opens the dialog. Status advances `MISSING → DRAFT`, `existing → REVIEW` |
| Cell actions | Approve (`DRAFT`/`REVIEW` only), Publish (`APPROVED` only), History, Comments (with a live count) |
| Drawer | Right sheet with two tabs — **Conversation** and **History** — both scoped to the one cell |
| Add key | Dialog creating the key `MISSING` in every supported language, so it lands in a translator's queue rather than shipping placeholder text |
| Read-only banner | Shown when the role lacks `TRANSLATIONS:update`, so a translator understands why nothing is editable |

#### Bulk status

Approving a release one cell at a time is four hundred clicks for a hundred keys across
four languages. The bulk dialog takes the ticked keys and asks the one question a toolbar
button cannot: **which languages** — approving a key rarely means approving every locale
of it.

It then shows what the server refused to do, grouped by reason. A run that silently moves
37 of 40 cells is the failure mode this design is against: the count would be right and
the user would have no way to find the other three. Reasons are *no translation yet*,
*already at that status*, *not allowed from its current status*, *language not on this key*.

The note field is recorded on every history row the run creates, so "why did forty cells
move at once" has an answer in the timeline.

#### Conversation — chat, not a comment list

Laid out like a messaging app because that is how it is used: a translator and a reviewer
going back and forth about one string. Your messages on the right, everyone else's on the
left with name and avatar; consecutive messages from one person are grouped so a
back-and-forth is not a wall of repeated headers; day dividers; `⏎` sends.

It polls while open. The server already publishes comment events to `project:{projectId}`,
so this becomes a socket subscription without touching the component — the remaining work
is a Feathers socket client alongside the axios instance.

#### History — who changed what, when

A timeline per cell: actor, action verb, relative time (exact on hover), the status
transition as two chips, and a red/green diff of the value. Bulk notes appear in quotes.

Both panels are keyed by cell, so switching cells remounts them rather than showing the
previous cell's data for a frame.

**Known limits, all backend-dependent:**

| Limit | Impact | Fix |
|---|---|---|
| Status filter runs client-side | Filters the current page, not the project. Labelled as such in the UI. | Backend `GET /translation-keys/by-status` or a denormalised `statusSummary` field |
| Search matches `key` only, not values | Cannot find "the key whose Japanese says X" | Backend `GET /translation-keys/search?q=` across the nested map |
| Cell writes send the whole `translations` object | Two people editing *different languages of the same key* within one round-trip can clobber each other | `PATCH /translation-keys/:id/cell`, or a version field for optimistic concurrency |
| Import button is inert | ~~Gated and visible, but disabled~~ — now opens the wizard | ✅ §3.8 |

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

### 3.8 Import — ✅ built

**Built:** the run log, and the wizard that produces it.

```
1 Source      application · format · language · default namespace
2 Upload      drag-and-drop or picker, extension matched to the template, 8 MB cap
3 Preview     dry run — added / changed / restored / disabled, disabled listed first
4 Apply       same payload, dryRun off
```

The preview is not optional and not a separate code path: both steps call
`POST /translations/import` with the same body, differing only in `dryRun`. A preview built
by different code would eventually disagree with the thing it claims to predict.

It leads with the count of keys about to be **disabled**, not added. Import is the only
operation here that can take strings away, and the person running it is usually a developer
who exported from a branch and has no idea the file is missing half the app.

**Importing releases nothing.** It reconciles the working set and writes an `import-jobs`
receipt — no version, no change to what any application receives. The page says so and
links to Versions. See §3.8b.

- Run log below: file, application, language, status, per-run statistics, expandable
  per-line errors.
- No queue and no polling: the endpoint parses and reconciles synchronously, so a run has
  succeeded or failed by the time the dialog closes.

### 3.8b Versions — ✅ built

The release surface. Three acts, deliberately separate:

```
import   →  changes the working set          (§3.8)
freeze   →  numbered snapshot of it          DRAFT
publish  →  production points at it          exactly one PUBLISHED per application
```

- **Live banner** names the published version, who published it, and how many newer
  versions are unshipped. "Nothing published" is called out as a real state — the
  application then delivers every active key, as if versioning were off.
- **Freeze** is offered here *and* in the Translations toolbar. The decision is made when
  someone finishes reviewing the last string; sending them to another screen to say so
  invites the step being forgotten.
- **Publish / Roll back** — the same operation, labelled by direction. The confirm names
  how many keys start and stop being delivered, and says plainly that a rollback changes
  only which key set ships, never the translations themselves.
- Gated on `TRANSLATIONS:publish`, **not** `IMPORT`. Reviewer is the role whose job is
  releasing and it has no import permission at all; behind the import gate this screen
  would be invisible to exactly the people who need it.
- Application is chosen per screen, defaulting to the most recently released one — version
  numbers are per application, and a merged list would put two unrelated "v3"s side by side.

### 3.9 Export — ✅ built

**Built:** the job history table, and the dialog that starts one. `POST
/translations/export` renders the file synchronously and returns it in the response body;
the browser saves it from a blob URL.

Returning the file rather than a URL is the design decision worth keeping: an export bundle
is project content, so there is no artifact at rest to protect, no signed URL to expire,
and nothing that goes stale inside a sandboxed embed.

**The rule the dialog exists to make visible:** only `APPROVED` and `PUBLISHED` cells
contribute a value; everything else exports empty. That is surprising the first time it
happens — a translator sees their work missing from the file — so the result panel reports
how many values were *withheld* and says to approve them and export again. A file that is
thinner than expected explains itself instead of looking like data loss.

**Still open:** a background queue, once a project outgrows what one request can render.

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

### 3.11 API Tokens — ✅ built

**Built:** the table — name, `tokenPrefix`, application, scope, last used, expiry — plus
create, revoke and delete.

- Revoke is a `PATCH { enabled: false }`, not a delete, so the audit trail keeps the
  record. The delete confirm says as much.
- **Create shows the secret once.** The server mints it and stores only a SHA-256 hash and
  the visible prefix, so after the dialog closes there is nowhere to read it from. The
  panel says that outright rather than implying a "reveal" that cannot exist.
- The issued panel carries a ready-to-run `curl`, and states the two filters that decide
  what comes back: the **published version** chooses which keys exist, and each cell must
  be signed off to carry a value.

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
| 6 | Export — start a job | ✅ — rendered synchronously |
| 7 | Import wizard | ✅ — file read client-side, parsed server-side, dry-run preview |
| 8 | API Tokens — create | ✅ — server-minted, plaintext shown once |
| 9 | Audit Log | ✅ — `recordActivity` writes them |
| 10 | Settings | ✅ except archive, which needs §5 item 4 |
| 11 | Dashboard | ✅ sampled · exact once §5 item 4 lands |

Nothing in the console now depends on further UI design to be useful. The remaining open
items are backend correctness, not screens.

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
| 6 | Export renderer | Starting an export | **done** — `POST /translations/export` |
| 7 | File upload + parse for import | Import wizard | **done** — `POST /translations/import`, content in the body |
| 8 | Server-minted API tokens, plaintext returned once | Creating API tokens | **done** |
| 9 | Activity logs actually written | Audit Log has UI but no data | **done** — `hooks/record-activity.ts` |
| 10 | System roles seeded per project | A fresh project has no roles at all | open |
| 11 | Single-cell patch, or optimistic concurrency on `translations` | Concurrent cell edits clobbering each other | open |
| 12 | Cascade or soft-archive on `DELETE /projects/:id` | Deleting a project orphans its roles, members, applications, keys, versions and history | open |
| 12 | Refresh tokens | Sessions end at JWT expiry (1 day) | open |
| 13 | Template render engine matching `lib/template-preview.ts` tokens | The preview is only truthful if the renderer agrees | **done** — both sides substitute `$key` in one pass |
| 14 | Bulk status endpoint | Approving a release without clicking every cell | **done** — `POST /translations/bulk-status` |
| 15 | Translation history actually written | The history drawer had no data to show | **done** — `hooks/translation-history.ts` |
| 16 | `createdBy` / `createdAt` on every write | Comment authorship, so a chat can say who said what | **done** — `hooks/stamp-audit.ts` |
| 17 | Permission enforcement on the CRUD services | Any signed-in user could patch any record they could name | **done** — `hooks/authorize.ts` |
| 18 | Socket client in the console | Live comments without polling | open — the server already publishes per project |
| 19 | Organization-level authority | Nobody could create a project; a new project was invisible | **done** — `organization-members` + role `scope` |
| 20 | Project bootstrap | A created project had no roles and no manager | **done** — `hooks/bootstrap-project.ts` |
| 21 | Install seed | A fresh installation had nobody who could create anything | **done** — `pnpm seed:install` |

Item 4 is the highest-leverage remaining feature work.

### Fixed since the console first ran

Defects found by running the app against real data — all backend, all silent:

| Defect | Symptom in the console | Fix |
|---|---|---|
| Nothing ever wrote `translation-history` | The history drawer said "no history yet" forever, however much you edited | `hooks/translation-history.ts` diffs each write cell by cell |
| Nothing ever set `createdBy` / `createdAt` | Comments had no author and no timestamp, so a chat layout was impossible | `hooks/stamp-audit.ts`, applied to all 17 services |
| Seeded export templates emitted invalid files | A row pattern ending in `,` plus a `,` separator produced double commas and a trailing comma before `}` | Fixed in `dev/templates.json`; the renderer now escapes per file type |
| Template tokens disagreed | Seeds used `$key`, the console preview used `{key}` — one of them would always fail to substitute | Both now accept either, in a single pass |
| Every event published to every authenticated connection | A socket client would receive other projects' data | `channels.ts` publishes to `project:{projectId}` |
| ObjectId strings not coerced inside `$in` / `$nin` | Every join returned empty: no roles, no project names, an empty sidebar for **every** role including super admin | `hooks/coerce-object-ids.ts` |
| `users` query resolver scoped `_id` to the caller | Members table showed "Unknown user", audit log had no actors, invite-by-email found nobody | Scoped to users sharing a project — `common/utils/visible-users.ts` |
| `DropdownMenuLabel` outside a `DropdownMenuGroup` | Profile menu crashed the page | Wrapped in `DropdownMenuGroup` (Base UI's `GroupLabel` reads a context the group provides) |
| Base UI `Select.Value` renders the raw value | Dropdowns showed database ids instead of names | `components/common/select-field.tsx` renders the option's label |
| Authority existed only inside a project | Nobody could create a project, and a created one was invisible to everyone including its author | Organization-scoped roles + `organization-members` |
| Services authenticated but never authorized | Any signed-in user could patch any record in any project | `hooks/authorize.ts` on every CRUD service |
| `visibleUserIds` scoped by shared project | A platform admin with no project membership could see only themselves, so could not staff a project | Organization members see the whole directory |

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
