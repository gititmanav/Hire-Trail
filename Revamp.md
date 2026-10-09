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
- **Phones and tablets** (`story/mobile/`): `useCompactLanding` (`engine/hooks.ts` `useMedia`, `max-width: 1023px`, right on the first render) swaps `StoryScene` for `MobileStory`; the theme preview switches to the phone list the same way. `engine/dom.ts` holds the DOM helpers both stories share (boxWithin, collect, css, setText, setState). The phone screens reuse the desktop screens' constants and parts (keywords, bullets, gauge, extension glyphs, Personalize cards).
- **Hand-offs** (`Landing.css` `.lp-handoff`): Theme, Founder and Closing are pulled up over the end of the chapter before them (`--lp-overlap`: 35svh, 80svh, 40svh) and are see-through there; their background (`--lp-handoff-bg`) begins where that section ends. Founder and Closing let the pointer through (`.lp-handoff-pass`) and their controls opt back in. Their header-tone bands (`.lp-band-before/over/after`) keep the band inside the overlap the smallest, so it wins.
- **Speed:** the landing, the public pages and the signed-in shell are separate chunks. A browser without the theme boot cache is almost always a visitor: it gets the landing without the app and **without waiting for the session check**; signed-in browsers fetch the shell in parallel with the check; visitors fetch it on sign-in intent. Sentry loads only when a DSN is configured.

### Found along the way (fixed)
- **Stylesheet order differs between dev and the build** — `Landing.css` loads before `App.css` in dev (main.tsx imports App before the CSS) and after it in the build (lazy chunk). A Tailwind utility and a Landing.css rule on the *same element* for the same property therefore flip between environments (a mobile layout broke; the legal pages' title rendered near-black). Rule: set such properties in one place only.
- A "hold" easing on the everything list (each word holding the line) made the scroll feel like it was resisting — replaced by a 1:1 glide with an overlapping hand-off (owner feedback).
- Public pages opened at the previous page's scroll depth (the document scrolls outside the app shell) — `hooks/usePageEntryScroll` lands them at the top, or at their `#hash`.
- Old landing claims that were false: Typst one-page PDFs, four AI providers / "GPT-4o", Kanban/Calendar/"AI Tailor" in the sidebar, "flips to Applied automatically" (it asks when you tailored), "All systems operational" (hard-coded), "JSON export" in the old FAQ (kept now by owner decision), "auto-updates when a recruiter replies" (relies on the nightly scan — the page now describes the scan + confirm flow).
- The old `auth-*` CSS (≈350 lines: split auth pages, showcase, chips, demo-button sheen) was dead.
- **`overflow: hidden` on the theme section silently disabled `position: sticky`** inside it (the phone preview wouldn't dock) — now `overflow: clip`, which clips the same way without making a scroll container.
- **A pinned stage of 100svh leaves a strip once a phone's toolbars tuck away** — on the white Founder and Closing stages that strip was the page's black. Colour-changing stages are 100lvh with their content inside 100svh.
- The phone copy of "And everything else" swapped its app piece by React state (a pop, and a re-render per word) — now the same scroll-scrubbed set as desktop.

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
- **Not yet seen for real:** the phone story on a real phone (Safari's toolbars collapsing, rotation), and the chapter hand-offs in a visible browser — both were checked by emulation and DOM measurement only (handoff "Immediate next step").
- **Crossing 1024px mid-visit** (rotating a large tablet, resizing a window) swaps the desktop and phone stories; the page keeps its scroll offset, but the two stories have different lengths, so it lands at a different beat. A landscape iPad (1024px and up) gets the desktop story — not checked at that size.

## 2026-09-25 (late) — Dashboard filter menus

### Decided (owner)
- The Dashboard's Company dropdown must be "appropriate" for a long list (owner screenshot: 50+ companies filling the screen, no search or "All companies" in view).

### Built (5a08f5c)
- **Menu (shared, every menu):** the header and search box stay pinned and only the items scroll, inside a 360px cap (`maxHeight` prop; the viewport is still a cap). Before, the whole panel scrolled, so the search box and first option left the view, and the panel grew to the bottom of the screen.
- **Dashboard filters:** each company and stage shows its count on the right (`getCompanyCounts` in `utils/dashboardInsights.ts`); "All companies" has an icon so it lines up with the logos; "All stages" counts within the chosen company.
- **Shared buttons:** `.btn-secondary` / `.btn-accent` show the token focus ring on keyboard focus (the browser's orange default outline showed after a keyboard pick).

### Found along the way (fixed)
- Company filtering compared untrimmed names while the list shows trimmed ones — a company saved with a stray space filtered to nothing and its stage counts were wrong. Both compare trimmed now.

### Verified
- Local demo account (650 apps, 51 companies): panel 360px with the list scrolling inside; typing "sp" → SpaceX 17 / Spotify 15; Enter applies it (Dashboard shows 17); Stage menu shows counts for the chosen company. Gates + theme tests green.


---

## 2026-09-26 — Calendar revamp (the Applications page's Calendar view)

### Audit (before)
- **Backend / DB:** the view fetched up to 1,000 **full** application documents (JDs included) plus every open deadline, then rebuilt everything after each edit (drag, add, complete, delete all refetched the lot). Deadline list calls ran 3 unused counts. Stored dates are of two kinds — picked days (UTC midnight) and moments (extension saves, stage moves) — and the app read them inconsistently: the grid took the UTC date, the Deadlines page / Upcoming list / List took local time, so US users saw form-picked deadlines a day early outside the calendar and evening saves a day late on it.
- **Frontend:** `calc(100dvh - 108px)` predated the card shell (grid overflowed ~72px, the page scrolled); three columns cut chips to "Ap…"; mini calendar + Upcoming + Today panels duplicated the grid; Week/Day were empty hour grids (every event is all-day); its own Filters (native checkboxes) instead of the shared URL filters; violet meant both "due today" and "Other deadlines"; its own keydown listener (`g d` switched to Day, Escape fired under dialogs); `window.confirm()` for delete; "Open in Applications" went to `/applications`, not the application; deadlines on Offer/Rejected applications lost their company and fell out of company filters. ~530 KB of calendar libraries (react-big-calendar + FullCalendar just for the Dashboard mini widget).

### Decided (owner, 2026-09-26)
1. **Deadlines first, plus the record of the search** — applied dates and stage entries, Offer and Rejected included.
2. **Records as `[stage dot] Company`**, hovering one opens the application card (role, company, location, pay, resume, fit, next deadline, **people at the company**); **everything in the card is clickable** → the application page (people → their contact).
3. **No side panels from now on** (Sora-style page: the grid gets the width).
4. **Day · Week · Month** with a sliding-pill switcher (Sora). Engineering recommendation accepted: Day is a list (no time grid) and does the Agenda's job; no separate Agenda.
5. **The title opens the mini calendar** — a popover on "September 2026" (or the week/day label) with days, months and years, so any date is a few clicks away.
6. Shared URL Filters; one shared day helper app-wide; move the demo seed window forward.
7. Engineering calls accepted without objection: one chip per company (no "12 applications" roll-up); a record's dot is the application's **current** stage; `GET /api/calendar` endpoint (not client derivation); week start by locale; create (`c` / the header button) = **new deadline** in Calendar view; the old "dev toggle" no longer exists, so the new calendar replaced the old one directly on `master` (nothing ships until `master` → `main`).

### Built
**Backend**
- `GET /api/calendar?from&to&tz&<filters>` (`routes/calendar.ts`, `services/calendar/buildCalendar.ts`): applied + current-stage events and open deadlines for the range, plus every open overdue deadline and recurring source, plus a per-application summary for the hover card (company, role, stage + since, applied, location, salary, resume, fit, next deadline). Linked deadlines follow their application's filters; standalone ones show on the Active tab with no narrowing filter (search matches their type/notes). Validated range (≤ 100 days), safe `tz`. 33 ms / 91 KB for a month on the 650-app demo (was 1,000 full docs).
- `services/calendar/days.ts`: the server's day rule (UTC midnight = picked day → UTC date; else the viewer's local date).
- Indexes: `Deadline {userId, completed, dueDate}` (replaces `{userId, completed}`) and `{userId, applicationId, completed, dueDate}`; `Application {userId, "stageHistory.date"}`.
- `PUT /deadlines/:id` returns `nextOccurrenceId` when completing a recurring deadline spawns the next one (Undo removes it); the spawn steps in UTC days. A picked applied date (`YYYY-MM-DD`) is stored as UTC midnight on any server (was server-local midnight — right on Vercel only by accident).
- Demo seed: a rolling window (applications over the last ~8 months, deadlines −60…+45 days as picked days, a few repeating); stage moves that would land after today are spread across the application's real age instead of piling onto today.

**Frontend**
- `utils/dates.ts` (the only day↔Date conversions: `parseYmd`, `formatYmd`, `dayOf`, `addDaysYmd`, `diffDaysYmd`, week helpers, locale week start) and `utils/calendarGrid.ts` (6×7 month grids, rank order, measured overflow, repeat ghosts, drag rules, anchor carry) — both pure, tested under several time zones.
- `ui/MonthGrid` (the one month grid) and `ui/CalendarPicker` (days → months → years, full keyboard). `DateInput` is rebuilt on the picker (same value contract; now follows the locale week start and drills to months/years).
- The Calendar (`views/calendar/`): Month (measured "N more" → day peek over the cell; hover ＋; double-click to add; roving keyboard focus), Week (seven columns, two-line chips, no overflow), Day (a list; today pins every overdue deadline first; complete / reschedule / ⋯ on the row; a week strip on phones). Chips: deadlines = type glyph + **type** · company (overdue = destructive, the one urgency signal); records = stage dot + company (stage entries add "→ Interview"); repeat ghosts dashed at 45%. Hover card (above); clicking a deadline opens its popover (complete + Undo, reschedule, edit, open application, delete with the one light confirm); clicking a record opens the application (J/K and Back work). Pointer-events drag (4 px threshold; the preview is the truth; Esc cancels; an applied date can't move into the future; stage entries and ghosts don't drag). Optimistic edits with Undo and rollback. Paging slides the keyed grid (no out-in, reduced-motion safe); neighbours prefetched; first load is a calendar-shaped skeleton. The anchor lives in the URL (`?d=`); the scale is remembered. Phones: Month is dots (deadlines a dash, records a dot — Rejected is red too), a tap opens Day.
- Shell: the shared search + Filters now apply in Calendar view (Stage included); Display options → **Show: Deadlines · Applied · Stage changes**. `Layout` lets the calendar own its height (no page scroll). (`/admin/calendar` was removed in the 2026-10-05 admin revamp — admins use their own Applications calendar.)
- Dashboard: the FullCalendar mini widget → `widgets/DashboardCalendarCard` (MonthGrid; hover a day for its list; ‹ Today › pages the card only).
- Shared deadline dialog (`components/DeadlineFormModal`) for the Deadlines page and the calendar; `DeadlineTypeIcon` (offer decision is a handshake, not a check that reads as "done").
- `SegmentedControl` has the sliding pill everywhere (measured; off under reduced motion). `HoverCard` gained `className` / `disabled` / `closeOnClick`.
- One stage colour: `STAGE_COLOR` (500 shade, CSS value), `STAGE_TONE_CLASS` (the inbox-scan badges); Companies, PipelinePulse, EmailScanReview, EmailScanFlowModal and Admin moderation now read `utils/stageStyles` (Interview was violet in the scan screens and yellow in Admin; Drafting slate-400 in two places). `STAGE_CALENDAR_COLOR` deleted.
- Day reads moved onto `dayOf`: Deadlines page (dates, "N days", snooze now sends picked days), deadline buckets, Table/Classic rows, detail rail, health/next-action, global search, Dashboard widgets, Board card, Companies, Admin moderation, CSV export, the Import/Export date filter.
- Landing: the "And everything else" calendar vignette redrawn in the new chip language (it's a replica of the real UI).
- **Removed:** react-big-calendar (+ types), all six `@fullcalendar/*`, date-fns, `pages/Calendar/` (incl. the 1,067-line CSS), `utils/calendarEvents.ts`, `utils/calendarRbc.ts`, `MiniCalendarWidget.*`, the CLAUDE.md "+N more" exception.

### Found along the way (fixed)
- **Table/Classic rows kept the last-hovered row highlighted** after the pointer left (owner report): hover moved the J/K cursor and nothing cleared it. Leaving a row now clears the cursor if it's still on that row (`useListBehavior.leaveRow`), so what's highlighted is what Enter/E/X act on.
- **Settings → "Back to HireTrail" always went to the Dashboard** (owner report). The app shell remembers the last page (path + filters, per tab — `utils/returnPath.ts`) and Back returns there, also after the Gmail OAuth round-trip.
- **Filters → Reset didn't reset everything** (owner report): it only cleared stage / company / resume / source, and stayed disabled when only search, Archived or a display option was changed (e.g. every Show chip off). Reset now restores every filter (search and Status too) and the current view's display options, and is enabled whenever anything differs from the defaults.
- **Unlinking a deadline from its application 400'd** ("Invalid applicationId") on the Deadlines page too — the form's "None" is `""`; update now treats it as standalone, like create.
- PRODUCT_AUDIT #9 (drag of a completed deadline "moves" it until refetch) is gone: completed deadlines aren't on the calendar and every move is optimistic with rollback.

### Noted, not changed
- **Deadlines page tabs are still bucketed on the server by instants** (`dueDate >= now`): a picked day counts as "overdue" from 00:00 UTC on its own due day (7 pm the evening before in Chicago). The fix needs the viewer's zone on `GET /deadlines` — do it with the Deadlines page revamp.
- Analytics (`dashboardInsights`, `stageStats`, `companyAggregates`) still bucket applied dates with Date math — a picked day can land in the neighbouring week for US users. Low impact; with the Dashboard revamp.
- The old `{userId, completed}` Deadline index stays in Atlas until dropped by hand (Mongoose doesn't drop indexes).
- The rolling demo window reaches prod only when an admin presses Admin → Settings → "Reset demo" (was "Run seed").
- Applications past the 1,000-document cap were never on the old calendar either; the new one is range-bounded and has no cap.

## 2026-09-26 (later) — Table columns: a reorderable dropdown

### Decided (owner)
- Display → Columns (Table design only — Classic unchanged) becomes a dropdown of checkboxes: a drag handle on the left, the column's name, the checkbox on the right; dragging reorders the table's columns.

### Built
- `views/table/ColumnsMenu.tsx`: a pill ("7 of 8") opening a `ui/Popover`; rows sort with dnd-kit (4px pointer threshold; keyboard: Space lifts, arrows move, Space drops); the row is the checkbox (`role="checkbox"`), drawn by the new `ui/Checkbox` `CheckboxMark` (no native checkbox).
- `views/table/columns.ts`: `columnOrder` (saved per device, `hiretrail-apps-table-column-order`, normalised so future columns append) and `tableColumns(order, hidden, width)`. **The user's order is the fit priority**: the 1st optional column fits from 560px, the 2nd from 700px, … — before, each column had its own fixed threshold, so hiding a column never let the next one in and a column moved to the front would still vanish first on a narrow screen. Role and Stage always come first.
- Filters → Reset (Table) also restores the default order.

### Verified
- Demo account, Table at 1440×900: the dropdown lists the 8 optional columns with handles and checkboxes; unchecking Fit removes it and Applied takes its slot ("7 of 8"); a real mouse drag of Source to the top → the table shows Source right after Stage with its cells aligned, order saved; Reset → default order, all shown; Classic's Display options show only Density and Group by company. Gates green.
- Not verified: keyboard reordering with real keys (synthetic keys can't drive dnd-kit's keyboard sensor — same as the Board).

## 2026-10-04 — Landing round 3: between the hero and the footer

### Decided (owner)
- Audit the landing (code + visuals), research the best sites (21st.dev, three.js, Apple, Linear, Stripe, Vercel, Raycast…), and improve everything between the hero and the footer — the hero and footer stay. "If something you decided looks cheap now, rethink it."
- All eight proposed moves approved; **one shipped font for the landing** (not the system font); **no signature** — the MK monogram may be used.
- Mid-build: the hero's buttons must clear before the rising window reaches them ("blur off and vanish a little early"); the "And everything else" cards a little bigger.

### What changed, and why
- **Font: Inter (variable, optical sizes)** — the page's tracking was tuned for SF and looked different on Windows/Android; Inter's display cut keeps the same voice everywhere. Self-hosted, Latin subset, 39.6 KB, preloaded only for likely visitors. Product previews keep the app's own system font (they are the app).
- **The dive became "the card becomes the page"** — the zoom magnified the UI into blurry blobs and ended on dark-on-dark nobody could read. Now (rethought mid-build): the window comes back to centre, opens Personalize in light, the pointer picks Dark, the Dark card lifts and grows across the white page by layout (sharp at every size) until the page is black. It is the owner's original brief, literally: a component arrives and its black becomes the page.
- **Light as the one motif** — a soft sweep inks the headings from a ghost (scroll-timeline, no JS; plain ink where unsupported), the founder line (replacing the word-by-word reveal — research flagged it as today's most recognisable template effect) and the closing headline; the hero's beams come back behind "Ready when you are." so the page ends in its opening light.
- **Product-true moments** — Tailor's rewrite streams in word by word like generated text; ⌘K is two keys that press and a search that types; the theme recolours with a circle from the control you touched.
- **Orientation** — Tailor · Apply · Track progress (under the window; segments on phones).
- **The white chapter** — receipts under each promise (the exact Gmail/Outlook scopes, the named services, the delete path, the licence — all true to the code), two-tone ledes, balanced wraps, keylines instead of empty bands, a staggered comparison, a shorter founder pin.
- **Defects fixed** — the hero lines drawn over the rising window; the hero colliding with the header on short laptops (630–650 px); unbalanced act margins; the theme preview's wrong address; the phone dock's header band after a fling; the dead black above the footer; the facts line's contrast; the old og:image.
- **Considered and left out** — the comparison's "light pass" down the HireTrail column (on white it read as a gimmick, not light); stacking promise cards (they hold still under the scroll); smooth-scroll libraries (they make content trail the scroll — the "page resisting" feeling).

### Noted, not changed
- Real-browser feel (Safari's scroll timelines, Firefox's plain-ink fallback, Windows/Android font rendering) and a real phone are still to be seen — the pane was hidden; frames came from headless Chrome.
- The three owner-held claims are unchanged (handoff "Ship blockers"); the "Gone when you say" receipt shows the real delete path, but the deletion itself is still incomplete.

---

## 2026-10-05 — AI revamp: the AI layer, My AI, MCP, Connectors, Admin

Plan of record for rebuilding HireTrail's AI end to end. Audit + blueprint: the AI audit (session of 2026-10-04) and the "HireTrail AI Blueprint" artifact (claude.ai/artifact/MSLLTJJHxkUSayMEgT1QtX). Reference implementation (read-only): Sora — `shared/ai.ts`, `server/utils/ai/*`, `app/components/app/AiMapDialog.vue`, `server/utils/mcp-server.ts`, `app/pages/settings/connectors.vue`.

### Decided (owner, 2026-10-05)
1. **The blueprint's short answer, all of it.** Rebuild the AI layer in Sora's shape and keep HireTrail's plumbing (AI SDK, retries, caching, encryption). Long work becomes saved, resumable jobs — no new server, **no Cloud Run worker**. Three lanes per feature — **Included** (HireTrail pays), **My key** (the user's provider key), **My assistant** (the user's own Claude/Gemini over MCP) — plus Off. Free Gemini keys allowed with a privacy line, never for email. The laptop stays out of production.
2. **Drop the Vercel AI Gateway.** Our own adapter per provider: Google Gemini, Anthropic, OpenAI, xAI (Grok), plus DeepSeek, Mistral, Groq, OpenRouter.
3. **The AI budget is configured in Admin** (monthly cap, per-user allowance, per-feature included limits) — nothing hardcoded.
4. **Admin governs the AI map.** Turn the user map off; force a lane per feature (e.g. "tailoring needs your own key"); limit which lanes a feature may use; kill switches; per-user overrides. Engineering to extend this to everything that needs a control.
5. **MCP, built properly, Claude Code first.** OpenAI/ChatGPT only if it comes cheap.
6. **Connectors page like Sora's** (Settings → Connectors). Gmail only for now; the catalog is data so more can follow.
7. **The AI map is Sora's web**: the key's provider mark at the centre, features orbiting it on lines; drag a feature onto another key's cluster to move it. For users (their keys + Included + assistant + off) and for the admin (platform keys).
8. **Admin panel: full revamp** — remove pages that don't earn their place, add AI configuration and budget.
9. **One score:** the deterministic 0–10 match score is the only number; the AI's read becomes words (strengths, gaps, what to change). The A–F grade goes.
10. **Studio rewrites are proposals** — a diff the user accepts per change (or all); nothing lands until accepted.
11. **Inbox: review queue only.** The old auto-apply pipeline goes; every scan lands in the review queue. Outlook is hidden until it joins the queue.
12. **Account deletion stays possible but deliberately a little harder** (retention).
13. **Trust & legal:** engineering may update Privacy and Terms as the product needs.
14. Owner-held: the Vercel plan (owner checking — design for Hobby's 300 s), the production `ENCRYPTION_KEY` (owner checks; remind at the end).

### Engineering decisions
- **AI SDK stays, on the v6 line** (latest v6 patch + the `ai-v6` provider packages). `generateObject` is deprecated in v6 → `generateText` + `Output.object`. The v7 upgrade is a separate, later task.
- **Model ids are never trusted from memory.** The landscape moves monthly (on 2026-10-05 Gemini 2.5 is legacy-only, so today's defaults are already stale). Every key lists its live models; curated defaults are hints validated against that list at add time, with a tier heuristic as fallback.
- **Prices never read as free.** Price = OpenRouter's public catalog (464 models, all eight providers' models, cached 6 h) → curated table → the provider's most expensive known model. Stamped at write time.
- **The registry** (`services/ai/registry.ts`) is the one list of AI features: id, label, one-line description, icon, tier, time budget, lanes it may use, default lane, personal-data class (posting / resume / email), whether it runs in the background, prompt version. Admin pages, the maps, the ledger and MCP all derive from it. Unknown feature id = throw.
- **One door:** `runAiTask(user, featureId, input)` → policy (global/feature/user override) → lane → route (key + model) → budget reservation → adapter call with a time budget → normalized error code → ledger settle → key health stamp. Nothing else imports an SDK.
- **Error vocabulary:** one set of codes with one copy table (`services/ai/errors.ts`); the client never parses provider text.
- **Ledger** (`AiUsage`, extended in place): every call, refusal, cache hit and failure — feature, lane, key, model, tokens, latency, ok, error code, cost, prompt version, job id. Reserve-then-settle for Included spend so parallel calls can't overshoot the cap.
- **Jobs** (`AiJob`): queued → running (lease + heartbeat) → succeeded / failed / waiting_for_assistant; started with `waitUntil`; a status read revives an expired lease; long work (inbox scan) runs in ≤60 s steps that start the next step themselves.
- **Keys** (`AiKey`, replaces `AIProviderConfig`): platform keys (admin) and user keys, AES-GCM, last4, health (`lastCheckedAt`, `lastError`), tested on save, rotate, check now. One-time migration copies supported legacy keys and the admin default key.
- **Routes** (`AiRoute`): platform route per feature + a platform default (Sora's asymmetry: the default lends its key, the feature keeps its own model); user route per feature (lane + key + model).
- **MCP:** `/api/mcp`, stateless Streamable HTTP with JSON responses (serverless-safe); personal tokens (`ht_mcp_…`, SHA-256 at rest, scoped, shown once, revocable, expiring) — works with Claude Code, Gemini CLI and Claude.ai's fixed-token connectors; OAuth later. Tools share service functions with the REST routes. Assistant-lane work waits in the job queue for the assistant to claim.

### Build order (each slice ships on its own, gates green)
1. AI core: registry, adapters ×8, errors, pricing, keys, routes, policy, budget, ledger, jobs, gateway; every current AI call moved onto it; the gateway removed; the Phase-0 bugs (waitUntil, cache key, double save, parse-failure-as-success, drawer side effect, mock fallbacks) fixed on the way.
2. Admin AI: platform keys, the admin map, policies + budget, usage lens, MCP settings.
3. My AI (Settings → AI): user keys, the user map, allowance, assistant connect.
4. MCP server, tokens, tools, prompts, assistant work queue.
5. Connectors page (Gmail), chunked scan jobs, the old pipeline removed, OAuth state fixed.
6. Admin panel revamp (pages audited; keep / merge / remove), per-user AI overrides.
7. Feature rebuilds: posting reader (cut, don't copy), fit (one score), Studio proposals with grounding, profile import/merge.
8. Account deletion (scheduled, re-authenticated, complete purge), Privacy and Terms.
9. Extension cleanup; docs (CLAUDE.md AI rules, contracts, journal, handoff).

### Built (2026-10-05, on `master`)
All nine slices. Where the build differs from the plan above:
- **The door is two functions**, `runAiObject` / `runAiText` (`services/ai/gateway.ts`), not one `runAiTask` — structured answers and prose have different retry/parse rules.
- **Job steps are up to 200 s** (min(200 s, 70% of `FUNCTION_MAX_DURATION_S`)), not 60 s — fewer hand-offs on Hobby's 300 s; a step past its deadline saves state and continues through a signed internal call.
- **Only public posting reads are cached.** A content-keyed cache held parsed resumes beyond account deletion; resumes and email are never cached now.
- **Admin pages removed:** Calendar, Invites, Content, Email templates, Storage, Backup, Seed data (→ Settings → Reset demo, a true reset), AI Providers (→ AI); the unlinked Gmail and Platform analytics pages; the backend routes for performance, integrations and roles (Users & Roles → Users). Kept: Dashboard (rebuilt; excludes demo + deleted accounts), Users, Announcements, Broadcasts, Notifications, Mailboxes (30-day scan stats), Feedback, Bug reports, AI (Map · Rules · Spend), Settings, Audit logs.
- **Admin backups were the only JSON export** — gone with the Backups page. Ship blocker 1 (the landing's "CSV or JSON") is now fully unbacked until a user-facing JSON export lands.

### Added (owner, same day)
- **One toast system.** Owner: a stacked toast that rises from the bottom, used everywhere, uniformly (reference: Sonner-style rich colours — default / success / error / warning). Built our own (`components/ui/toast.ts` + `ui/Toaster.tsx`) instead of a library: bottom-right, the newest in front, older ones tucked behind (narrower, peeking 10 px), hover or keyboard focus fans the stack out and holds the timers, swipe down to close, at most three. Title + optional description + one action; tone colours are palette classes (emerald / amber / red, 700 on light, 400 on dark for contrast). react-hot-toast removed; every call site (60 files) moved; the hand-built ones (Undo, "Open AI settings", the deadline follow-up prompt, the Dashboard drag tip) are plain toasts now.
- **Real brand logos, everywhere.** Owner: "use real company logos, not make-ups". `components/BrandLogo` holds the brands' own marks as inline SVG (LobeHub's AI icon set — Gemini, Claude, OpenAI, xAI, DeepSeek, Mistral, Groq, OpenRouter; Gmail from Iconify's logos set; Outlook from Simple Icons in its brand blue), never recoloured, on a neutral tile. Used by every provider surface (via `ProviderMark`), the Gmail connector and review page, Admin Mailboxes, Claude Code connections and the landing's provider chips. Picked the product marks a key actually runs (Gemini for Google, Claude for Anthropic).
- **AI map → "Reset to defaults".** Owner: the default is what the admin set in Admin → AI → Rules. The button (top-right of the map, only when the person has a choice of their own and may make choices) deletes their per-feature routes; their default key stays (it's theirs, not a default). Undo re-applies the choices as they were shown.

## 2026-10-05 — Classic rows on phones and tablets

### Found
- At 375px the Classic row stacked (`flex-col` below `sm`): the logo rail spanned the card with the logo centred alone, the content block had no inset of its own so the title and company started under the 3px stage stripe ("nitech"), and the 220px / 200px panels sat at fixed widths. Measured: title 1px from the edge; card 487px tall.
- Worse in between: `sm:` is a viewport breakpoint, but the sidebar decides the row's room. At 768px the row went horizontal inside a 470px card — the content column was 12px wide (labels overprinting) and the fit panel ran off the card; at 1024px the content was 148px and the 3-column field grid ~40px a column.

### Changed
- The row lays out by the list's width (CSS container queries, App.css "Classic application rows"): ≥ 960px keeps today's single line exactly; narrower, the logo stays beside the content and the stage + fit panels become a two-up footer. The field grid takes 3 columns at ≥ 360px of content, else 2. The skeleton uses the same classes (it had one 200px panel where the row has two) and now lands within 5px of a real row.

### Verified
- 375 / 768 / 1024 / 1280 / 1440, dark + light, comfortable + compact, grouped by company: no clipping, no horizontal scroll; 1280 and 1440 measure the same as before (panels 220 / 200, rows 141px); phone card 286px tall (was 487).

## 2026-10-05 — "Connectors", everywhere (admin included)

### Decided (owner)
- Mailboxes are **Connectors** — the page and the word — following Sora's connectors page (`sora/app/pages/settings/connectors.vue`) for the UI/UX: a Connected list of rows (logo · name · account · status dot · last activity · Manage), an Available grid of fixed-width tiles (logo · 3-line blurb · a Connect pill), one Manage dialog.

### State
- **Settings → Connectors** already had that anatomy (built with the AI revamp). Not copied from Sora: search + category tabs (one connector), a "Soon" tile for Outlook (owner: Outlook stays hidden).
- **Admin → Connectors** (was "Mailbox Management", `/admin/mailbox`): rebuilt in the same shape — a Connectors list (Gmail: people connected, 30-day scans · found · imported, a failure line when scans didn't finish; Outlook only while earlier connections exist, as Paused), then People rows (name · account · each connector's linked address + last scan · Disconnect, with one confirm). Shared primitives only (PageHeader, Input, SegmentedControl, Button, ConfirmModal). Sidebar: "Inbox → Mailboxes" + "AI → AI" became **Integrations → Connectors · AI**, like Settings.
- Removed the admin "Scan Gmail" button: it called `POST /admin/mailbox/:id/scan`, which the inbox rework had deleted (a 404). A scan is the person's own action — it runs on their AI lane and fills their review queue.
- Wording: the landing's Settings replica (Integrations → Connectors · AI), the notification empty states ("Inbox scans ready for review…" — the `*_detected` pipeline is gone), the audit-log label.

## 2026-10-05 — AI map edges stay out from under the nodes

Owner (screenshots, Sora vs ours): lines showed under the HireTrail mark at the centre. Root cause: edges were drawn centre to centre (a slight curve), and a dimmed node faded its whole circle (`opacity: .4`), so the lines underneath showed through — most visibly on a "Not set up" hub. Now, as in Sora: straight edges from rim to rim with a 5px gap (`mapLayout.ts edgePath`), a dimmed node keeps its opaque circle and fades only its glyph (and drops its shadow), and node labels are solid card colour so an edge passing a label goes behind it. Applies to both maps (Settings → AI, Admin → AI).

## 2026-10-05 — The header search: Spotlight, quick links, no bell

### Decided (owner)
- The header search becomes the reference video's bar (21st.dev, samitkapoor's "Apple Spotlight"), **centred in the header**, flawless and pixel-faithful. A motion library is fine if it makes it better.
- The hover circles are **quick links** to pages, configurable: from AI, Personalize, Applications (list), Board, Resumes, Calendar, Notifications. Default **AI · Notifications · Calendar**, plus a 4th **"+"** that opens the catalogue; in edit the links jiggle (Apple-widget style) and pages drag in from / out to the catalogue.
- Remove the header's **"Where it works"** card, and then the **bell**.

### Built
- `components/Spotlight/` — `Spotlight.tsx` (the bar), `quickLinks.ts`, `useQuickLinks.ts` (account-saved; demo on the device), `searchIndex.ts` (pages + records, ranked), `SpotlightIdle.tsx` + `geometry.ts` (the lazy split). `preferences.quickLinks` on both sides (≤3, each once; unset = defaults, `[]` = a choice). `motion` 12 added.
- **Measured off the recording** (3824×2484 = 2×): pill 66 CSS px, circles 64 inset 1, 16 apart, idle 768 wide, dock pill 448 (the dock fills exactly what the pill gives up); open panel radius ≈30, highlighted row 56 tall, 9 in, radius 14, white on #f3f3f3; the morph starts ~17ms after the pointer and covers most of the way in ~130ms with ≈1% overshoot. Scaled to a 36px pill: circles 34 inset 1, 9 apart, 420 / 248. Rows keep the structure in HireTrail's type (13/11.5px, 44px) — a uniform scale would have set them at 9px.
- **One liquid surface:** shapes (pill, circles, both panels) under an SVG goo filter (blur 5, alpha ×20 −9, source composited over) with a hairline + lift as a filter after it; content on an unfiltered layer animated by the same springs. Circles bud out nearest-first, fold back farthest-first; typing grows the pill into the panel and swallows the circles; the catalogue drips out of "+".
- Hovering a circle names it in the pill (blur-crossfade placeholder); during a drag the pill says what the drop will do ("Swap with Calendar", "Drop to add", "Drop to take it off").
- Edit: links jiggle (inner element — the springs own the outer transform) with a remove badge; "+" turns into a check; catalogue tiles drag onto the bar (a full bar swaps with the nearest link) or get clicked; a full bar shakes and says why (aria-live); Alt+←/→ reorders by keyboard; Escape / outside click / Done close.
- Results: ↑ ↓ / Enter / Esc, hover follows, a sliding highlight (shared layout), the scroll keeps the active row in view; records load quietly once and cache a minute. ⌘K / Ctrl K focuses the bar. It's a layer (`layers.ts`) while a panel is out.
- Phones: the bar fills the space between the clusters (search only); the results panel spans the screen with 16px gutters; 16px input text (no iOS zoom).
- The bell → `hooks/useUnreadNotifications` (same poll — it also revives stalled AI jobs), the count on the sidebar's Notifications row (a dot when collapsed) and a dot on the Notifications quick link. The Notifications page refreshes the count after it reads/clears, and its handlers stop double-toasting errors.
- The avatar's name/email now show from xl (1280) up, so the bar has room at laptop widths.

### Found along the way
- An SVG filter renders only inside its element's box — the liquid layer is sized to every shape's reach, or the panels would have been clipped.
- Adding a dependency mid-session leaves Vite's pre-bundle stale ("504 Outdated Optimize Dep", a blank app) — restart the dev server.
- The search first shipped in the shell chunk: 5.6 → 58.8 KB gzip. Now lazy: shell 6.1 KB, Spotlight 54.3 KB loading beside it.

## 2026-10-06 — Dialogs and drawers

### Decided (owner)
- Inside a dialog, text fields lose their boxes — plain text on the surface with a soft fill on hover/focus, like Sora. Dropdowns inside dialogs are the shared chip.
- Every modal appears and leaves softly — never a blink — and every overlay goes through one common component.

### Built
- One look switch, `ui/fieldLook.ts`: the page keeps the bordered field; `ui/Modal` and `ui/Drawer` switch their contents to "plain". A plain field always has a placeholder (at rest it's the only thing that shows).
- Two shells, one behaviour: `ui/Modal` (centred) and `ui/Drawer` (a side panel for work that wants the screen's height) share `ui/useOverlayLayer` — the layer stack, scroll lock, focus in/out, Tab trap, Escape for the top layer only.
- Drawer motion: slides in from the right edge (380ms ease-out) over a fading scrim, and back out (240ms). The scrim is its own layer — the first build faded the panel's parent and the page showed through the panel mid-slide. It closes itself on the live panel, so a PDF iframe or a rendered resume doesn't blank out on the way.
- Focus on open: `[data-autofocus]`, else the panel itself. Focusing the header's X (the old default) drew a ring on it whenever a dialog opened from the keyboard.
- Gmail scan wizard: closing mid-scan just closes (the scan runs on; banner + notification bring the person back) — only the review asks before dropping results. This matches the step's own copy and the background banner; the old "lose results" prompt mid-scan contradicted both.

## 2026-10-06 — One page header, everywhere

### Decided (owner)
- Every page gets the Applications sub-header: the same title size and weight, meta beside it, controls on the right, spanning the **full width of the page card**.
- Deadlines: Upcoming | Overdue | Completed as a tab switch like List · Board · Calendar.
- Contacts and Companies: the Applications header itself — search, Display options, Filters — so the page body gets cleaner.
- Resumes, Resume Studio and the rest: the same header design; heading sizes stop differing page to page.
- New application: "Add a resume" lives inside the Resume dropdown, not beside it.

### Root cause of the short dividers
`Layout` wrapped every page except Applications, Dashboard, Profile and Studio in a `max-w-[1200px] mx-auto` column, so a page's full-bleed header could only bleed to that column's edges — on a wide screen the hairline stopped short of the card. Pages that centred themselves (Notifications, Resumes, Applications' Classic list, the detail page) had the same problem one level down. Now the shell gives every page the card, the header is always the page's first element, and the page caps only its body (`PageBody`).

### Built
- **The kit** (`ui/PageHeader.tsx`): `PageHeader`, `PageBody`, `PageSearch` (moved from Applications), `HeaderIconButton`, `CreateButton`; `ui/FiltersPopover` — the button + panel (Filters · Display options · footer) that Applications' Filters menu now composes; `SegmentedControl countsFromSm`; `Select action` (a row pinned under the list, reached by the arrow keys).
- **Pages:** Dashboard (Company and Stage move into Filters; lock and widgets become icon buttons; create opens the new-application dialog), Applications (the header leaves the Classic 1200px column), the application detail page, Deadlines (the tab switch, counts in the meta with overdue in red, keys 1–4; the old tab strip and summary row go; section strips pin under the header), Contacts, Companies, Resumes (title "Resumes", matching the sidebar — was "My Documents"; Studio's copy follows), Resume Studio (the "Back to Documents" link goes — the sidebar and the variant note link back), Notifications (Current | Past in the header, "Mark all as read" as an icon button), Profile (import actions in the header; the section tabs pin under it), Job Search, Import & Export, Inbox review (a "Connectors /" breadcrumb), and Admin's Announcements, Broadcasts, Notifications, Feedback, Bug Reports, Audit Logs (titles match the admin sidebar; descriptions kept as a line under the header, like Connectors).
- **Contacts:** Filters = Status (with counts per status) + Source (manual · extension · inbox scan); Display = Group by Person | Company (remembered). **Companies:** Filters = Stage (companies where one of your applications is at that stage, with counts); Display = Sort: Name A–Z · Most applications · Latest application (remembered). Engineering's call on what Companies filters by — the page had only a search, and these are the two the data answers cheaply and truthfully.
- **Server:** `GET /contacts` takes `search` (name or company) and `status`, returns `statusCounts` (a contact saved before outreach tracking counts as not contacted); `GET /companies` takes `stage` and `sort`, returns `stageCounts`.

### Found along the way (fixed)
- Contacts' search and status filter ran in the browser over the current page of 20 — a contact on page 2 was unfindable, and the status counts described one page.
- `GET /contacts` capped `limit` at 100 while the CSV export asked for 999 (and Companies / search for 500): exports silently stopped at 100 contacts. The cap is 1000.
- Profile's section tabs were `sticky` inside an `overflow-hidden` card, so they never pinned; the card clips with `overflow: clip` now.

## 2026-10-06 — Watching the assistant connect

### Decided (owner)
- After running the `claude mcp add` command there was no acknowledgement. The page should know when Claude Code connects and say so — like Sora's agent wizard (waits for the machine's hello, flips green) — "even better than Sora".

### Built
- **Server stamps, not guesses:** each token keeps `helloAt` (the client's first MCP `initialize`, with its name/version) and `firstTool` / `firstToolAt` (its first `tools/call`), read off the request in `routes/mcp.ts`. Tokens from before keep working: a recorded client counts as a hello.
- **The connect card is three live steps** (Sora has one flip): copy the command → "Claude Code 2.1.280 said hello" → "First request: who you are" — the last proves the whole path, not just the handshake. A green edge fills by thirds; the step rail turns green as each lands; one toast on the hello; the AI map refreshes so the My assistant lane wakes; the button becomes Done.
- **It tells the truth about Claude Code:** `claude mcp add` only saves the setting, so step 2 says Claude Code connects when a session starts (or `claude mcp list` checks now); after 40 s without a hello it explains what `claude mcp list` should show and what Failed means. Starter prompts to copy for step 3.
- **Connection rows** show state: a green dot + "Connected", the client in words ("Claude Code 2.1.280" from "claude-code 2.1.280"), last use, last four.

## 2026-10-06 — Phones (Contacts, Deadlines) and the board drag

### Decided (owner)
- Fix the Contacts cards and the Deadlines rows at phone width (they squeezed their text; the pager ran off the screen).
- "The kanban cards flicker a lot when I move a card from one column to another" (screenshot, then a recording).

### Built
- **Rows by their own width** (container queries, like the Classic rows): a narrow contact card puts strength / last contact / follow-up in a footer under the name; a narrow deadline row puts the due date under the text and drops the company mark (the text names it). The hover-only tools fold into one always-visible "⋯" `Menu` on narrow rows, and show without hover on touch screens (`@media (hover: none)`) — before, a phone couldn't reach Edit / Delete at all.
- **One pager:** `ui/Pagination` replaces three copies (Classic list, Contacts, Deadlines); narrower than its full set it becomes ‹ Page 3 of 11 ›.
- **Board drag:** cards are dnd-kit draggables and columns drop zones — no sortable lists. Root causes of the flicker: the hover preview moved the card into the target column, then the card under the pointer was read by its stored stage and the preview moved it back (oscillation); and sortable columns displaced the other cards on top of the moved preview (a card ended up below its column). Now nothing moves until the drop: the held card stays dimmed, the target column shows a card-sized slot (fades in), and a move skips the fly-back drop animation (a drop in place still animates home). Arrow-key dragging still works (`sortableKeyboardCoordinates` reads any droppables).

## 2026-10-08 — Admin: hardening + Admin's own search

### Decided (owner)
- The admin audit (2026-10-05, this session's earlier pass) proposed one shell for app + Admin, admin personal settings in the app's Settings, and rebuilding the bodies of the admin pages the AI session had only given headers. **All dropped** — Admin keeps the AI session's design (its layout, header, Connectors, pages) as it is.
- **Yes to every security fix** from the audit that `master` hadn't already made.
- **The header search, customised for Admin** — Admin's own pages, people, quick links.

### Built
- **Forged requests:** admin writes from another site are refused (`middleware/sameSite.ts` — the browser's `Sec-Fetch-Site`, else the `Origin` against the app's origins). The session cookie is SameSite=None in production, so before this a page anywhere could submit a form as the signed-in admin (e.g. email every user).
- **Maintenance:** one rule, `mayUseDuringMaintenance` — every admin account plus `ADMIN_EMAILS` and the bypass email — at every sign-in path for an existing account (local, Google web, the extension's token routes, Google-extension), the API gate and MCP. The gate already let admins through; signing in didn't, so an admin outside `ADMIN_EMAILS` who was signed out couldn't get back to the switch.
- **Accounts no admin may change:** the shared demo account (promoting it would hand every visitor admin — its password is public) can't be promoted, suspended or deleted; the last working admin can't be demoted, suspended or deleted (today the self-guards already make this hard to reach; it closes the race of two admins demoting each other).
- **Input:** Feedback / Bug reports searched with raw `$regex` — now `searchRegex`, like Users and Connectors (whose repeated `?search=` crashed); Notifications and Audit-log filters accept known values only (`?type[$ne]=` was an operator); audit dates must parse; users sort is an allow-list (it accepted `password`). The users CSV export quotes every cell and neutralises formulas.
- **Admin's search:** the same Spotlight with Admin's scope — its pages (plus "AI rules", "AI spend", account settings, personalize), people by name or email searched on the server as you type (any account, not one loaded page; a person opens their details on Users), Admin's quick links (Users · Feedback · Bug Reports by default, from a catalogue of Admin's pages, saved on the account as `adminQuickLinks`), and a dot on Feedback / Bug Reports while something is open there.

### Noted, not changed (owner call)
- **CSRF in the rest of the app:** the same exposure exists for every cookie-authenticated write outside Admin; the guard is ready to mount on all of `/api` once the extension and OAuth paths are checked.
- **`ADMIN_EMAILS`** grants admin to whoever registers a listed address, without email verification — recommend Google-verified sign-ins only.
- **Dev backend:** a failed first Mongo connect exits the process, and `tsx watch` doesn't restart it — the cause of the owner's "can't log in, status 500" on 2026-10-08. A dev-only retry is proposed.
- Left as they were (owner dropped the page work): the audit log's end date still excludes that day; announcements still can't be scheduled; admin notification delete is still a hard delete; broadcast previews render raw HTML in the admin page.

## 2026-10-08 — Applications: Ledger · Trail · Desk

### Decided (owner)
- **Three list designs, the person's choice** (Personalize → Ledger · Trail · Desk, saved on the account as `listDesign`; old `classic` / `table` read as Ledger). The concept doc was `design/applications-redesign.html` (not committed). The Classic list and its awkward pipeline panel are gone; the Table became the Ledger.
- **Desk:** the application is never a separate page — an Expand button lets the pane take the page and turns into Shrink; the open application is in the URL so a refresh lands on it.
- Fix every item of the audit's bug, debt and backend lists (BUILD_JOURNAL "2026-10-08 (night)").
- No motion may blip or jump — things glide.
- **The peek hangs from its row** (owner screenshot: "looking awkward … attach it to the row above it, slide open from that row, its top corners curve into the row's bottom corners"). Then: "do this kind of stuff throughout — where needed".
- **The Desk pane's hero is role + company only** — stage, dates and the rest are already in the rail on the right.

### Built
- **What a row says** is the stage's question, from one tested module (`data/focus.ts`): Offer → the decision date; Interview → the next round or how long it's been quiet; OA → its due date; Applied → follow-up / thank-you dates, else sent N days ago against *your* reply window (the server measures how long your replies took); Drafting → what's missing. Overdue reads in red with how late; deadlines overdue for more than two weeks stop driving the row (they're abandoned, not urgent).
- **Momentum groups** — In motion (something dated soon or overdue), Waiting, Drafts, Closed — beside the stage groups; the smart order inside each.
- **Ledger:** the Table with a "Next" column, the trail column, optional columns that fit by width in your order, two-line rows on narrow widths, and the peek: one row opened in place, attached to it as one shape (the row rounds off, the panel shares its fill, inverse fillets inset by the two radii so the curves meet as one S). The peek shows the next step's actions only (the row already says the step), fit, people at the company, notes.
- **Trail:** every application as a line through time against a sticky axis, today and the future marked, three zooms that glide. On phones the next step moves to the end of the name line and today/the future are drawn per row so nothing runs through a name.
- **Desk:** a list well beside the whole application. The selected row is the pane's tab — the pane's surface running into the pane with the same fillets, gliding from row to row as J/K move. Expand/Shrink is a view transition (the list slides, the pane grows); Back = Shrink. One pane at a time below 900px.
- **Sweep:** the applications quiet past your reply window, one at a time with one key each (follow up · wait · ghosted · rejected), undoable.
- **Board:** role-first cards with the focus line and trail, Rejected folded into a rail you can still drop on, no "stuck" banner or guessed ghost cards.
- **Craft passes (owner's "throughout"):** no panel repeats what its row says ("Fit check" / "Fit checked" → the counts; the peek's step text); add-date buttons name the date ("Add the decision date"); the Desk list's right column has one edge; the people list sits level with its neighbours; phone headers keep the controls on one row (the search fills what's left).

### Noted, not changed
- **The landing's replicas** of the Board card and the phone list (`story/BoardScreen.tsx`, `story/mobile/screens.tsx`) still show the old card — update them before `master` goes to `main` (CLAUDE.md: the story's window is a replica of real UI).
- **Next step vs the rail's Deadlines** in the detail both show the top deadline (the card acts on it, the rail lists all). Owner call whether the rail should skip the one the card shows.
- **The 1,000-application cap** on the loaded list stays (the Ledger/Trail/Desk say so and point to filters); export pages through everything.
