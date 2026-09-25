# BUILD_JOURNAL — dated single source of truth

Append a dated entry every session: decisions, what was built, what was verified and HOW, sharp edges. Locked decisions live here — do not re-litigate.

---

## 2026-09-25 — Owner feedback: drag-tracking Custom themes, charcoal default, Sora sidebar/cards

Details: **Revamp.md → "Owner feedback round (2026-09-25)"**.

### Built
- Engine: no clamp band — the background is the pick; one text flip; bounded surfaces flatten on mid-tones; fills step away from text there; tier floor + chroma fade near black; exact black/white at L 0/1 (a `[0,0,2]` "black" missed a mid-tone target); base/accent taken from the continuous gamut-fitted colour (8-bit rounding invented hues near black); quiet Sora hairlines; accent tint = OKLab blend of accent into base.
- Presets: charcoal on #fcfcfc, neutral greys (Dark mirrored); `--shadow-pill`; Dark hairlines 18%.
- UI: header theme/calendar buttons removed; Sora selected tab (`navTone`), quiet sidebar text, hover = text only; sidebar footer + Settings sidebar dividers removed; `.surface-card` in Settings + Admin; accent-coloured selection on Personalize cards; mid-tone note replaces "Adjusted"; toggle knobs follow state.

### Verified (HOW)
- `node --test src/utils/theme.test.ts` 8/8 — new: drag sweep (backgrounds/cards/backdrop ≤ 8 levels per even OKLab step, fills too except at the flip, ≤ 1 flip), background = pick (lightness ±0.006, hue ±3°), fills visible on mid-tones, borders visible vs their card. Gates: backend tsc, frontend tsc -b, build green (main 857 KB / 252 KB gzip).
- Browser: `#926095` + black accent paints exactly (white text, mid-tone note); `#B33939` shows darker hairlines + card shadows; header has no theme/calendar; raised pill in app/Settings/Admin; hover keeps the background transparent and brightens text (#6e6e6e → #333); Dark toggles show a dark knob on the near-white track.
- NOT verified: the drag *feel* on your screen (pane hidden — covered by the sweep test instead); Safari/Firefox.

### Sharp edges
- **Measure drag continuity in even perceptual steps through real 8-bit colours** — CIELCH steps near black are huge in OKLab, and OKLab exaggerates the first 8-bit levels.
- **Test rules encode design choices** — "border ≥ 1.12:1 on the background" had to go when the owner asked for quiet hairlines; the invariant is "visible against the card it outlines".
- A hand-toggled `.dark` class without `theme-transitioning` leaves transitions mid-flight in a hidden pane — read computed colours only after suppressing them.

---

## 2026-09-24 (latest) — Personalize v2, Custom themes, colour discipline, Admin shell

Decisions + details: **Revamp.md → "Personalize page + Custom theme"** (plan, owner answers, Steps 1–5 as built, findings, open calls).

### Decided (owner)
- Personalize page remembers preferences on the account; Classic | Table lives there (default Classic).
- A universal colour picker and a Custom theme, following the Sora spec (Sora read-only).
- `node:test`; Admin renders presets under Custom; brand-tinted active nav in Custom; demo prefs on the device.
- Admin is fixed alongside whatever we're working on — no hardcoded colours there either.

### Built
- **Preferences:** `preferences` {theme, listDesign} on User (strict zod, both-sides normalizer); `PUT /auth/profile {preferences}` merges per key; demo → 403.
- **Colour discipline:** Tailwind's palette reads `--palette-*` variables (presets = Tailwind's exact values), `--paper` / `--scrim` / shadow tokens, `cssPalette()`, token-only chart helpers, `.tag-chip`, native-surface theming (`color-scheme`, `accent-color`, `caret-color`, `::selection`), quiet sidebar scrollbars.
- **Admin shell = app shell** (backdrop + card scroll root, shared nav parts, `hooks/useShellCollapse` View Transition for both shells).
- **Engine:** `utils/theme.ts` + `utils/tailwindPalette.ts` + property test `utils/theme.test.ts`.
- **State:** `hooks/useTheme.tsx` (ThemeProvider, split contexts, debounced/keepalive save, legacy adopt), `utils/themeDom.ts` (the one painter + boot cache), `index.html` boot script; `utils/themes.ts` deleted.
- **UI:** `ui/Slider`, `ui/ColorPicker`; Personalize rebuilt (4 mode cards, Custom rows, Reset/Import/Copy with Undo); Resume Studio Style tab off native colour/range inputs.

### Verified (HOW)
- Gates: backend `tsc --noEmit`, frontend `tsc -b`, `npm run build` green; engine adds ≈ 4.9 KB gzip to the main chunk (859 KB / 251 KB gzip).
- `node --test src/utils/theme.test.ts`: 7/7 — 4,900+ themes, zero contrast/structure failures; hex round-trip over 50k colours; `readableOn` over 20k fills; palette table = App.css = `tailwindcss/colors`. Mutation check (7:1 → 6:1) fails it by thousands.
- Computed-style census (13 colour properties per element, light + dark) vs the pre-change baseline: Admin 17 pages — zero changes inside page content; app pages — zero on Settings ×5 / Email review / Import-Export / Jobs / Notifications, the rest differ only by data/state (every new value an existing token or exact palette colour). Tag chips: light identical to the old formula on 208/208 combos; dark ≥ 5.5:1.
- Browser (dev DB): toggle → paint now, one PUT at ~574 ms; reload paints from the server value; boot script extracted from the served HTML re-paints preset and Custom (288 tokens) on a reset page; signed-out → Light, boot cache cleared; Admin → preset, back in the app → Custom restored. Picker with real pointer drags: live preview, one PUT per drag, drag past the edge keeps it open; swatches, Escape, keyboard slider (Home/End/PageDown bursts), Import (junk → inline error; valid → applied; Undo restores exactly), Copy (Linear format). Chart grid/tick colours re-read on toggle. Drag frame: 3.3 ms median / 6.6 ms p90.
- Visual matrix screenshots: warm light + orange, dark slate + green (Applications, Board, Calendar, Contacts, Resumes), mid-grey (adjusted), saturated yellow + violet.
- NOT verified: Resume Studio Style tab visually (needs a tailored document on the dev account); Safari/Firefox (Chrome only); the hidden pane blocked judging motion.

### Sharp edges
- **Restart the Vite dev server after any `tailwind.config.js` edit** — a stale one silently drops new utilities (`bg-paper`/`bg-scrim`/`shadow-panel` rendered transparent in dev only).
- **Chart colours are CSS strings now** — never append hex alpha (`color + "AA"`); pass alpha to `tokenColor`/`chartColors`/`primaryColor`.
- **WCAG ratio can't judge depth near black** — the property test measures backdrop/panel steps in OKLab L.
- **CIELCH can name colours sRGB can't show** — the engine works from the painted (gamut-mapped) colour.
- `git mv`/`git rm` this session staged `hooks/useTheme.ts → .tsx` and the `utils/themes.ts` deletion (nothing committed).
- Editing a backend file restarts `tsx watch`, which drops the in-memory dev session — the app lands on the landing page; not a product bug.

---

## 2026-09-24 (later) — Card shell, list strips, one dropdown system, motion; boot migrations once

Decisions + details: **Revamp.md → "2026-09-24 (later)"** and **"Parked — decide at the end"** (auto-archive promise, nightly scan).

### Built
- **Shell:** header + sidebar are one backdrop (`--sidebar`, Sora-measured); the main section is a rounded card that is the scroll container (`#app-scroll`, `utils/scrollRoot.ts`). Sticky page bars use `top: 0`.
- **Tokens:** App.css is now the only token source — `utils/themes.ts` used to copy every token and write it inline on `<html>`, overriding App.css. New: `--control`, `--shadow-panel`, `--shadow-floating`, `--ease-out`.
- **Applications:** PageHeader = card sub-header; Table strips (sidebar colour) carry the column labels and pin under it; no outer box / row dividers; `ui/Collapse` animates groups (Table + Classic); clear selected state on the view switcher / SegmentedControl; Classic stage chips removed.
- **Dropdowns:** `ui/Popover` is the one floating surface (look, motion, placement, dismissal); Menu / Select / DateInput / Combobox / HoverCard on it. Every dropdown in the app moved onto it (ActionDropdown deleted; 16 native selects, 5 native date pickers, a datalist, 7 hand-rolled panels). Stage options show colour dots, company options logos.
- **Motion:** dialogs animate out via `hooks/useExitAnimation` (inert copy plays the exit) — every `ui/Modal` + the hand-rolled overlays; sidebar collapse is a View Transition.
- **Backend:** `runBootMigrations` + `migrations` ledger — each migration once per database; new resumes get a first "Created" version on create.

### Verified (HOW)
- Gates: backend `tsc --noEmit`, frontend `tsc -b`, `npm run build` green (main chunk 836 → 837 KB).
- Sidebar perf (in-app browser, visible, 650-row table): **before** 50–83 ms frames during the toggle (~15 fps), cause = the Table re-rendering all rows per resize frame. After the re-render fix, forced style+layout per animation step measured 2.3–5 ms (Table), ~1 ms (Board), 1–5 ms (Dashboard). View Transition path checked functionally (class added/cleared, widths/margins/border correct both ways). **Not seen with real frames** — the pane was hidden for the rest of the session.
- Shell: main scrolls, document doesn't; PageHeader pins at the card top; strips pin at card top + header (122 px = 64 + 57 + 1); Deadlines tab bar + bucket headers pin flush (0 / 42 px).
- Collapse: height interpolates over ~220 ms both ways; closing rows inert, unmounted after.
- Dropdowns: Filters panel / nested Select layering (Esc closes the list only, then the panel; focus returns to the trigger); sibling dropdowns close each other; Account menu / bell / Filters close each other; picking an option applies the filter (`?source=extension`) and keeps the panel open. Screenshots: shell + table (light, dark), Filters panel, user menu, notifications panel.
- Dialog exit: New application → Esc — inert copy with `overlay-out`/`panel-out`, no ids, live dialog gone, body scroll unlocked, copy removed; no copy on open (StrictMode double-mount safe).
- Backend: first boot recorded all four migrations; the next boot ran none. Resume hook checked on the local DB with throwaway docs: `create` and `insertMany` → "Created"; explicit versions kept; cleaned up.
- NOT verified (pane hidden): screenshots of the stage-dot / logo options, Classic without chips, Calendar filters panel, Admin pages' new Selects/DateInputs, the ⌘K / shortcuts / import exits, dark mode of the new dropdowns, the View Transition motion itself.

### Sharp edges
- **Tailwind `shadow-<name>` collides with colour names** — `shadow-card` compiled to a shadow *colour*. Shadow tokens are `shadow-panel` / `shadow-floating`.
- **Portaled panels leave page-scoped CSS variables behind** (Calendar's `--cal-border` lives on `.cal-page`) — declare them on the panel body too.
- **Outside-click by stack position is wrong** — the dropdown being opened registers before the click reaches `document`. Decide by containment, in the capture phase (triggers that stop propagation would hide it otherwise).
- **React detaches refs before it removes DOM** — that's what lets `useExitAnimation` copy the node. Check `isConnected` in a microtask so StrictMode/Suspense detaches don't leave copies.
- **`::view-transition-new` is live** — never combine a view transition with CSS transitions on the same change (double motion). The shell's CSS transitions only apply without View Transitions.
- **A live width transition on the shell re-lays-out and re-rasters the whole card every frame**, and a raw-width `ResizeObserver` → setState re-renders the whole list per frame. Bucket the width.
- `noUnusedLocals` is off — unused imports aren't caught by `tsc`; check touched files by hand.
- The in-app browser pane: hidden → `visibilityState: hidden`, rAF stops (no frame timing possible); viewport emulation renders scaled — don't judge smoothness with emulation on.

---

## 2026-09-24 — Prod 500s root-caused; Applications page revamp (List · Board · Calendar + detail page)

Decisions and their reasons live in **Revamp.md** (new, dated decision log for the page-by-page revamp).

### Built
- **Prod 500s (shipped to main, 5b66f07):** Vercel freeze/thaw left a Mongo connect in flight → unhandled rejection → runtime exit 128 → every concurrent request 500'd. `attachDatabasePool` + `maxIdleTimeMS`; duplicate schema indexes removed.
- **Search 500s:** `utils/regex.ts` escapes user search text everywhere (applications, companies, admin ×3).
- **Applications API:** single-round-trip aggregate (page + total + stageCounts + tabCounts), server filters (company/resume/source), `fields=summary`, `/filter-options`, new compound index.
- **Frontend:** TanStack Query layer; unified `/applications` shell with List (Classic | Table, dev toggle) · Board · Calendar; `/applications/:id` detail page; Popover/Menu/Tooltip/SegmentedControl/PageHeader primitives; app-wide scroll-to-top on forward navigation; page-shortcut rules (`usePageShortcuts`).
- Removed: Applications.tsx (860 lines), Kanban.tsx (745), detail sidebar, AI-analysis sidebar, ApplicationDetailBody, ApplicationsToolbar, useApplicationsListState, dead ApplicationStatusPanel.

### Verified (HOW) — local, demo account, 650 apps
- API: counts sum to 650; `stage=Interview` → 98 of 98; `search=C++` and `search=(` → 200 (were 500); hostile params ignored; company filter exact; payload −14% on JD-less demo data.
- Browser, driven: Classic + Table render (light + dark, 1320 + 1920 wide — 5 → 9 columns); Filters panel incl. nested Select keeps panel open, URL `?company=Adobe`, badge; Escape layering; optimistic stage change repaints in <17ms; row → detail (instant from cache), J → next ("22 of 650"), Escape → back with scroll restored to the pixel; Board pointer-drag Applied→Interview persisted (verified via API) and didn't trigger a click-open; card click → detail; Calendar embedded; `/kanban`, `/calendar`, `?stage=`, `?focus=`, `?new=1`, bad id all correct; shortcuts 1/2/f/c// and `g c` guard.
- Gates: backend `tsc`, frontend `tsc -b`, `npm run build` green. Main chunk 779 → 836 KB (TanStack Query + shell); Board 64 KB and detail 25 KB are lazy.
- Local demo data re-seeded after tests.
- NOT verified: keyboard drag on the Board (synthetic keys can't activate dnd-kit — pointer path verified instead); real-mouse drag feel; Export CSV download; production soak of the 500 fix.

### Sharp edges
- **React portals bubble events through the component tree.** A click inside a portaled menu reaches the row's onClick; rows guard with `e.currentTarget.contains(e.target)`.
- **A click whose target was unmounted mid-handler** (picking a Select option) looks like an outside click to document listeners — Popover ignores `!target.isConnected`.
- **Two `setSearchParams` calls in one tick lose one update** (react-router) — always patch filters in a single call.
- **Page listeners register before GlobalShortcuts'**, so page shortcuts see keys first; they must check `isShortcutSequencePending()`.
- `placeholderData` as a function confuses TanStack's type inference — pass the generic explicitly.
- The in-app browser pane throttles rAF/timers when hidden; time optimistic updates with `setTimeout` sampling, not rAF.

---

## 2026-09-23 — Prod outage after deploy (blank page) — fixed

- **Symptom:** blank page; `TypeError: reading 'split'` in Header. `/api/*` returned `index.html` (200, text/html).
- **Root cause:** `backend/vercel.json` rewrote `/api/(.*)` → `/api`, which chained into the SPA rule (`(?!api/…)` doesn't exclude bare `/api`) → `/index.html`. express.static served it `public, max-age=1y, immutable`, so the Vercel edge and browsers cached HTML as the API response; the client used the HTML string as the user. Config unchanged since April and fine on the 2026-07-09 deploy, so likely a Vercel-side routing change surfaced by the first deploy in 2.5 months (unconfirmed — build log would tell).
- **Fix (b754b93, 5651638):** vercel.json keeps only `installCommand` (Express routes everything itself); `/api` responses `no-store`; static `.html` never immutable; client sends `Cache-Control/Pragma: no-cache` so poisoned browser entries are bypassed; `getMe` rejects non-user payloads (signed-out fallback, not a crash).
- **Verified on prod:** `/`, `/applications` → HTML no-cache; `/api/*` → JSON no-store; bug-report POST 204; landing renders in a real browser.
- **Sharp edges:** never reintroduce Vercel rewrites for this app — any path rewrite reaches Express as the *rewritten* path. Browsers that opened a deep link (e.g. `/applications`) during the outage cached that document immutably and need one hard refresh.

---

## 2026-08-05 (third block) — Modal system rebuild + Applications stage-filter fix

### Decided (locked)

- **Applications page redesign is OFF the table** — owner will design it manually. Only genuine bugs get fixed there. (Proposal from earlier today is shelved.)
- **All dialogs build on `components/ui/Modal.tsx`** (Modal/ModalHeader/ModalBody/ModalFooter) with `ui/Button`, `ui/Field` (Field/Input/Textarea/TextField), `ui/Select`, `ui/DateInput`, `ui/Toggle`. No new bespoke overlays; no raw `<select>`/`<input type="date">` in product surfaces.
- Floating layers coordinate through `ui/layers.ts` — one stack for modals AND popovers, so Escape closes the top layer only (dropdown first, then dialog). Select/DateInput popovers **portal to `<body>` with fixed positioning** so they never fight a scrollable modal body; they close on outside scroll/resize.

### Built

- `ui/` primitives above (~700 LOC total). Modal: portal, scroll lock, focus trap + restore, `data-autofocus`, mousedown-tracked outside-click (drag-from-input can't dismiss), sizes sm–xl, overlay fade + panel scale (reduced-motion safe). DateInput: custom month-grid calendar, local YYYY-MM-DD contract (no Date-string parsing → no TZ shift), Today/Clear, full keyboard nav.
- Converted 8 dialogs: application form, deadline form, contact form, calendar quick-add, ConfirmModal, ResumeModal, settings report-rejection + delete-account. Native date inputs remain only in ImportExport + admin (listed in handoff).
- **Applications bug (was genuinely broken):** stage chips filtered and counted only the loaded 25-row page. Now server-side: GET /applications accepts `stage` and returns `stageCounts` (aggregate over the stage-less query). Chips show true totals (255/115/98/85/97 on demo), stage filter paginates correctly ("1–25 of 98"), tab counts derive from the stage-count sum so they stay stage-independent; stage change resets to page 1.

### Verified (HOW)

- Live: chips sum to 650; Interview filter → "Showing 1–25 of 98"; Active tab stays (650) under a stage filter. New application modal + deadline modal driven in browser, light + dark screenshots. Calendar portals above the modal (no inner scrollbar), Esc closes calendar → modal survives → second Esc closes modal. `tsc` both sides + `npm run build` green.
- NOT verified: real form submissions (demo user is write-gated); Contacts/Calendar/Resume modals converted but only typechecked + pattern-identical, not individually driven.

### Sharp edges

- Modal Escape uses a **capture-phase** document listener — any floating widget that handles its own Escape must register on `ui/layers.ts` or the dialog will close underneath it.
- Popovers inside `ModalBody` (overflow-y-auto) get clipped if positioned absolutely — always portal fixed-position popovers (see Select/DateInput pattern).
- `pagination.total` from GET /applications is the *stage-filtered* total; use the `stageCounts` sum when you need the tab-wide count.

---

## 2026-08-05 (later) — Theme trim, Settings area rebuild, sidebar notifications

### Decided (locked)

- **Applications page: density stays.** Owner compared with Jobright/Simplify — users want information-rich rows, not minimalist strips. The redesign goal is *ranked* density (one visual anchor per row), not less information. Proposal pending owner approval before any Applications work.
- Owner wants benchmark-grade consistency Sora-style: work **one main page at a time, in depth** (page + its modals, dropdowns, search).
- Settings is a **dedicated area with its own sidebar** (Back to HireTrail + grouped nav), one focused page per section. No more single-scroll.
- Theme registry trimmed to Light/Dark permanently; **System (follow-OS) option added** on the new Personalize page. First-run default stays Light.
- Settings content column: `max-w-4xl` — owner explicitly asked for fuller use of the page width after seeing `max-w-2xl`.

### Built

- `themes.ts` 3,042 → ~110 lines (legacy stored ids still resolve; 12 dark preset ids map to dark). Deleted dead `useThemeImport.ts`, frontend `proxyAPI`, backend `/api/proxy/tweakcn` route. Main chunk 862 KB → **779 KB**.
- `useTheme`: added `"system"` preference (matchMedia + live OS-change listener); header sun/moon still sets an explicit choice.
- New settings shell: `pages/Settings/SettingsLayout.tsx` (own sidebar, search that filters nav + Enter-navigates, Account/Integrations groups) with routes `/settings/{profile,personalize,clipboard,mailboxes,ai}`. Old `Settings.tsx` (1,225 lines) deleted; sections became focused pages sharing `pages/Settings/ui.tsx` (SettingsHeader/Section/Card/Row) and a new `components/ui/Toggle.tsx` (role="switch") — the first real `ui/` primitive.
- Profile Sync folded into AI & Models as a "Profile sync" card (it's an AI behavior; settings search alias covers the old name).
- Legacy links honored: `/settings` → profile; `/settings#clipboard` etc. → mapped section; `?gmail=/`?outlook=` params forwarded to Mailboxes (backend OAuth redirects also updated to `/settings/mailboxes?...`). Email review queue moved `/settings/email-review` → `/email-review` (redirect kept; all client links updated).
- Main sidebar: added **Notifications** under Overview (was only reachable via the bell dropdown footer).

### Verified (HOW)

- `tsc` green backend + frontend; `npm run build` green (chunk sizes recorded above).
- Live in browser: /settings redirect, all five section pages (light + dark), hash deep-link `/settings#clipboard` → `/settings/clipboard`, settings search ("api key" dims all but AI & Models, Enter lands on it), theme cards switch Light/Dark instantly, Back to HireTrail returns to Dashboard, sidebar Notifications entry present. Benchmark check passed on Profile/Personalize/Mailboxes/AI pages in both modes.
- NOT verified (needs real accounts/keys): Gmail OAuth roundtrip to `/settings/mailboxes?gmail=success`, scan flow end-to-end, AI key add. Demo user is write-gated, so toggles show the demo-gate prompt (expected).

### Sharp edges

- The in-app browser pane's screenshots garble when the page is scrolled while the pane is hidden (giant black void) — page was fine (verified via JS metrics); don't chase it as an app bug.
- `SettingsRow` control slot: fixed-width inputs + `shrink-0` overflowed the card at `max-w-2xl`; the row primitive now lets the control shrink (`min-w-0`, `sm:max-w-[55%]`).
- Vite dev picked up all changes via HMR, but `role="radio"` buttons showed unnamed in the a11y tree until explicit `aria-label` — content-based naming didn't surface for complex children.

## 2026-08-05 — Foundation session: full audit, design-system proposal, roadmap

### Decided (locked)

- **Scope for this effort: backend, frontend, database only.** No deployment, build-pipeline, or tooling setup (owner instruction mid-session). CI/lint gaps are documented but deliberately untouched.
- **Keep and extend the existing token system** (`App.css` HSL vars + Tailwind mapping) — do not replace it. The system is good; the problem is ~36% of color usage bypasses it.
- **One accent = the existing blue** (`--primary`, 217° 91% 60%). The hardcoded `#3b82f6`/`#1e3a8a` twins get folded into tokens.
- Roadmap phased P1→P4 below; each phase must leave production working.
- Owner-locked UI decisions (carried from earlier sessions): no dashboard "Today"/"attention" modules; AI indicator glow-pulse only (no spin/scale); notifications keep Current|Past + archive-on-dismiss.

### Audit summary (measured, not guessed — four parallel code sweeps + live walkthrough of every screen, light+dark+mobile, on seeded demo data)

**Strong foundation, inconsistent surface.** TS strict both sides, clean route/service split, well-indexed Mongo models, deliberate route-level code splitting, token system + 42-theme engine, react-hot-toast fully tokenized, good skeletons/empty states on main lists, legacy-shape handling patterns are genuinely good.

**Where it reads vibe-coded (worst first):**
1. **Stage colors defined 5 times with conflicting values** (`stageStyles.ts`, `chartSetup.ts`, `Companies.tsx`, `calendarEvents.ts`, `Landing/brand.tsx`) — same stage renders three different blues/greens depending on surface.
2. **No primitives where it counts:** 33 hand-rolled modal overlays (7 scrim styles, 9 z-indices, only 2 animate), 9 duplicate dropdown implementations, 16 native `<select>`, 20 default checkboxes, 9 native date inputs, zero Tooltip (226 raw `title=`), no Button/Input components (CSS classes only).
3. **Applications list is loud:** per-row dark "AI FIT" billboards, up to six labeled "None" fields per row, red age pills, colored edge bars — four color systems fighting on one screen.
4. **Nag banners are a pattern:** amber "306 applications inactive → Archive all", amber "219 stuck in Applied → Mark as Rejected", yellow "No AI key" toast — loud, stacking, permanent-feeling. Anti-calm.
5. **Typography:** 583 arbitrary `text-[Npx]` (23 distinct sizes incl. half-pixels) because the scale lacks steps between/below 12px; `--font-sans` declared but never defined.
6. **Shadows/radius ad-hoc:** no shadow tokens (13 arbitrary + 28 raw declarations, none theme-aware); `rounded-xl` (the de-facto card radius, 169 uses) not wired to `--radius`.
7. **Dashboard default widget layout has holes**; grid doesn't re-measure on window resize until reload.
8. **Dark-mode leaks** in-app: `AppFitPanel`, `PipelinePulse`, `EditorTab`, `BulkActionBar`, `Header` (raw palette, no `dark:`). Landing is light-only (accepted for now).
9. **Mobile:** usable but rough — giant centered logo tiles, clipped titles, "None" fields consume a full screen per card.

**Concrete bugs found (verified in code by sweep):**
- `MiniCalendarWidget.css` uses bare `var(--border)` etc. without `hsl()` — invalid CSS, widget silently renders unthemed (only file with this mistake).
- `hooks/useThemeImport.ts` — 240 dead lines targeting a `--ht-*` namespace that no longer exists.
- Applications stage-filter pill counts appear page-scoped (pills summed exactly to the 25 loaded rows vs 650 total) — **verify in code before fixing**.
- Mongoose duplicate-index warnings on `User.email` / `User.googleId` (declared twice).
- Perf: main chunk 862 KB — `themes.ts` (3,042 LOC, 40 unreachable themes) ships eagerly; two calendar libraries ship (~480 KB combined: react-big-calendar for Calendar page, FullCalendar just for the mini widget).

### Design-system foundation (proposal — build in P1)

Tokens (all in `App.css`, light + dark):
- **Stage tokens** `--stage-{drafting,applied,oa,interview,offer,rejected}` (+ soft bg/fg variants) as the single source of truth; migrate all five current definitions onto them.
- **Status trio** `--success/--warning/--danger`: delete the hex duplicates in `tailwind.config.js`, keep the HSL tokens.
- **Type scale:** add `text-2xs` (11px) and `text-3xs` (10px) to Tailwind; define `--font-sans` explicitly (system stack — the Apple-calm look we already have, made intentional); migrate arbitrary sizes opportunistically.
- **Shadow tokens** `--shadow-sm/md/lg` (foreground-alpha based, theme-aware — same recipe as the toast shadow in `main.tsx`).
- **Radius:** wire `rounded-xl/2xl` to `--radius` math so cards follow the token.
- **Motion tokens:** `--duration-fast:140ms`, `--duration-base:200ms`, `--ease-out: cubic-bezier(0.16,1,0.3,1)` (already the de-facto easing); add missing `prefers-reduced-motion` guards (Calendar.css, BackgroundTaskCenter.css, spinner).
- **Z-index scale:** dropdown 30 / sticky 40 / overlay 50 / modal 60 / toast 100 — kill the nine ad-hoc values.

Primitives (in a new `frontend/src/components/ui/`): `Modal` (scrim+blur+focus-trap+Esc+entrance, sizes) → migrate 33 overlays incrementally; `Button` (primary/secondary/ghost/danger × sm/md, loading) replacing `.btn-accent`/`.btn-secondary`; `Menu/Select` (portal + arrow-key nav, built on ActionDropdown's brain) → replace 9 bespoke dropdowns + 16 native selects; `Tooltip` (quiet, delayed) → replace `title=`; `Checkbox`, `Input`. **Deferred, honestly:** custom date picker (9 native date inputs stay native until P3 — a good date picker is a project of its own).

### Roadmap (each phase ships independently, production green throughout)

- **P1 — Foundation:** tokens above + `ui/` primitives + the two token bugs (MiniCalendarWidget.css, dead useThemeImport.ts) + stage-color unification. Perf slice: lazy-load `themes.ts`, drop FullCalendar from the mini widget (reimplement with plain grid — it's a month grid with dots).
- **P2 — Highest-traffic screens:** Applications list calm-down (hide empty fields, quiet AI-fit chip instead of billboard, one accent); Dashboard default layout without holes + resize re-measure; Kanban banner→quiet inline affordance + consistent column treatment; filter-count correctness.
- **P3 — Flows & interactions:** application detail drawer polish, ⌘K as a true centered command palette, quiet-confirm toasts + Undo sweep, empty/loading coverage (Kanban, JobSearch, Calendar), mobile card layout, date picker decision.
- **P4 — Polish pass:** motion tokens applied app-wide, keyboard shortcuts + focus-visible sweep, dark-mode leak fixes, admin pages brought onto primitives.

### Verified this session (HOW)

- Ran full stack locally: docker Mongo (`hiretrail_dev`), backend :5050 (boot log confirmed local DB), Vite :5175. Seeded demo dataset (650 apps) via `npm run seed`.
- Walked every user-facing screen in the browser (clicked, typed, screenshotted): Landing, auth modal, Dashboard, Applications (+detail drawer), Kanban, Calendar, Deadlines, Contacts, Companies, Resumes (+edit modal, More menu), Resume Studio (entry + wizard shell), Job Search, Notifications (page + bell), Settings, AI Providers, global ⌘K search; dark mode on Dashboard/Applications; mobile (375px) on Applications.
- Typecheck baseline green: `backend npx tsc --noEmit` exit 0; `frontend npx tsc -b` exit 0.
- Root-caused the dev-only `/api/auth/me` 500s → tsx watch restart race via Vite proxy (no source change involved; `git status` clean).

### Sharp edges (cost time today)

- Demo login 401s on a fresh local DB until `cd backend && npm run seed` (demo user isn't in `db:seed`).
- Resume Studio needs a primary resume (or an application context) before it renders the wizard.
- Header dropdowns' click-outside listens on `mousedown` — automation clicks race it; use DOM `.click()`.
- `tsx watch` can restart from stray fs events → transient 500s through the Vite proxy; check backend log before chasing.
- react-grid-layout dashboards initialized at one width don't re-measure on window resize until reload.
