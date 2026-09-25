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
1. ~~False "auto-archiving in 7 days" promise~~ → **parked** (see "Parked — decide at the end").
2. ~~Nightly inbox scan likely never runs on Vercel~~ → **parked** (see "Parked — decide at the end").
3. ~~Boot migrations run on every cold start~~ → **fixed** 2026-09-24 (owner approved) — see the shell/dropdown round below.
4. ~~`ActionDropdown` isn't portaled / layer-aware~~ → **done**: deleted; every dropdown is on `ui/Popover` (below).

---

## Parked — decide at the end

Items the owner has seen and wants to decide on together once the revamp pages are done (owner, 2026-09-24: "document these for later; I'll add more along the way"). Nothing here is being worked on. Add new items at the bottom with the date raised.

1. **"Rejected — auto-archiving in 7 days" is a false promise** (raised 2026-09-24). No job auto-archives rejected applications; `archivedReason: "rejected"` is stored on an active application and nothing acts on it. New surfaces don't say it; the old copy is still in the application edit-save toast path and Settings → Report a rejection. Options: build it (it can be done without a cron — archive a user's rejected-7-days-ago applications lazily when their list loads), or remove the promise everywhere.
2. **The nightly inbox scan probably never runs in production** (raised 2026-09-24). It's an in-process `node-cron` timer (`0 1 * * *`); Vercel freezes idle instances, so a 1 AM timer inside one won't fire reliably. Confirm from data first (do scan timestamps ever land ~1 AM?). The fix is a Vercel Cron Job hitting an endpoint — deploy config, which is out of scope unless the owner approves it.

---

## 2026-09-24 (later) — App shell, list strips, one dropdown, motion

### Decided (owner)

1. **Shell:** the header takes the sidebar's colour; header + sidebar are one backdrop, and the main section ("main section" = the content area) is a card on it — rounded, subtle border + shadow. Light `--sidebar` is Sora's measured backdrop (`hsl(210 20% 96.1%)`, same hue as before, 2% darker); dark `--sidebar` is one step darker than `--background` so the card reads.
2. **Applications header moves into the list:** the page header is the card's sub-header (slightly bigger title), directly above the list. No box around the rows, no row dividers — only the card has a border.
3. **Table groups are strips** in the sidebar colour, and the column labels live in each strip (Sora pattern). Strips pin under the page header while their rows scroll.
4. **Everything animates:** groups expand/collapse, dropdowns open/close, dialogs appear/disappear, the sidebar collapses — smoothly, at display rate.
5. **The selected view (List/Board/Calendar) must be clearly visible** — Sora's filled segment.
6. **All dropdowns look like Sora's** (quiet uppercase section labels, label-left/control-right rows, pill controls, soft shadow, 12px radius) and **every dropdown uses the same shared component**, Admin included, each keeping its own behaviour.
7. Stage dropdowns show the stage's colour dot; company dropdowns show the company logo.
8. **Classic view loses the stage-chip row** (the Stage filter lives in Filters).
9. **Classic and Table both stay** (with the dev toggle) until the owner says otherwise.

### Built

**Shell & tokens**
- `Layout`: the main section is the scroll container (`#app-scroll`, `utils/scrollRoot.ts`); header and sidebar never move. Page-level sticky bars pin to the card's top (`top: 0`); Contacts/Deadlines/Companies' hard-coded header offsets (57/105/49px) removed. List scroll save/restore and scroll-to-top-on-navigation use the scroll root.
- Tokens in `App.css` only: `--control` (the neutral fill for selected segments, hovered rows, pills — `--muted` is too close to white to read as a state), `--shadow-panel`, `--shadow-floating`, `--ease-out`. Tailwind: `bg-control`, `shadow-panel`, `shadow-floating`, `ease-smooth`.
- **Root-caused:** the theme engine copied every token into `utils/themes.ts` and wrote them inline on `<html>`, silently overriding any `App.css` change. A theme is now only the `.dark` class; App.css is the single source (the copies differed from App.css by ≤1 RGB step, so nothing else moved).
- **Sidebar collapse is a View Transition.** The live width/margin transition re-laid-out and re-rastered the whole main card every frame — measured 50–83 ms frames (~15 fps) on the 650-row table. Now the browser snapshots the shell before/after and animates the snapshots on the compositor; the page lays out once. Sidebar rows keep one layout in both states (icons at the same x), so nothing jumps. Browsers without View Transitions fall back to the CSS transitions; reduced motion is instant.
- Also fixed for that: the Table re-rendered all 650 rows on every resize frame (column memo keyed on raw width) — it now only re-renders when a column threshold is crossed; `PageHeader`'s height variable is only written when it changes (a custom property on `<html>` restyles the whole document).

**Applications list**
- `PageHeader` is sticky at the card top, publishes `--page-header-h`, 16px title.
- Table: group strips (`bg-sidebar`, hairlines, uppercase labels) carry the column labels and pin under the header; "no grouping" gets one "All applications" strip so the labels still exist. No outer box, no row dividers; calm `bg-control` hover. Keyboard-scrolled rows clear the pinned header + strip (`scroll-margin`).
- `ui/Collapse`: groups (Table) and company groups (Classic) ease open/closed (grid-rows 0fr↔1fr, no measuring); closing content stays inert until the motion ends, then unmounts.
- View switcher + `SegmentedControl`: outlined track, clearly filled selected segment.
- Classic: stage-chip row removed (owner).

**One dropdown system** — `ui/Popover` is the only floating surface. It owns look, motion (fade/scale in from the trigger side, quicker fade out), viewport-measured placement (flip, 8px edge clamp), portal, and dismissal. Built on it: `ui/Menu` (actions + single-choice with custom triggers; headings, header block, search, warning/destructive tones), `ui/Select` (listbox; `field` and Sora `pill` looks; option icons), `ui/DateInput`, `ui/Combobox` (suggestion list under a caller-owned input), `ui/HoverCard`.
- Moved onto it: every `ActionDropdown` site (14 — component deleted), the header user menu, "Where it works", notifications (keeps Current|Past, mark-all-read, confirm/revert, dismiss, See all), the admin profile menu, Calendar filters, the resume tag suggestions, `CompanyCombobox`, the admin model-id field (was a native `<datalist>`), the score info card, every native `<select>` (16, incl. Admin) and native date picker (5; the invite expiry is DateInput + a time Select). The Filters panel is laid out like Sora's.
- **Outside clicks are decided by containment, not stack position** (`ui/layers.ts`), in the capture phase: opening a second dropdown closes the first (owner-reported bug — the newly opened one registered first, so the open one thought it wasn't on top; menu triggers that stop propagation hid the click too).
- The one exception: react-big-calendar's "+N more" overlay is drawn by the library (it keeps drag-to-reschedule working inside it), so it wears the same tokens and motion rather than being a Popover.

**Motion for dialogs** — `hooks/useExitAnimation`: as React removes an overlay, an inert static copy (same position, scroll, form values; no ids, not focusable, hidden from AT) plays the exit and is deleted. Works for every `ui/Modal` automatically and for the hand-rolled overlays (import, widget pickers, shortcuts, BYOK onboarding, ⌘K palette, inbox-scan dialogs, idle warning, Admin forms) — no call-site changes. StrictMode-safe (only inserts if the node is really gone). The drawers already slid out through their own close paths.

**Backend — boot migrations run once** (owner approved)
- `services/migrations/runBootMigrations.ts` + `models/Migration.ts` (`migrations` ledger): one read per cold start; each migration runs once per database and is recorded after it succeeds (a failure retries next boot).
- Root-caused a hidden dependency: new resumes were created with `versions: []`, so the "one-time" backfill had actually been giving each new resume its first entry at the next cold start. New resumes now get a "Created" entry on create (`pre("validate")`, so `insertMany` seeds get it too).
- The AI-settings migration's name includes the ai_* keys, so adding an AI setting later seeds it on the next boot.

### Found along the way (fixed)
- Menu hover/active states were `bg-muted` — invisible in light mode. Now `bg-control` everywhere a row is hovered or selected.
- Row toolbars (Contacts, Deadlines) faded their trigger away while its (portaled) menu was open; they stay visible while a menu is open.
- Admin form dialogs used `card-premium`, whose hover lift made the whole form jump.
- `ReviewStep`'s sticky preview sat partly under the old sticky header (fixed by the scroll model; not visually re-checked).

### Still open (not done this round, honestly)
- Hand-rolled overlays still lack the Modal's focus trap / layer stack / scroll lock (they now animate like it). Converting them to `ui/Modal` stays queued.
- Resume Studio's custom accent `<input type="color">` stays native (a colour well, not a dropdown).
- Calendar page height math (`calc(100dvh - 108px)`) predates the card shell; the Calendar revamp is later (decided), so it's untouched.

---

## 2026-09-24 — Personalize page + Custom theme (approved 2026-09-24; built — Steps 1–5)

Owner asks: a rebuilt **Settings → Personalize** that remembers preferences (server-side, follows the user); the **Classic | Table** choice moves there (**default Classic**); a **universal color picker**; a **Custom theme** (Background + Accent + Contrast → every token), ported from Sora's engine but with Sora's measured contrast failures fixed and proven by a property test. Brief: owner's spec pasted 2026-09-24 (Sora refs: `sora/app/lib/theme.ts`, `composables/useTheme.ts`, `plugins/theme.client.ts`, `ColorPicker.vue`, `ColorSwatches.vue`, `settings/personalize.vue` — read-only).

### Audit (measured 2026-09-24)

**Today:** Personalize = System/Light/Dark only, saved per browser per account (localStorage). Tokens live only in `App.css` (fixed this session). No boot script (`index.html` `theme-color` hardcoded `#1a1a1a`). Charts re-read CSS vars on `themeId`. The Classic/Table choice is a dev-only header toggle (localStorage). The demo account is shared by every visitor. Unit tests are co-located `node:test` files; no vitest in the repo.

**Hardcoded colors — frontend, whole app: ~2,500 occurrences.**
- Marketing site (`pages/Landing`, 630) — deliberately default-themed (auth/marketing render the default theme), untouched.
- Admin (538, mostly status palette classes) — see open question 2.
- **In-app (excl. Landing/Admin): 1,334 occurrences in 84 files.** By kind: Tailwind palette classes ~1,000 — ~75% are *meaning* (status red/amber/emerald/green, the six stage colors, A–F fit grades, notification-type chips); `text-white` on fills 67; `bg-white` 15 (logo plates, toggle knobs); `bg-black/x` scrims 22; hex 148 (provider brand colors in AddKeyForm 38, chart palette 19, calendar 18, stage hex 12, resume-print CSS 13); `rgba()` 124 (App.css shadows, auth screens, Calendar.css); generated `hsl()` tag colors (Resumes).
- Heaviest files: EmailScanFlowModal 98 · App.css 93 · EmailScanReview 77 · BoardView 59 · AddKeyForm 59 · Contacts 57 · Resumes 54 · AuthModal 43 · stageStyles 42 · FitSection 42 · Deadlines 39 · applicationHealth 35 · GapStep 35 · AppFitPanel 35 · TableList 34 (full per-file list reproducible with the audit script in the journal).
- Stage colors are still defined in several places (stageStyles badge/stripe/calendar-hex, chartSetup, calendarEvents, Companies) — unified by the stage tokens below.
- Deliberately NOT themed: resume/document previews + PDF (paper), outgoing emails, the browser extension, the marketing/auth screens.

### Token → tier map (Custom themes; presets keep today's App.css values)

| HireTrail token | Role here | Custom source (Sora tier; `e` = step, `card` = brightest) |
|---|---|---|
| `--sidebar` | backdrop: sidebar + header | canvas: `card − 1.0e` |
| `--background` | the main card (panel) | card tier |
| `--card`, `--popover` | raised: inner cards, dropdowns, dialogs | light: = panel · dark: panel + 0.5e (today's dark raises cards) |
| `--muted` | quiet fill (skeletons, chips) | `card − 0.35e` |
| `--secondary` | secondary fill | `card − 0.7e` |
| `--control` | selected segment / hovered row / pill | `card − 0.9e` (Sora's hover tier) |
| `--accent` (shadcn: hover surface — NOT the user's accent) | brand-tinted hover (light blue today) | accent hue, low chroma, `card − 0.9e` |
| `--sidebar-accent` (+fg) | active nav pill (brand-tinted today) | accent hue, low chroma, `canvas − 0.15e`; fg = `--brand-text` |
| `--border`, `--sidebar-border` / `--input` | hairline / field edge | `card − 0.55e` (C ≤ .03) / `card − 1.1e` (C ≤ .045) |
| `--foreground` (+ card/popover/sidebar/secondary/accent -foreground) | text | **solved ≥ 7:1** on every text surface |
| `--muted-foreground` | quiet text | **solved ≥ 4.5:1**, least extreme passing |
| `--primary`, `--ring`, `--sidebar-primary/-ring`, `--chart-1` | the user's Accent, exactly as picked | accent |
| `--primary-foreground` (+ sidebar-primary-fg) | text on the accent | `readableOn(accent)` (flip at L .62, ≥ 3:1 guard) |
| **new** `--brand-text` | links, active icons, focus ring | accent hue, **solved ≥ 4.5:1** vs card + canvas, gamut-aware chroma walk |
| `--destructive`, `--danger` (+fg), `--success`, `--warning` (+fg) | status | fixed hues; text solved ≥ 4.5:1 |
| **new** `--{success,warning,danger,info}-soft` (+`-soft-foreground`) | status tints (replace `emerald-50…`, `success.light` hex) | fixed hue, tint per theme, text ≥ 4.5:1 |
| **new** `--stage-{drafting,applied,oa,interview,offer,rejected}` (+`-soft`, `-soft-foreground`) | stage dots/pills/columns/charts | fixed hues (they carry meaning), tint + text per theme |
| **new** `--grade-{a…f}` (+soft/fg) | fit grades | fixed hues, per-theme tints |
| `--chart-2…5` | charts | derived from the accent hue |
| `--shadow-panel`, `--shadow-floating` | elevation | light: today's; dark/colored: stronger, hue-tinted |
| **new** `--scrim`, `--selection`, `--logo-plate` | modal backdrop, `::selection`, company-logo plate | black-alpha / brand tint / neutral plate |

Plus `color-scheme`, `<meta name="theme-color">` from `--sidebar`, `accent-color`, `caret-color`, placeholder, autofill, scrollbars.

### Rollout (each step ships on its own, production green)

1. **Personalize v2 + list style** — server-persisted `preferences.listDesign` (default Classic; one-time adopt of an existing local choice), remove the dev header toggle. No theming risk.
2. **Color discipline, presets pixel-identical** — add the semantic tokens with preset values equal to today's Tailwind values; migrate the 84 in-app files; charts read tokens. Proof: a computed-style census (every element's color/background/border) on the main pages, before vs after, in Light and Dark → zero diffs except the listed genuine dark-mode leak fixes.
3. **Engine + property test** — `lib/theme.ts` (conversions, generator for every HireTrail token, clamp band, solved text, `--brand-text`, status/stage tints, shadows, `readableOn`, Linear copy format). Property test: thousands of random themes × contrast 0–100, zero failures on fg ≥ 7, muted ≥ 4.5, brand ≥ 4.5, destructive/status ≥ 4.5, on-accent ≥ 3.
4. **State + persistence + boot** — `preferences.theme` on User (validator + `normalizeThemePrefs` both sides), debounced save, server-wins hydration (with a one-time adopt of the same user's local theme so nobody's dark mode resets on deploy), no-flash `<head>` script from a cached token map, split context (drags don't re-render the app), theme-change signal for charts, default theme on auth/marketing.
5. **Color picker + swatches + Custom UI** — Popover-based picker (SV square, hue, hex, EyeDropper, full keyboard), swatch row, mode cards with real generated previews, Accent/Background/Contrast rows, copy/import/reset. Replaces the one native color input (Resume Studio accent — the picker is reused; the resume itself stays paper).
6. **Visual matrix + docs** — bases/accents/contrast matrix screenshots, Benchmark Check each; journal + CLAUDE.md rules.

### Open questions for the owner
1. **Test runner:** Node's built-in `node:test` (runs TS natively on Node 24, zero new deps, matches the existing co-located tests) vs adding vitest as the brief says. *Recommend node:test.*
2. **Admin area:** follows Light/Dark but always renders the presets (never Custom) — *recommended*; or bring its 538 colors into the migration.
3. **Active nav + hover in Custom:** keep HireTrail's brand-tinted active pill (from the user's accent hue) — *recommended* — or Sora's neutral pill.
4. **Demo account:** theme + list style stay device-only for the demo user (it's shared by every visitor) — engineering default, flagging it.

### Decided (owner, 2026-09-24)
- All four recommendations accepted: `node:test`; Admin follows Light/Dark but renders presets under Custom; brand-tinted active nav pill in Custom; demo prefs stay on the device.
- **Admin is fixed alongside** whatever we're working on — no hardcoded colours in Admin either.

### Built so far
**Step 1 — Personalize v2 + list style (done, verified).** `preferences` on User (`validators/preferences.ts`, strict zod, ≤2 KB; `normalizePreferences` mirrored in `frontend/src/utils/preferences.ts`); `PUT /auth/profile {preferences}` merges per key (demo → 403); `hooks/useListDesign` (server value, optimistic + rollback, one-time adopt of the old dev-toggle key; demo = device key). Settings → Personalize: Theme cards (System/Light/Dark with real token previews) + Applications list cards (Classic default | Table). Dev header toggle and `?devtools` removed.

**Step 2 — colour discipline (done, verified).** Changed approach from the token map above, for a smaller, provable diff: instead of rewriting ~1,000 palette classes into new semantic tokens, **Tailwind's palette itself reads CSS variables** (`--palette-<family>-<shade>`, RGB triplets, Tailwind's exact values in App.css; `tailwind.config.js` maps every family). Presets are pixel-identical by construction; a Custom theme will re-tint the palette per shade role (Step 3). Plus:
- New tokens: `--paper` (always white: logo plates, toggle knobs, resume paper), `--scrim` (always black: modal backdrops, tooltips), `--control`, shadow tokens (`--shadow-panel/-floating/-raised/-raised-hover/-button-hover/-xs/-xs-hover`), `--ease-out`.
- `text-white` on accent fills → `text-primary-foreground`; `bg-black/x` → `bg-scrim/x`; `bg-white` knobs/plates → `bg-paper`.
- Inline/JS colours → `utils/palette.ts` `cssPalette()` (stage calendar colours, calendar/deadline chips, score gauges, illustrations, AppFitPanel); Calendar.css / BackgroundTaskCenter.css tokenized; chart helpers (`utils/chartSetup.ts`) read tokens only (`tokenColor`, `paletteColor`, `chartColors(alpha)`, `primaryColor(alpha)`), no hex fallbacks.
- Resume tag chips: per-tag hue + tone → `.tag-chip` (App.css) with light and dark shades. Light = the old formula exactly (208/208 hue×tone combos identical); dark was a light-pastel leak, now ≥ 5.5:1.
- Native surfaces: `color-scheme` per mode, `accent-color` + `caret-color` = primary, `::selection` = primary @ 22%; sidebar navs get `.scroll-quiet` (scrollbar only on hover).
- **Admin shell = the app shell**: backdrop + card main (the scroll container, `#app-scroll`), same nav rows (`components/Sidebar/navParts.tsx`, shared with the app sidebar), View-Transition collapse via the new shared `hooks/useShellCollapse` (Layout uses it too), remembered per shell. Dead `.glass-header` / `.shell-overlap-panel` CSS deleted.
- Remaining literals are documented exemptions: brand marks (provider logos in AddKeyForm, supported job boards, Google/LinkedIn), resume content (Studio CSS, StyleTab presets, `resumeDocument` default accent), the CompanyLogo monogram hue (data), auth/landing, and white text on solid 500–700 status fills (the engine only keeps or darkens those).
- **Proof:** computed-style census (13 colour properties on every element, light + dark). Admin, 17 pages: zero changes inside page content. App pages: zero on Settings ×5, Email review, Import/Export, Jobs, Notifications; the rest differ only by data/state since the baseline (loading skeletons, a moved stage, a different first company) — every new value is an existing token or exact palette colour.

**Step 3 — engine + property test (done, verified).** `frontend/src/utils/theme.ts` (pure): CIELCH in, OKLCH generation, gamut mapping by chroma reduction, HSL-triplet / RGB-triplet out. Every App.css colour token + `--brand-text` + the 242 palette shades, solved per theme: text ≥ 7:1 and quiet text ≥ 4.5:1 on every text surface, brand/status text ≥ 4.5:1, on-fill text ≥ 3:1 (`readableOn`: flip at OKLCH L 0.62, 3:1 guard), palette text shades ≥ 4.5:1 on the theme's surfaces and their own tints. Base L in 0.32–0.80 moves to the nearest edge; a near-black base is lifted so the backdrop stays above ≈ #0a0a0a; both report `adjusted`. Tier steps are calibrated so the seeds (white / #171717 at contrast 30) land on the presets' spacing (light 100 / 96.5 / 91.0 % vs preset 100 / 96.1 / 91.0). `utils/tailwindPalette.ts` holds Tailwind's table (the test checks it against App.css and `tailwindcss/colors`). **Test:** `node --test src/utils/theme.test.ts` (Node runs the real TS module) — 4,900+ themes (edge colours × contrasts, band edges, 4,000 seeded random), zero failures; a mutation check (weakened 7:1 → 6:1) fails it by thousands. `text-primary` now reads `--brand-text` (Tailwind `textColor.primary`) — equal to `--primary` in the presets, solved in Custom.

**Step 4 — state, persistence, boot (done, verified).** `hooks/useTheme.tsx`: `ThemeProvider` (mounted after auth; owns the route check so navigation re-renders only it) + two contexts — `ThemeContext` {dark, mode, revision, toggle} changes only on commit; `ThemeControlsContext` (Personalize) adds rAF previews that paint straight to the DOM. `utils/themeDom.ts` is the one painter (deduped by serialized prefs, transitions suspended across a drag, meta theme-color from the painted backdrop, boot cache). `preferences.theme` on the account, server wins; debounced 500 ms save, flushed with a keepalive request on tab close; rollback to the last saved value on failure. One-time adopt of the *same account's* old local choice (`hiretrail-theme-id:<id>`), then the old keys are removed. Demo = device key (`hiretrail-theme:demo`, reset by the demo login). Signed-out pages = Light; Admin = presets (Custom falls back to its side). `index.html` inline boot script paints from the cache before any JS (no flash). Charts key on `revision`. `utils/themes.ts` deleted.

**Step 5 — picker + Custom UI (done, verified).** `ui/Slider` (role=slider, full keyboard, pointer capture, `onChange` live + `onCommit`) and `ui/ColorPicker` (Popover: SV square, hue slider, hex field, EyeDropper where supported, swatches; HSV is its own state; drags that end outside keep it open). Personalize: System / Light / Dark / Custom cards with real previews (Custom from its generated tokens); Accent / Background / Contrast rows with hex fields; "Adjusted for readability" note; Reset (+Undo); Share → Copy (Linear format) / Import (Modal, inline error, +Undo). Resume Studio's native colour input and range sliders → the shared picker/slider (the resume stays paper). No native `type="color"` / `type="range"` left in product surfaces.

### Found along the way (fixed)
- **Keys faster than a render stepped from a stale value** (Slider, picker square): seven PageDowns moved 10, not 70. Steps now build on the latest value held in a ref.
- **`useListDesign` applied the server's whole response** — it would have overwritten a theme change still in its save debounce. Both prefs now update only their own field (functional `setUser`; `UserContext.setUser` is a real state setter).
- **Demo theme read once at mount** — a visitor logging into the demo after someone else would have briefly seen the old choice. Derived per sign-in now.
- **Admin dashboard charts broke in this change:** they appended hex alpha to colour strings (`palette[i] + "AA"`), which went invalid once the helpers returned `hsl(…)` — Chart.js drew black. Also, the old theme re-tint only touched datasets, so grid/tick colours stayed light-mode after a switch (near-white grid lines in dark). Now the chart config is rebuilt from live tokens on theme change; alpha goes through the helpers.
- A stale Vite dev server (Tailwind config changed under it) silently dropped `bg-paper`/`bg-scrim`/`shadow-panel` — knobs and modal scrims went transparent in dev only. Restart the frontend dev server after any `tailwind.config.js` edit.

### Noted, not changed (owner call)
- **The default blue sits on the 0.62 flip** (OKLCH L 0.623): a Custom theme started from the preset gives buttons dark text where the Light preset has white (3.7:1). That's the spec's rule working as written; say if you'd rather prefer white whenever it clears 3:1.
- **Links in Custom are a deeper blue than the preset's** (`--brand-text` solved to ≥ 4.5:1; the preset's `text-primary` is 3.7:1 on white). Presets unchanged.
- A session that expires while a Custom theme is cached shows that theme for a moment on the signed-out landing (the boot script can't know the session is gone); cleared the moment auth answers.
- Resume tag chips in light mode: worst case 4.2:1 (tone 0 on some hues) — a hair under AA for 10px text. Pre-existing; fixing it is a visible change.
- White text on `bg-amber-600` buttons (Dashboard/Board "stage suggestions") is 3.2:1 — pre-existing, below AA.

### Owner feedback round (2026-09-25) — decided + built
- **The background follows the drag everywhere** (owner: the colour "flipped" near #926095 and stopped tracking). The spec's clamp band (L 0.32–0.80 snapped to the edges) is gone: the panel is the picked colour; text takes the side that reads better, so the only unavoidable change — dark ⇄ light text — happens once. Guarantee now: text 7:1 wherever the background allows it, otherwise the most black/white can reach there (never under 4.58:1); layers flatten on mid-tones instead of text going soft; hover/selected fills step *away* from the text on mid-tones so a selection stays visible (they change sides only at the flip). Near black, layers step from ≈ #0a0a0a and the base's chroma fades in, so the first levels above black don't jolt anything. Proof: new drag-sweep test (6 hue/chroma lines × 3 contrasts × 250 even OKLab steps: background/cards/backdrop never move > 8 levels a step; text flips ≤ once) + "background is the pick" + "fills visible on mid-tones" in the property test.
- **Selection matches the accent:** the tint is the accent blended into the base (OKLab), so a grey accent keeps the base's hue; Personalize's selected cards use the accent (border + badge).
- **Header:** theme toggle and calendar button removed (app + Admin); theme lives in Settings → Personalize, the calendar is an Applications view; Admin's account menu gained Settings.
- **Default = charcoal on near-white:** `--primary` #262626 on `--background` #fcfcfc (1% black), every neutral token de-blued; charts a charcoal ramp; Dark mirrors it (near-white #ededed accent, dark text) — **engineering call, owner to confirm**. Stage/status colours unchanged. Custom's seed follows (Light: #fcfcfc + #262626; Dark: #171717 + #ededed). AI Fit panel slate → neutral.
- **Sora's selected tab:** a raised pill (card surface + `shadow-pill`) with the icon in the accent; items rest in the quiet text colour (muted-foreground) and only brighten on hover — no fill. One style (`navTone`) for the app, Settings and Admin sidebars.
- **Sora's quiet hairlines:** Custom borders are the surface a little darker (dark themes: just below the raised card); Dark preset `--border` 25% → 18% (`--input` 22%); the Settings sidebar's divider and the sidebar footer dividers are gone.
- **Soft card shadows, Settings + Admin only:** `.surface-card` (App.css) = card + hairline + `--shadow-panel`; used by SettingsCard, Personalize cards, the AI-settings sections and 45 Admin cards (not modals, not cards inside cards).
- **Toggles on a light accent:** a switched-on knob is `--primary-foreground` (it vanished white-on-near-white in Dark). Six hand-rolled switches (widget pickers, SystemConfig, AISystemConfig ×2, Resume Studio) got the fix; converting them to `ui/Toggle` is queued.


---

## 2026-09-25 — Landing page, the sign-in sheet, About / Privacy / Terms

### Decided (owner)
- **Direction:** Apple-grade, story-first — not "cards placed around each other". The owner supplied the hero (the "Ethereal Beams" three.js component) and the footer (rounded dark panel, soft top glow, four link columns, content settling in at the very bottom); the header keeps its layout and pill-on-scroll motion.
- **Colour:** match the hero and footer — black and white with neutral greys; the page itself is monochrome, colour lives inside the product (the app previews carry the app's real tokens). Chapters alternate black · white · black · white · black; the owner's brief: *colour change to white, the background sticks and only the content scrolls, then a component arrives and the scroll zooms into it — its black becomes the page.*
- **Header** colours follow the chapter underneath; "Sign up free" and the logo go monochrome.
- **Footer links: real ones only** (no Pricing / Testimonials / Blog / Changelog / Help; social = GitHub, LinkedIn, Email).
- **Sign-in sheet** redesigned to match; it arrives and leaves *softly* (owner: "it's popping").
- **Theme carry-over:** a theme built on the landing becomes the new account's theme.
- **Hero line:** "Tailor. Apply. Track. / Without the spreadsheet."
- **Mobile:** full scroll animations, fully responsive.
- **Claims kept by owner decision (owner is building the backing features — see handoff "Ship blockers"):** JSON export, "40+ AI providers", and "account deletion removes everything".
- **About / Privacy / Terms:** dark, simple, minimalist — done last.
- "If a new idea is better than what was agreed, build it" (owner, mid-build) — used for: one pinned story instead of separate hero / founder / acts chapters; the dive into the **Personalize → Dark** card as the zoom target; the founder line moved to open the second white chapter.

### What's on the page (top to bottom)
1. **The story** (`story/StoryScene.tsx`) — one pinned stage. Hero on the beams; the product window peeks from the bottom, rises as black turns white, steps aside for **Tailor** (Resume Studio: the posting's keywords light up, align, bullets rewrite, the 0–10 score climbs 6.4 → 8.7), **Apply** (a job posting with the real extension panel: Detected on this page → Track this job → Tracked!), **Track** (the Board; an inbox review card → Merge with existing → the card glides Applied → Interview; the real "Merged into existing Stripe." toast). Then Settings → Personalize, Dark is selected, the window turns dark and the camera dives into the Dark card until the page is dark.
2. **Make it yours** (`theme/ThemeScene.tsx`) — the real theme engine (`generateTheme`) painting a live Board from looks, the Personalize swatches, the real ColorPicker and Slider; tours a few looks until the visitor touches it; "Start with this theme".
3. **And everything else** (`everything/`) — ⌘K, Calendar, Deadlines, Contacts, Import, Your AI as big words gliding past a spotlight, each with a piece of the real app beside it.
4. **Founder line → Yours. Always. → Why people switch → FAQ** (`trust/`) — back on white.
5. **Ready when you are + the footer** (`closing/`) — back to black.

### Engineering
- **Beams without three.js** (`hero/beams.ts`): the same geometry, noise, GGX highlight, ACES tone mapping and grain in raw WebGL2 — pixel-matched against the owner's component rendered with three 0.186 + R3F (max difference 1/255, mean 0.004–0.006, identical mean brightness, two frames). ~5 KB instead of ~200 KB gzipped. Starts after first paint, pauses off-screen / hidden tab / faded out; reduced motion = one still frame; context loss handled; no WebGL2 → a static stand-in.
- **Scroll engine** (`engine/scroll.ts`): one passive listener, one frame of work, geometry measured on resize only; scenes write styles straight to the DOM. It also reports the chapter tone under the header (`data-lp-tone`, smallest band wins) for the header colours.
- **The product window** is a fixed 1200×760 design scaled by the scene, built from the app's own tokens and parts (navParts, stageStyles, card-premium, the Board column/card markup, EmailScanReview's CandidateCard, the extension panel, the Personalize ChoiceCard/ShellPreview). Desktop only (≥1024px) — phones and tablets get their own story (below).
- **Speed:** the landing, the public pages and the signed-in shell are separate chunks. A browser without the theme boot cache is almost always a visitor: it gets the landing without the app and **without waiting for the session check**; signed-in browsers fetch the shell in parallel with the check; visitors fetch it on sign-in intent. Sentry loads only when a DSN is configured.

### Found along the way (fixed)
- **Stylesheet order differs between dev and the build** — `Landing.css` loads before `App.css` in dev (main.tsx imports App before the CSS) and after it in the build (lazy chunk). A Tailwind utility and a Landing.css rule on the *same element* for the same property therefore flip between environments (a mobile layout broke; the legal pages' title rendered near-black). Rule: set such properties in one place only.
- A "hold" easing on the everything list (each word holding the line) made the scroll feel like it was resisting — replaced by a 1:1 glide with an overlapping hand-off (owner feedback).
- Public pages opened at the previous page's scroll depth (the document scrolls outside the app shell) — `hooks/usePageEntryScroll` lands them at the top, or at their `#hash`.
- Old landing claims that were false: Typst one-page PDFs, four AI providers / "GPT-4o", Kanban/Calendar/"AI Tailor" in the sidebar, "flips to Applied automatically" (it asks when you tailored), "All systems operational" (hard-coded), "JSON export" in the old FAQ (kept now by owner decision), "auto-updates when a recruiter replies" (relies on the nightly scan — the page now describes the scan + confirm flow).
- The old `auth-*` CSS (≈350 lines: split auth pages, showcase, chips, demo-button sheen) was dead.

### Phones and tablets (2026-09-25, evening)
Owner: the desktop animations "don't reciprocate the same way on mobile … code dedicated to the mobile view." Below 1024px the landing is recomposed, not shrunk:
- **The story** (`story/mobile/MobileStory.tsx`): a narrow browser window (360×500 design) replaces the 1200-wide one — the earlier approach (the desktop window at 1.4× bleeding off the screen, panning to each beat, copy scrolling under it) made the UI tiny and the copy fight the window. Each beat's screen is redrawn for the width (Studio: gauge, keyword chips, the resume; Apply: a posting with the extension's edge tab and panel; Track: the Applications **list** with group strips — the Board doesn't fit a phone — the inbox card, Merge, the Stripe row moving Applied → Interview; Personalize light → dark and the dive). The captions sit in a slot under the device and hand over one at a time (copy scrolling over the device would cover what it describes). The device follows the hero's words up exactly with the scroll and docks under the header; taps show as a touch mark (no pointer on a phone). Sideways phones put the captions beside the device.
- **Make it yours**: a phone-width Applications list as the preview, docked under the header while the controls scroll beneath it (so a change is always in view); on tablets, beside the controls.
- **And everything else**: the app pieces under the words are scrubbed like desktop's (they were swapped by state and popped in); every hand-off is now a dissolve (the next piece over the current one) — also on desktop, where two half-faded pieces showed through each other.
- **Compare** stacks below 640px; **the header** shows "Log in" on phones; **the sign-in sheet** is a bottom sheet below 640px; "Add to Chrome" isn't offered below 1024px (the extension installs on a computer); the browser tint follows the chapter.
- Sized for real viewports: an iPhone's small viewport is ~630–670px tall (not the emulator's 812); pinned stages that change colour are 100lvh with content inside 100svh so collapsing toolbars never reveal a strip.

### Chapter hand-offs (2026-09-25, night)
Owner: after the FAQ the page looked finished (a screen of white); after the dive and after "Your AI", a screen of black; the theme spotlight's edge looked like "a next page". A pinned chapter only started when its section reached the top, so the previous chapter's last screen was dead. Now each chapter starts while the last one is leaving — pulled up over its final stretch and see-through there — so the next content arrives as the old content leaves, and every colour change is one full-screen fade over the content that's leaving (the FAQ's last lines sink into the dark; "Your AI" leaves as the white comes over it; "Make it yours." rises in as the dive goes dark). The spotlight fades in below the section's top instead of being cut by it.

### Noted, not changed (owner call)
- **Privacy / Terms wording is unchanged** (restyled only, verified by a word diff). They still say `hiretrail.vercel.app` (the live site is `hiretrail.manavkaneria.me`), claim Outlook tokens are revoked at the provider (only Gmail's are) and that deletion removes "all associated data" (see the ship blockers).
- The **og:image** is still `Dashboard.png` (the old UI) — needs a new 1200×630 image of the new page.
- The gateway's public model list has 390 models from 38 model makers today; "40+ providers" needs the provider work the owner is doing.
