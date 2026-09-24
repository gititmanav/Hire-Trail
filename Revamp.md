# Revamp.md — page-by-page revamp decision log

The dated record of **product and design decisions** for the HireTrail revamp, and *why* we took them. (BUILD_JOURNAL.md tracks sessions and verification; this file tracks decisions. Don't re-litigate anything marked **Decided** without new information.)

## How we work (decided 2026-09-24)

- One page at a time. Per page, audit in this order: **backend → DB (schema, indexes, connections) → frontend**.
- Owner brings the design direction; engineering owns every dimension of the change (API, schema, migrations, performance, UI, edge states).
- Open questions are discussed and decided **before** implementation.
- No blinders: improvements found along the way get done (and logged here), not ignored.
- Zero tolerance for unexplained errors: a user must never see "Internal server error" without a real cause we've diagnosed.

---

## 2026-09-24 — Applications page (+ Kanban + Calendar)

### Decided (owner)

1. **Remove Import / Export buttons** from the Applications page header.
2. **One page, three views:** Applications becomes List | Board | Calendar (Kanban and Calendar pages fold in). Page header in the Sora pattern: view switcher, a single **Filters** button (all filters live there, plus the keyboard-shortcuts "?" help), and a **create-new** button.
3. The page and its views must never surface unexplained 500s.
4. **Width: full width + columns — but keep BOTH designs for now.** The existing 1200px card list ("Classic") stays; the full-width table ("Table") is added alongside it, with a header toggle so the owner can compare on real data. **Owner will pick one later**; until then Classic is the default for everyone and the toggle is dev-only (visible in dev builds, or on any browser after visiting `/applications?devtools=1` once).
5. **Detail: a dedicated page per application** (`/applications/:id`). The detail sidebar, AI-analysis slide-over and the scattered entry points are gone.
6. **Board:** header-consistent — every control that sat out in the open (Resume/Company/Source filters, archived count, app count) moves into the header/Filters. **Mini | Regular | Detailed is removed; Regular is the only card for everyone.**
7. **Calendar: embedded as-is** under the shared header (keeps its own filters). Its revamp comes later.
8. **New application fields (Q4): deferred** — the owner will decide later. Nothing added to the schema this round.
9. Engineering defaults accepted without objection: TanStack Query; stage groups replace chips (Table design); Active/Archived moves into Filters; blue create button; Export moves into Filters; Kanban + Calendar leave the sidebar; old URLs redirect.

### Audit findings

**Backend / DB**
- **Prod 500s — root-caused and fixed (5b66f07, on main).** Vercel log export: an instance boots, connects to Mongo, and is frozen until traffic arrives; on thaw, a connection attempt caught by the freeze fails (`Socket 'secureConnect' timed out after 551147ms (connectTimeoutMS: 10000)` — the elapsed time is the freeze), surfaces as an **unhandled rejection**, and the Vercel runtime **exits the process (status 128)** — killing every in-flight request on that instance. Fix: `attachDatabasePool` from `@vercel/functions` (Vercel's documented fix — releases idle pool clients before suspension) + `maxIdleTimeMS: 10s`. Also removed 3 duplicate schema indexes that warned on every boot. **Needs a production soak** (see handoff).
- **Search 500s (fixed):** user search text went straight into `new RegExp()` — searching "C++" or "(" threw → 500, and a crafted pattern could backtrack the DB. All search sites (applications, companies, 3 admin pages) now escape via `utils/regex.ts`.
- **Payload bloat** *(fixed — `fields=summary`, see Built)*: Kanban and Calendar each fetched up to 1,000 *full* application documents (including `jobDescription`) on every visit; the List fetched full documents too. Calendar still does (untouched by decision — revamp later).
- **Legacy shape blocks indexes:** the active filter is `$or: [{archived: false}, {archived: {$exists: false}}]` because old documents predate the field. That `$or` defeats a clean compound index, and there's no index for the default sort (`{userId, archived, createdAt}`). *(Fixed without a migration: `archived: {$in: [false, null]}` matches legacy docs — null matches a missing field — and is a plain index lookup; new compound index added.)*
- **Round-trips per list load** *(fixed)*: `find` + `countDocuments` + stage aggregate, plus a second request just to count the opposite tab → now one `$facet` + one tiny tab-count aggregate in a single request.
- **Structured data trapped in notes:** the extension writes seniority / work mode / employment type / visa as a free-text `[Auto Tags] …` line in `notes`. Unfilterable, unsortable, and it clutters every row.

**Frontend**
- One application has **three separate side surfaces**: detail sidebar, AI-analysis sidebar, tailor drawer.
- **No client data cache:** every page visit refetches from scratch; List/Board/Calendar can't share data; no optimistic updates.
- Content is capped at 1200px while Board/Calendar are full-bleed — switching views would change the page width.

### Open questions — engineering recommendation *(resolved 2026-09-24 — see Decided 4–9)*

**Q1. Page width.** *Recommend: full width, with a column-based list.*
Full width looked empty before because the list rows are **cards designed for ~1200px** — stretched, the content clusters left and the rest is dead space. The fix is to make width carry information: the List becomes a Linear/Sora-style **grouped table** — one row per application, each property in its own column (stage, applied, days in stage, fit grade, next deadline, resume, location, salary, source…). Wide screens show more columns; narrow screens drop lower-priority ones; users toggle columns under Display options. Board and Calendar need full width anyway, and one consistent width means no layout jump when switching views.

**Q2. Application detail: sidebar or page?** *Recommend: a dedicated page, `/applications/:id`.*
- Unifies the three side surfaces into one place (overview, job description, AI fit insights, tailoring, activity).
- The AI insights and JD need width a sidebar can't give.
- A URL per application: shareable, bookmarkable, back button works, opens in a new tab.
- Industry pattern for records with depth (Linear, GitHub, Jira, Teal).
- The usual failure mode — "going to a page is slow and loses my place" — is solved by caching: back returns *instantly* with the same filters and scroll position, and **J / K** moves to the next/previous application without going back. Board cards and calendar events open the same page.

**Q3. Client data layer.** *Recommend: adopt TanStack Query (scoped to Applications first).*
Three views + a detail page over the same data need a shared cache for instant view switches, instant back-navigation, request dedupe, and optimistic updates with rollback (speed is a non-negotiable). It's the industry-standard tool for exactly this; hand-rolling it in useState would be the vibe-coded version.

**Q4. Richer application data.** *Recommend, in this order:*
1. **Promote Auto Tags to real fields** — `seniority`, `workMode`, `employmentType`, `visaSponsorship`; the extension writes them structured; a migration parses the existing `[Auto Tags]` lines out of notes.
2. **Priority / excitement** (1–3) — lets users rank what to pursue (Huntr/Teal have this; it's the most-requested tracker field).
3. **Structured salary** — min / max / currency / period alongside the raw text, so pay is sortable/filterable.
4. **Interview rounds + activity timeline** — round, date, interviewer, notes; plus a unified timeline of stage changes, emails, notes, and deadlines. Anchors the detail page.

### Engineering defaults (going ahead unless the owner objects)

- **URLs:** `/applications` (List), `/applications/board`, `/applications/calendar`, `/applications/:id`. Old `/kanban` and `/calendar` redirect. Each view is its own lazy chunk (Board's drag-and-drop and Calendar's libraries only load when opened).
- **Filters live in the URL query string**, shared across all three views (switching views keeps your filters; filtered views are linkable).
- **Stage chips → stage groups.** The List groups by stage with collapsible section headers carrying the counts (the Sora list pattern), so the chip row goes away without losing the at-a-glance numbers. Board columns carry counts natively.
- **Active / Archived** moves into Filters (Status: Active · Archived · All) instead of occupying its own tab row.
- **Create button:** compact icon button (compose glyph), primary blue, tooltip "New application" with the shortcut. Blue, not Sora's black — HireTrail keeps one accent.
- **Import / Export:** Import stays reachable from the empty state and the Import / Export page; "Export this view as CSV" moves into Filters → Display options (exports exactly what's filtered).
- **Sidebar:** Kanban Board and Calendar entries are removed (they're views now).
- **Shared `PageHeader` primitive** (title left, actions right, sticky): Applications first; every page adopts it during its own revamp so the whole app reads as one hand.

### Built (2026-09-24)

**Backend**
- `GET /applications`: one `$facet` aggregate returns page + filtered total + per-stage counts; a second tiny aggregate returns `tabCounts` (Active/Archived) — clients no longer make a separate "count the other tab" request. New server-side filters `company`, `resumeId` (id or `none`), `source`; all params validated (hostile/stale values narrow nothing). Stable pagination (`_id` tiebreak). Legacy-safe active match `archived: {$in: [false, null]}`.
- `fields=summary` for list surfaces: drops `jobDescription`, `userId`, `updatedAt`, `__v` and the AI summary text; adds `hasJobDescription`. Measured on the 650-app demo set: 689 KB → 592 KB (−14%) with *no* JDs in the data — real accounts (extension-saved JDs of several KB each) save far more.
- `GET /applications/filter-options`: distinct companies / sources / resumes for the Filters menu, across ALL applications (not the loaded page).
- Index `{userId, archived, createdAt: -1}` replaces `{userId, archived}` (prefix-compatible). *The old index still exists in Atlas — Mongoose doesn't drop indexes; drop it manually when convenient.*

**Frontend**
- **TanStack Query** data layer (`pages/Applications/data/`): shared cache for List/Board/detail; optimistic stage/archive/delete with rollback; one silent retry for transient failures before any error toast (query requests are `quiet`); cache cleared when the signed-in account changes.
- **Unified page** (`ApplicationsLayout` + `views/`): sticky `PageHeader` with search (`/`), view switcher (`1` `2` `3`), design toggle (dev), Filters (`f`), create (`c`). Filters live in the URL (shared across views, back/reload-safe, linkable). Board/Calendar/detail are lazy chunks.
- **Table design**: grouped (stage/company/none), collapsible counted groups, width-driven columns (5 at ~960px → 9 at 1920px), column toggles, calm colour (health dot; colour only for real deadlines).
- **Detail page**: hero, inline AI fit (all states designed), JD with clamp + copy, notes, tailoring history, rail (details, deadlines, timeline with time-per-stage, people at the company); J/K next/prev through the list you came from; Back restores the exact view, filters, and scroll.
- **Primitives added**: Popover, Menu, Tooltip, SegmentedControl, PageHeader; Select `size`; `usePageShortcuts`, `usePersistentState`.

### Found along the way (fixed)
- Board drag never fired the deadline follow-up prompt (the "from" stage was read after the drag preview had already mutated it) and dropping a card back into its own column still saved + toasted "Moved". Both fixed.
- "?" opened two overlays at once on Applications (global + page); `g c` also fired page shortcuts. Page shortcuts now respect a pending global sequence; "?" is the global overlay's.
- No scroll management anywhere in the app — every page opened at the previous page's scroll offset. Layout now scrolls to top on forward navigation (back/forward left to the page).
- Layout remounted the whole page on every path change (would have reset view switches); now keyed per section.
- Mutation errors double-toasted (interceptor + caller); network failures showed axios's raw "Network Error". Interceptor is now the single source, with a human sentence for offline.
- Classic rows would have shown "add a JD" on every row once lists dropped the JD text — caught before shipping (`utils/applicationFields.hasJobDescription` handles both payload shapes).

### Found along the way — needs an owner decision
1. **"Rejected — auto-archiving in 7 days" is a false promise.** No job anywhere auto-archives rejected applications; `archivedReason: "rejected"` is just stored on an active application. New surfaces no longer say it; the old copy still appears in the edit-save toast path and Settings → Report a rejection. Decide: build the job, or drop the promise everywhere.
2. **The nightly inbox scan likely never runs in production.** It's an in-process `node-cron` timer (`0 1 * * *`); Vercel freezes idle function instances, so a 1 AM timer inside one won't fire reliably. The Vercel-native fix is a Cron Job hitting an endpoint — that's deploy config (out of my scope unless you say so).
3. **Boot migrations run on every cold start** (backfill resume versions, clipboard nudge, AI settings) — idempotent, but they add DB load to every cold start. Candidate for a one-off script or a "ran-at" guard.
4. `ActionDropdown` (the old menu used in 20+ places) isn't portaled and doesn't use the layer stack — inside a modal, Escape closes both. Migrate its internals onto `ui/Menu` in the next pass.
