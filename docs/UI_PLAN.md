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
| **Table** — `PageHeader` + `DataTable` + `Pagination` | Members, API Tokens, Audit, Languages |
| **Card grid** — `PageHeader` + responsive cards | Applications |

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
| Toolbar | Application select · debounced key search · status filter · Import / Export / Add key (all permission-gated) |
| Coverage strip | % APPROVED-or-PUBLISHED per language, **for the loaded page** |
| Grid | Sticky header and key column; each cell has a status rail, value, chip and hover actions |
| Cell edit | Double-click or the pencil. `⏎` saves, `esc` cancels. Status advances `MISSING → DRAFT`, `existing → REVIEW` |
| Cell actions | Approve (`DRAFT`/`REVIEW` only), Publish (`APPROVED` only), History, Comments |
| Drawer | Right sheet: cell history, or a comment thread |
| Read-only banner | Shown when the role lacks `TRANSLATIONS:update`, so a translator understands why nothing is editable |

**Known limits, all backend-dependent:**

| Limit | Impact | Fix |
|---|---|---|
| Status filter runs client-side | Filters the current page, not the project. Labelled as such in the UI. | Backend `GET /translation-keys/by-status` or a denormalised `statusSummary` field |
| Search matches `key` only, not values | Cannot find "the key whose Japanese says X" | Backend `GET /translation-keys/search?q=` across the nested map |
| Cell writes send the whole `translations` object | Two people editing *different languages of the same key* within one round-trip can clobber each other | `PATCH /translation-keys/:id/cell`, or a version field for optimistic concurrency |
| Comment counts are not shown per cell | The badge always reads 0 until the drawer is opened | Backend aggregate, or a per-page comment-count query |
| Add key / Import / Export buttons are inert | Gated and visible, but disabled | Sections 3.6 and 3.8 |

### 3.4 Roles — ✅ built

Master/detail. Role list on the left with a grant count; the entitlement × action matrix
on the right.

- Edits are **staged and saved explicitly** — 15 entitlements × 7 actions at one PATCH per
  toggle would be slow and impossible to cancel.
- Actions an entitlement does not offer render as an **inert dash**, not an unchecked box.
  An unchecked box would imply "off, and you could turn it on".
- System roles (`isSystem`) are read-only, with a banner saying to duplicate instead.

**Next:** create-role dialog, duplicate-role action, delete with a confirm that names how
many members hold the role.

### 3.5 Members — ✅ built

`PageHeader` + `DataTable`: member, roles, status, joined, manage.

- Roles are **checkboxes, not a select** — the model allows "translator + reviewer", and a
  single-select would make that unrepresentable.
- A member must keep at least one role; stripping the last one is refused with an
  explanation. Removing the member is how access is revoked.

**Next:** invite flow (email → user lookup or create → roles → send), remove-member
confirm, resend invitation.

---

### 3.6 Applications — planned

**Pattern:** card grid.

Each card: icon by type, name, `code` in mono, type badge, language chips, key count, and
a coverage bar. Click opens a detail sheet with the export/import template bindings and the
API-enabled toggle.

- Create/edit form: name, code (slug, immutable after create), type, default language,
  supported languages (multi-select from the project's set), templates, `apiEnabled`.
- **Depends on:** nothing new. `applicationsService` and `useApplications` exist.
- **Watch:** `supportedLanguages` must be a subset of the project's. Enforce in the form
  and mirror the check server-side.

### 3.7 Languages — planned

**Pattern:** table.

Languages are **global**; a project enables a subset. Two sections on one page:

1. *Enabled in this project* — reorderable, with the default marked.
2. *Available* — the rest of the catalogue, with an Enable action.

- Columns: code, name, native name, locale, RTL, sort order.
- **Depends on:** the project's `supportedLanguages` array — enabling a language is a
  `PATCH /projects/:id`, not a write to `languages`.

### 3.8 Import — planned

**Pattern:** wizard, then a job table.

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

### 3.9 Export — planned

**Pattern:** form + job table.

Pick application, languages (multi), template, and a status floor (default: published
only). Submit creates a job; the table polls until `COMPLETED`, then offers the download.

- **Depends on:** `POST /export-jobs` producing a retrievable file. Note the artifact
  cannot be handed over through a plain link if the console is ever embedded — serve it
  from an authenticated endpoint.

### 3.10 Templates — planned

**Pattern:** master/detail.

List by file type (JSON / PROPERTIES / ARB / XML / YAML / CSV / CUSTOM). The detail pane
holds the import and export config side by side, each with `fileStart` / `fileRow` /
`fileEnd` / `separator` / `encoding`, and a **live preview** rendering three sample keys
through the template. The preview is the point — these configs are unreadable otherwise.

- System templates are read-only, same rule as system roles.

### 3.11 API Tokens — planned

**Pattern:** table.

Columns: name, `tokenPrefix` in mono, application, permissions, expiry, last used, enabled.

- **The plaintext token is shown exactly once**, in a dialog after create, with a copy
  button and an unmissable "you will not see this again".
- Revoke is a `PATCH { enabled: false }`, not a delete — the audit trail should keep the
  record.
- **Depends on:** the backend generating and returning the plaintext once. Today
  `apiTokensDataSchema` accepts `tokenHash` from the client, which is wrong — the server
  should mint both hash and prefix.

### 3.12 Audit Log — planned

**Pattern:** infinite table.

`useInfiniteActivityLogs` is already wired. Filters: actor, entity type, action, date
range. Each row expands to show the `oldValue` → `newValue` diff.

- **Depends on:** something actually writing activity logs. The service exists; no hook
  populates it yet.

### 3.13 Settings — planned

**Pattern:** tabbed form.

- *General* — name, code, description, logo.
- *Languages* — default and supported.
- *Features* — `allowMachineTranslation`, `allowClientTranslation`, `allowApiAccess`,
  `autoTranslateNewKeys`, `defaultNamespace`.
- *Danger zone* — archive project, behind a type-the-name confirm.

### 3.14 Dashboard — planned

**Pattern:** card grid + charts. Build this **last** — it is a view over data the other
screens produce, and building it first means guessing what matters.

- Coverage per language × application (stacked bar).
- Counts by status, as filter links into the grid.
- Keys awaiting review / publish, for the current user's roles.
- Running import/export jobs.
- Recent activity, from the audit log.

Load the `dataviz` skill before writing any chart code here.

---

## 4. Build order

Each step is shippable on its own.

| # | Work | Why here |
|---|---|---|
| 1 | Applications + Languages CRUD | The translation grid is empty until a project has applications and languages |
| 2 | Add-key dialog, in the grid | Completes the core loop: create → translate → approve → publish |
| 3 | Members invite flow | The platform is unusable by a team until people can be added |
| 4 | Roles create / duplicate / delete | Follows the invite flow — new members need roles to hold |
| 5 | Templates + preview | Prerequisite for import and export |
| 6 | Export | Simpler than import; proves the template pipeline end to end |
| 7 | Import wizard | The largest single screen; needs upload plumbing |
| 8 | API Tokens | Unlocks the consumption API for real applications |
| 9 | Audit Log | Needs activity logs to be written first |
| 10 | Settings | Small, and mostly forms over existing endpoints |
| 11 | Dashboard | A view over everything above |

---

## 5. Backend dependencies

Collected from the sections above. Items marked **done** were added while wiring the
console.

| # | Need | For | Status |
|---|---|---|---|
| 1 | `GET /me/memberships`, `GET /me/permissions` | Project switcher, all permission gating | **done** |
| 2 | `$regex` / `$options` in the allowed operator set | Every search box | **done** |
| 3 | Real `dataSchema`s for the nine stub services | Any create through those services | **done** |
| 4 | Server-side status filter or a denormalised status summary | Translations status filter beyond one page | open |
| 5 | Search across translated values | Finding a key by its content | open |
| 6 | Single-cell patch, or optimistic concurrency on `translations` | Concurrent cell edits | open |
| 7 | File upload for import | Import wizard | open |
| 8 | Server-minted API tokens, plaintext returned once | API Tokens screen | open |
| 9 | Activity logs actually written | Audit Log | open |
| 10 | System roles seeded per project | Roles screen is empty for a fresh project | open |
| 11 | Refresh tokens | Sessions currently end at JWT expiry (1 day) | open |

---

## 6. Accessibility and quality bar

Applies to every screen, not just new ones:

- Every icon-only control has an `aria-label`; the Translations grid relies on them
  heavily.
- The grid is keyboard-operable: `⏎` saves, `esc` cancels. **Open:** arrow-key movement
  between cells.
- Status is never conveyed by colour alone — every chip carries its label.
- Wide content scrolls inside its own container; the page body never scrolls sideways.
- Skeletons match the shape of what they replace.
- Both themes are checked before a screen is called done.
