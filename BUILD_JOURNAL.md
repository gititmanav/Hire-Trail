# BUILD_JOURNAL — dated single source of truth

Append a dated entry every session: decisions, what was built, what was verified and HOW, sharp edges. Locked decisions live here — do not re-litigate.

---

## 2026-10-05 (later) — Committed in slices; real brand logos; local accounts; gateway-era docs

Owner: commit stepwise and push; "use real company logos, not make-ups, everywhere"; a normal local user plus an admin, both `devpass123`; `ENCRYPTION_KEY` is set in Vercel.

### Built
- **History:** the toast system first (1f74771, built from HEAD so it stands alone), the AI revamp in 14 slices (c6fe98d … 74ee7e1), the map reset (000bf25) split out of the files it shares, docs (a0d4856). Pushed to `origin/master`.
- **Real logos** (`components/BrandLogo`): the brands' own SVGs inline (LobeHub AI icons, MIT; Gmail — Iconify logos; Outlook — Simple Icons), per-instance gradient ids, ink marks in `text-foreground`. `ProviderMark` draws through it (key picker, key lists, both maps, Admin); plus Connectors' Gmail tile, the review page's empty state, Admin Mailboxes pills, Claude Code connections + the assistant hub when Claude is the client, the landing's provider chips. The letter monograms are gone.
- **Local accounts:** `scripts/devSeed.ts` ensures `admin@hiretrail.local` (password = the dev user's; `--admin-only` resets just it). Local DB: `dev@hiretrail.local` set back to a normal user (data kept).
- **Gateway-era leftovers:** `AI_GATEWAY_API_KEY` and the four per-provider env keys removed from `env.ts` / `.env.example` (nothing read them); README, CONTRIBUTING, DEV_LOCAL rewritten to what ships.

### Verified (HOW)
- Gates: backend `tsc --noEmit` 0, `scripts/devSeed.ts` typechecked on its own (backend tsc doesn't include `scripts/`), frontend `tsc -b` 0, `npm run build` green. The toast commit's tree was exported and built in isolation (tsc + vite build).
- Browser: the Add-key provider grid (dark + light), Connectors (Gmail), the review empty state, the landing's AI vignette chips — all real marks. Both local logins return 200 (`POST /api/auth/login`); roles checked in mongosh.
- NOT verified: Admin Mailboxes pills (no connected mailbox locally), the map hubs with a real key (same `ProviderMark` as the picker), the assistant hub with a Claude client.

### Sharp edges
- **`components/BrandMark` is HireTrail's own logo** — a new brand-logo file there overwrote it once (restored from git). Brand logos live in `components/BrandLogo`.
- Splitting one working tree into commits: write each slice's index with `git hash-object -w` + `git update-index --cacheinfo` when a file has to land in two steps; export the index (`git checkout-index -a --prefix=…`, node_modules symlinked) to build a slice on its own.

---

## 2026-10-05 — AI revamp: one door, three lanes, MCP, Connectors, Admin; one toast; map reset

Owner: agreed to the whole blueprint (Revamp.md → "2026-10-05 — AI revamp", decisions 1–14). Later the same day: one stacked toast used everywhere, and "Reset to defaults" on the AI map (the default = what the admin set).

### Built
- **AI core** (`backend/src/services/ai/`): registry, direct adapters for Google, Anthropic, OpenAI, xAI, DeepSeek, Mistral, Groq and OpenRouter (the Vercel AI Gateway is gone), error codes + copy, pricing (OpenRouter catalog → curated → most expensive known), keys (`AiKey`, AES-GCM, tested on save), routes (`AiRoute`), policy (`AiSettings`), reserve-then-settle ledger (`AiUsage`), jobs (`AiJob`: lease, steps with a deadline, signed self-continuation, revive on read, `waiting_assistant`), the gateway (`runAiObject` / `runAiText`). Every AI call moved onto it; the old services and mock fallbacks deleted. Boot migrations copy legacy keys and the admin default key.
- **Features rebuilt**: posting read (cut by line ranges, never re-typed), fit check (one deterministic 0–10 score; the AI's read is words), resume import + profile merge (undo the last import), Studio rewrites as proposals (accept per change or all; numbers must be grounded), inbox sort (review queue only; the auto-apply pipeline removed; Outlook hidden).
- **My AI** (Settings → AI): the map (provider hub in the centre, features orbiting, drag to re-route), keys, allowance, the assistant connection; **Reset to defaults** (`DELETE /api/ai/features`, with Undo).
- **Admin → AI**: Map (platform keys), Rules (master switch, pause message, lanes, per-feature rules, MCP limits), Spend (budget, allowance, usage lens), per-user overrides.
- **MCP** (`/api/mcp`): stateless Streamable HTTP; `ht_mcp_` tokens (sha256, scoped, revocable); read / write / AI tools sharing the REST services; prompts (`do_my_ai_tasks`, `tailor_resume`, `weekly_review`).
- **Connectors** (Settings → Connectors): Gmail; OAuth state signed and bound to the session user. Legacy `/settings/mailboxes` redirects.
- **Admin revamp**: 8 sidebar pages + 2 unlinked pages removed, with their routes (Revamp.md list); Users rebuilt (no impersonation; GET /:id returns a fixed field list — it used to include refresh tokens), Dashboard rebuilt (zero-filled 30-day series, excludes demo + deleted), Settings = maintenance + 3 feature flags + Reset demo, Mailboxes = 30-day scan stats.
- **Account deletion**: reason + DELETE + password (or email) → 14 days → full purge of every user collection + Cloudinary files + Gmail revoke + sessions; any sign-in cancels. Privacy and Terms rewritten to match.
- **Extension 1.5.0**: the analyze/LLM/Auto Tags paths removed (the posting read does it server-side); `frontend/public/extension.zip` repacked.
- **One toast** (`components/ui/toast.ts` + `ui/Toaster.tsx`): our own stacked toaster — bottom-right, newest in front, older tucked behind and peeking, hover/focus fans out and pauses, swipe down to close, three at most; title + description + one action; default / success / warning / error / loading. react-hot-toast uninstalled; 60 files moved; the hand-built toasts (Undo, "Open AI settings", deadline follow-up, Dashboard tip) rewritten as plain ones.

### Verified (HOW)
- Gates: backend `tsc --noEmit` 0; frontend `tsc -b` 0; `npm run build` green; `node --test src/utils/theme.test.ts` 8/8.
- AI layer: mock-model e2e scripts (AI SDK `MockLanguageModelV3`, local DB, no real keys) — 32/32 (lanes, policy, budget holds, failed-parse billing, cache rule, jobs, continuation); deletion 8/8.
- MCP over curl against local: initialize, tools/list, whoami, list_applications, 401/405; add_application → an assistant task → start/finish with schema validation → match score 6.1; propose_resume_changes 2 proposed / 1 dropped (ungrounded number).
- Browser (in-app pane, `dev@hiretrail.local`): My AI light/dark/phone; Admin AI Map · Rules · Spend; Connectors; Applications fit section; Studio proposals accept; Admin Dashboard, Users, Settings. Toasts: each tone, a stack of three collapsed and fanned out, loading → success in place, Undo action, light mode, 375 px phone. Map reset: two choices made → Reset → all on the admin default → Undo → both back (checked via `GET /api/ai/me`).
- NOT verified: any real provider call (no real keys used); the Gmail OAuth round trip; MCP from a real Claude Code client; the toast swipe on a real touch screen; reduced-motion toasts; prod.

### Sharp edges
- **Feature ids contain dots** — Mongo `$set: { "features.resume.tailor": … }` nests the path. Feature rules are an array keyed by `feature`.
- **`model` is a Mongoose Document method** — the route field is `modelId`.
- Vite dev: importing a changed module by its bare URL from devtools loads a second instance — use the `?t=` URL from `performance.getEntriesByType("resource")` to reach the app's toast store.
- A ResizeObserver started in an effect dies under StrictMode's double mount — own it in a callback ref (the AI map, the toast cards).

---

## 2026-10-04 — Landing round 3: an audit, a font, and the moves between hero and footer

Owner: audit the landing by code and visuals, research the best sites, "apply your brains in between" (hero and footer stay); "if something you decided looks cheap now, rethink it". Approved all eight proposed moves, one shipped font, no signature (the MK monogram instead). Decisions: **Revamp.md → "Landing round 3"**.

### Built
- **Font** — Inter (variable: weights 400–700, optical sizes 14–32 = the display cut at headline sizes), Latin subset, self-hosted (`frontend/public/fonts/inter-landing.woff2`, 39.6 KB, + `Inter-LICENSE.txt`, SIL OFL), `@font-face` "Inter Landing" + an Arial fallback sized to Inter's metrics (no shift on swap). `index.html` preloads it for likely visitors on `/`, `/about`, `/privacy`, `/terms`. Product previews keep the app's system font (`.lp-window`, `.lp-device`, `.lp-vignettes`, `.lp-app`). Display tracking retuned for Inter (−0.045 → −0.032em, etc.).
- **Hero exit** — each hero line (`data-lp-line`) blurs, lifts and fades just before the rising window's top edge reaches it, lowest first (measured per line, relative to its resting gap). `.lp-rise` now fills `backwards` only so scroll styles can take the element after the entrance. Glass buttons lost their backdrop-filter (they sat inside fading copy). Hero gets `lg:pt-16`; the window's peek sits under the last line on short screens (630px was colliding with the header).
- **The dive → "the card becomes the page"** (`story/CardMorph.tsx`): the window recentres, opens Personalize (still light), the pointer/tap picks Dark, the Dark card's preview lifts (shadow, +8%) and grows by layout — never a zoom — across the white page until the page is black; the window falls back behind it. Same on phones. Header flips when the card passes under it.
- **Tailor streams** — the rewritten bullets stream in word by word (`StreamWords`, `dom.ts streamWords`), the old line fades first, the "changed" mark lands when a bullet is done; longer stretch per bullet.
- **⌘K** — two keycaps (`.lp-key`, lucide Command + "K") press as the word reaches the reading line; the search vignette types "stri" and its results arrive. The list starts half a step short so ⌘K arrives like the others. The vignettes are bigger on desktop (`zoom: 1.18`, owner).
- **Progress** — Tailor · Apply · Track hairlines under the window (desktop), three segments under the header (phones).
- **Theme wipe** — a picked look/swatch (and each tour step) spreads over the preview as a circle from the control that picked it (`.lp-wipe`, clip-path); drags repaint at once; the old 450 ms colour transitions are gone.
- **Light motif** — `engine/Sweep.tsx`: a soft sweep inks headings from a ghost, line after line (CSS `animation-timeline: view()` + a registered `--lp-sweep`; Firefox / reduced motion = plain ink). Driven from the scene on pinned stages: the founder sentence (replaces the word-by-word reveal; MK monogram avatar; pin 120 → 90svh) and "Ready when you are." The hero's beams return softly behind the closing (a second `HeroBeams`, paused off-screen/faded).
- **White chapter** — promise receipts in mono (`gmail.readonly`, `Mail.Read`; "10 services, each named"; `Settings → Profile → Delete account`; `MIT`, `gititmanav/Hire-Trail`), two-tone ledes (acts, theme, closing), balanced h2 wraps, keylines before Compare and FAQ, Compare rows rise in a stagger, still grain on the dark glows (`.lp-grain`).
- **Defects fixed** — theme preview's address bar said /resume-studio (BrowserBar takes `url`); the phone theme dock's header band failed after a fling (observer thresholds 0 and 1); act window margins balanced (right = copy's left, ≥56 px gap); the empty black above the footer (the footer is a hand-off now); hero facts contrast (white/45 → /55).
- **og:image** — a 1200×630 capture of the new hero (`frontend/public/og.jpg`, 103 KB); meta tags updated.

### Verified (HOW)
- Gates: frontend `tsc -b` 0; `npm run build` green (LandingPage 151.9 KB / 43.1 KB gzip, was 143.6 / 40.1; + the font); `node --test src/utils/theme.test.ts` 8/8; built CSS keeps `@property`, `animation-timeline`, `zoom`, `color-mix`; touched files scanned for unused imports.
- Visuals: the in-app pane was hidden, so frames came from **headless Chrome over the DevTools protocol** (a scratch script: viewport, scroll, settle 5 rAF, `Page.captureScreenshot`; contact sheets as HTML) at 1440×900, 1280×650, 1200×630 and 390×664 (mobile emulation, DPR 2): the hero → rise (no line over the window), streaming, the stepper, the dive sequence (8 frames, both sizes), the theme wipe mid-animation, ⌘K press + typing, the sweep mid-reveal, receipts, keylines, closing + beams, footer hand-off.
- NOT verified: real frame timing / feel in a visible browser; a real phone; Safari (the sweep runs on Safari 26+ timelines — not seen); Firefox (sweep falls back to plain ink — not seen); Windows/Android rendering of the font.

### Sharp edges
- **The hidden in-app pane** gives stale or black frames and stalls rAF. Headless Chrome (`--headless=new`, CDP over Node's built-in WebSocket) renders real frames; clip coordinates are page coordinates (add scrollY).
- **Never fade/blur an ancestor of a backdrop-filter element** — the hero's glass button was inside the fading copy; the glass buttons no longer use backdrop-filter.
- `.lp-rise` must not use a `forwards` fill on anything scroll code styles afterwards (CSS animations beat inline styles while they fill).
- Text on a pinned stage doesn't move through the viewport, so `animation-timeline: view()` can't drive it — use `<Sweep driven>` and set `--lp-sweep` from the scene.

---

## 2026-09-26 (later) — Table columns: reorderable dropdown

Owner: Columns should be a dropdown of checkboxes with a drag handle, reorderable, Table only. Details: **Revamp.md → "2026-09-26 (later) — Table columns"**.
- **Built:** `views/table/ColumnsMenu.tsx` (dnd-kit sortable rows, row = checkbox), `ui/Checkbox` (`CheckboxMark`), `columnOrder` + `tableColumns()` in `columns.ts` — the user's order is now the fit priority (slots at 560 / 700 / 860 … px), Reset restores it.
- **Verified:** real mouse drag Source → top reorders the table and persists; unchecking Fit frees its slot for Applied; Reset restores the default; Classic untouched. `tsc -b`, build green.
- **Sharp edge:** a width-driven table with user ordering needs position-based thresholds, not per-column ones — otherwise a column moved to the front still disappears first.

---

## 2026-09-26 — Calendar revamp: our own calendar, the libraries gone

Owner: plan approved with changes (records as a stage dot + company with an application hover card, no side panels, Day · Week · Month like Sora, the title opens a days/months/years mini calendar), then "start and finish everything". Mid-session owner reports: a Table row stayed highlighted after the pointer left; Settings' "Back to HireTrail" always went to the Dashboard. Decisions + details: **Revamp.md → "2026-09-26 — Calendar revamp"**.

### Built
- Backend: `GET /api/calendar` (+ `services/calendar/days.ts`, 3 indexes), `nextOccurrenceId` on a recurring completion, picked applied dates stored as UTC midnight, empty `applicationId` = standalone on update, rolling demo seed window.
- Frontend: `utils/dates.ts`, `utils/calendarGrid.ts` (+ tests), `ui/MonthGrid`, `ui/CalendarPicker`, `DateInput` on the picker, `views/calendar/*` (Month · Week · Day, hover card, deadline popover, day peek, title picker, pointer drag, optimistic mutations + Undo), shared Filters + Show options in Calendar view, fill-height shells, `pages/Admin/AdminCalendar`, `widgets/DashboardCalendarCard`, shared `DeadlineFormModal` + `DeadlineTypeIcon`, sliding `SegmentedControl`, one stage-colour source, day reads app-wide on `dayOf`, landing calendar vignette redrawn.
- Removed react-big-calendar, `@types/react-big-calendar`, six `@fullcalendar/*`, date-fns, `pages/Calendar/`, `calendarEvents.ts`, `calendarRbc.ts`, `MiniCalendarWidget.*`.
- Fixes: row highlight clears on pointer leave (`leaveRow`); "Back to HireTrail" returns to the last page (`utils/returnPath.ts`); Filters → Reset restores every filter (search + Status included) and the view's display options (`filtersChanged`, `resetAll`) — verified on Calendar (URL `?company=Stripe&status=archived&q=eng` + all Show chips off → clean URL, empty search, Active, chips on, Reset disabled again) and Table (grouping + hidden column restored).

### Verified (HOW)
- Gates: backend `tsc --noEmit` 0; frontend `tsc -b` 0; `npm run build` green. Tests: `dates.test.ts` + `calendarGrid.test.ts` 18/18 under Asia/Kolkata, America/Los_Angeles, Pacific/Auckland, America/Chicago, UTC (6-row invariant for every month 2024–2030 × every week start, rank order, overflow maths, ghost projection incl. Feb 29, drag rules, DST weeks); `theme.test.ts` 8/8; `*.test.mjs` 42/42. Touched files scanned for unused imports.
- **Bundle** (build output): calendar code 530.7 KB / 159 KB gzip (Calendar 253.8/80.2 + its CSS 37.6/6.7 + MiniCalendarWidget 228.7/68.4 + helpers) → **70.4 KB / 23 KB gzip** (CalendarView 44.7/12.9, DateInput incl. picker + MonthGrid 13.5/4.8, DashboardCalendarCard 5.3/2.0, data 3.2/1.4, dates 2.0/1.0, AdminCalendar 1.6/0.9). Main JS 331.0 → 331.5 KB; main CSS 149.4 → 154.3 KB (25.3 KB gzip).
- API (local, demo 650 apps): a month = 33 ms / 91 KB; `company=Stripe` narrows to Stripe; reversed range → 400.
- Browser, demo account (read) + `dev@hiretrail.local` (writes, on `dev.localhost` so the demo session stayed), 1280×820 unless noted: month fills the card (scrollHeight = clientHeight at 1280 and 1920); hover card (Stripe: role, stage + days, applied, resume, fit, 2 contacts, Open application); record click → `/applications/:id`, Escape → back to `?d=2026-08-01`; "N more" peek opens over its cell with all 7 rows; deadline popover (overdue text, 5 actions); title picker Sep 2026 → months → 2016–2027 → 2027 → Mar → 15 → calendar on March 2027; Week (7 columns, 65 chips) and Day (Overdue 21 pinned, row actions); scale toggle carries the anchor; hover ＋ → dialog prefilled Sep 29 → created (API: `2026-09-29T00:00:00.000Z`, repeat 7, linked) → chip + ghost on Oct 6; **real mouse drag** Sep 29 → Oct 1 persisted (API) with the ghost following to Oct 8, no popover opened; popover Reschedule → Oct 2 → Undo → Oct 1 (API); Esc mid-drag → preview on Oct 7 + target highlight, then back on Oct 1, nothing saved; applied date dragged onto a future day → not-allowed cursor, red tint, not saved; onto Sep 22 → saved as a picked day; Week-view drag Sep 23 → Sep 25 persisted; complete a recurring deadline → gone instantly, server spawned Oct 8, Undo reopened it and deleted the spawn (API); delete → ConfirmModal → gone (API); Edit → notes saved; keyboard ← → T W D M, `c` → New deadline today, `1` → List; three fast ← → June (built on the latest anchor); roving grid focus (one tab stop, arrows, PageDown pages to October, Enter on an empty day → New deadline); Filters → Company = Stripe narrows the calendar, Show → Applied off hides applied chips, both survive reload; `/calendar` → `/applications/calendar`; `/admin/calendar` with the Admin chip; Dashboard card (hover Tue Sep 22 lists its 8 items; paging makes exactly one `/api/calendar` request). Dark preset, a Custom theme (mid-tone red) and 375 px (dots-only month, Week hidden, tap → Day with week strip) screenshotted. Zero console errors in a fresh tab across Month → peek → popover → Week → Day → paging → picker. Row-highlight fix: hover → highlighted, pointer away → none, J/J still highlights row 1. Back-to-HireTrail: Board `?company=Adobe` → Settings → Back → `/applications/board?company=Adobe`.
- Dev test data cleaned up (deadlines deleted, the application's applied date restored to `2026-07-10T01:06:45.385Z`); the dev account's theme restored to Light. Local demo data re-seeded with the rolling window.
- NOT verified: drag feel and the paging slide with real frames (the pane is hidden — rAF and ResizeObserver callbacks don't run there, so the live re-measure on window resize was only proven by reload); real keyboard (synthetic key events); Safari/Firefox; a real reduced-motion browser (guarded in CSS/JS, reviewed); a real phone.

### Sharp edges
- **A hidden page gets no ResizeObserver callbacks** (they run in rendering steps) — in the hidden pane a resized calendar keeps its old slot count until reload. Not a product bug.
- **Stored dates are two kinds** — picked days (UTC midnight) and moments. `dayOf` / `dayIn` decide by "is it exactly UTC midnight?"; keep writing picked days as `YYYY-MM-DD` so they stay that way.
- React's `onPointerEnter` listens via `pointerover` — dispatching a native `pointerenter` in a test does nothing; drive hovers with a real pointer.
- Undo toasts last 6 s — scripted checks must click Undo in the same step as the action.
- `tsx watch` restarts on a backend edit and drops the in-memory dev session (the app lands on the landing) — sign back in.

---

## 2026-09-25 (late) — Dashboard filter menus

Details: **Revamp.md → "2026-09-25 (late) — Dashboard filter menus"** (5a08f5c).

- **Built:** `ui/Menu` pins header + search and scrolls only the items inside a 360px cap (`maxHeight`); Dashboard Company/Stage filters show per-item counts (`getCompanyCounts`); token focus ring on `.btn-secondary` / `.btn-accent`.
- **Fixed:** company filter + stage counts compared untrimmed names against the trimmed list.
- **Verified:** local demo account (650 apps, 51 companies) — capped panel, search "sp" → SpaceX/Spotify, Enter applies (17 apps); gates + theme tests green.
- **Sharp edge:** a Popover panel is `overflow-auto` — anything that must stay put (search, header) needs the panel as a flex column with only the list scrolling.

---

## 2026-09-25 (night) — Chapter hand-offs: no dead screens between chapters

Owner (on the master preview): after the FAQ the page "appears like it has ended" — a screen of plain white; after the dive and after "Your AI", a screen of black "longer than intuition expects"; and the theme chapter's spotlight showed a hard edge, "like a next page".

**Root cause:** a pinned chapter only starts when its section reaches the top of the screen, so the last screen of the chapter before it (a stage leaving in its final flat colour, or the next stage arriving empty) showed nothing. The spotlight was clipped by the theme section's top edge.

### Built
- **Hand-offs** (`Landing.css` `.lp-handoff`): the next chapter is pulled up over the previous one's final stretch (`--lp-overlap`) and is see-through there; its own background (`--lp-handoff-bg`) starts where the section before it ends. Theme overlaps the dive by 35svh (its title rises in as the page goes dark); Founder overlaps the word list by 80svh (it pins 20svh after the list lets go, so "Your AI" leaves with the page as the white comes over it); Closing overlaps the FAQ by 40svh (it darkens over the FAQ's last lines as they leave). Founder and Closing stages are transparent now and pass the pointer (`.lp-handoff-pass`); the founder link and the closing buttons opt back in as they appear.
- **Header tone in an overlap**: hand-off sections use three bands (`.lp-band-before/over/after`, from `--lp-flip` and `--lp-overlap`); the one inside the overlap is always the smallest under the header, so it wins over the previous chapter's band.
- **Theme spotlight + grid** in `.lp-theme-light`, masked in below the overlap — no lit edge along the section's top.

### Verified (HOW)
- Gates: frontend `tsc -b` 0; `npm run build` green.
- Desktop 1440×900, DOM reads at each scroll offset (the pane was hidden: screenshots stale, rAF swapped for a timer in the page for the test): dive end — night 0.63 at 60px before the pin ends with "Make it yours." already rising (y 840 → 780 at pin end → 480 300px later; before, it was off-screen at pin end); word list — "Your AI" lit on the line at the pin end, moves up 1:1, the white starts 180px later and is full by +333px, header flips at +250px (before: white started +900px); FAQ — the closing pins with the FAQ's bottom at 360px and its last question at 138px, dark 0.54 at +70 and 1 at +140, copy clickable from +140, the last FAQ question stays clickable until it's covered.
- Phone 390×664: geometry (title at 580/664 at the dive's end; founder pins 133px = 20svh after the list; closing pins with the FAQ's bottom at 266px = 40svh) and the header tone, recomputed with the engine's smallest-band rule from the real band rects (flips at the right offsets). The paint code is unchanged from the desktop run.
- NOT verified: a real visible browser frame of these hand-offs (hidden pane), a real phone.

---

## 2026-09-25 (evening) — The landing on phones and tablets

Owner: "some animations don't reciprocate in the same way on mobile … code dedicated to the mobile view." Decisions + details: **Revamp.md → "Phones and tablets"** under the landing entry.

### Built
- **`story/mobile/`** — below 1024px (`useCompactLanding`, `engine/hooks.ts` `useMedia`) the story is `MobileStory`, not the desktop scene shrunk: one pinned stage (100lvh; everything placed inside the top 100svh, measured by a probe), a 360×500 narrow browser window (`Device.tsx`) whose four screens are recomposed for the width (`screens.tsx`: Studio gauge/chips/resume, a posting with the extension's edge tab + panel, the Applications list with group strips + the inbox card + the moving Stripe row, Personalize light/dark), and a caption slot under it. The device follows the hero's words up 1:1 (tilted back) and docks under the header as black turns white; captions hand over one at a time; screens dissolve (the incoming over an opaque outgoing); a touch mark shows each tap; the dive into Dark is the desktop camera maths. Content first in the DOM (headline, then captions), the two layers share one grid cell. Sideways phones: captions beside the device.
- Shared: `engine/dom.ts` (boxWithin / collect / css / setText / setState / round), `story/HeroCopy.tsx`; the desktop screens export their constants/parts (MATCHED_BEFORE, Glyph, BookmarkIcon, MODES, CUSTOM_PREVIEW, ShellPreview). `StoryScene` is desktop-only now (its phone/tablet branches — window bleed, FOCUS pan, copy padding — removed).
- **Make it yours**: below 1024px the preview is the narrow Applications list (`MListPreview` + `MiniBar`), docked under the header while the controls scroll beneath (night band behind the header only while stuck); tablets put it beside the controls at full height. Section `overflow-hidden` → `overflow-clip` (hidden broke the sticky).
- **And everything else**: one scrubbed set of vignettes placed by `.lp-vignettes` (beside the words, or under them) — the phone copy was a React-state swap that popped in. Hand-off is now a dissolve on every screen size.
- **Compare**: stacked rows below 640px (feature over its three answers, HireTrail's lit); the table no longer needs a sideways scroll from 640px.
- **Header**: "Log in" on phones; the wordmark hides below 360px. **Browser tint** (`theme-color`) follows the chapter tone.
- **Sign-in sheet**: a bottom sheet below 640px (slides up/down, 22px top corners); inputs 16px so iOS doesn't zoom.
- **Founder / Closing** stages 100lvh (a white stage no longer shows a black strip once iOS tucks its toolbars; pins keep 120svh / 45svh); founder sign-off wraps cleanly; closing buttons full-width on phones; "Add to Chrome" only on screens ≥1024px (it can't be installed on phones/tablets).

### Verified (HOW)
- Gates: frontend `tsc -b` 0; `npm run build` green (LandingPage chunk 143.6 KB / 40.1 KB gzip); `node --test src/utils/theme.test.ts` 8/8. Touched files scanned for unused imports.
- Browser (dev, `landing.localhost:5175`), screenshots + DOM reads at **390×664** (an iPhone's real small viewport, not the 812 emulator height), **360×612** (Android after browser UI), **768×1024**, **844×390** (sideways), and **1440×900** (desktop regression): hero, rise → dock, every Tailor / Apply / Track step, the dive, the theme dock (stuck state toggles), the vignette dissolve, founder, compare, closing, footer, the sign-in sheet (animation names `auth-sheet-in/out`, 16px inputs, closes on Escape). Caption opacities sampled across a boundary: strictly one at a time with a ~20px gap.
- NOT verified: a real phone (toolbar collapse → the lvh/svh handling is reasoned, not seen), real frame timing (the pane stayed hidden), Safari/Firefox, a real reduced-motion browser (code paths reviewed).

### Sharp edges
- **`overflow: hidden` on an ancestor kills `position: sticky`** inside it — use `overflow: clip` to clip overhanging decoration.
- **Phones: a sticky stage of 100svh leaves a strip of whatever is behind it once the toolbars collapse** — make the stage 100lvh and place its content inside 100svh.
- Emulated 375×812 is optimistic: a real iPhone's small viewport is ~630–670px tall. Size phone compositions for that.
- The hidden in-app pane doesn't run `requestAnimationFrame` for `javascript_tool` promises — wait on timers when scripting scroll.

---

## 2026-09-25 (later) — The new landing, the sign-in sheet, dark public pages, a lighter first paint

Decisions + details: **Revamp.md → "2026-09-25 — Landing page, the sign-in sheet, About / Privacy / Terms"**.

### Built
- **Landing** (`pages/Landing/`): one pinned story (hero on WebGL beams → the product window rises as black turns white → Tailor · Apply · Track inside it → Settings → Personalize → dive into the Dark card), "Make it yours" (live theme engine), "And everything else" (spotlit word list + real vignettes), founder line → promises → comparison → FAQ on white, closing + footer on black. `Landing.css` = palette (`.lp`), type, buttons, spotlight, window, choreography CSS, reduced motion. `engine/scroll.ts` + `engine/hooks.ts` (scenes, tone under the header), `engine/Reveal.tsx`.
- **Beams** (`hero/beams.ts`, `HeroBeams.tsx`): WebGL2 port of the owner's three.js component.
- **Header**: same layout/motion; colours follow `data-lp-tone`; monochrome mark (`components/BrandMark`).
- **Sign-in sheet** (`components/AuthModal`): rebuilt on `ui/Modal` (`motion="soft"`, `className`/`overlayClassName` props added) with `ui/Field`/`ui/Button`, dark tokens on `.auth-surface`; soft entrance 380/520 ms, exit 260 ms (`MODAL_SOFT_EXIT`, `SOFT_EXIT_MS`).
- **Theme carry-over**: `utils/landingTheme.ts` (sessionStorage, intent = signing up); `hooks/useTheme.tsx` adopts it for an account without a theme.
- **Public pages** (`pages/Legal/`): `LegalLayout` (dark shell, auto contents rail with scroll-spy), `Legal.css`; Privacy/Terms restyled (wording unchanged), About rewritten as an editorial page; `hooks/usePageEntryScroll`.
- **First paint**: landing, public pages, the signed-in shell (Layout, AdminLayout, Dashboard, Applications, list, signed-in overlays) lazy; `LIKELY_SIGNED_IN` (theme boot cache) decides what to warm; visitors at "/" skip the session-check spinner; `index.html` pre-paints black for them (`lp-boot`); Sentry loads on demand.
- Shared: `utils/themeSwatches.ts` (Personalize + landing), `ColorPicker` `popoverClassName`.
- Removed: the old landing (12 files), ≈350 lines of dead `auth-*` CSS, the demo-button sheen.

### Verified (HOW)
- Gates: backend `tsc --noEmit` 0; frontend `tsc -b` 0; `npm run build` green; `node --test src/utils/theme.test.ts` 8/8.
- **Bundle** (build output): main JS 889.5 KB / 266.5 KB gzip → **331.0 KB / 111.1 KB gzip**; main CSS 189.5 / 30.3 → 147.1 / 24.0 KB gzip. Visitor = main + landing (112.7 / 33.2 KB gzip). Signed-in browsers load Layout + Dashboard + Applications + list chunks at 54 ms, before `/auth/me` (59 ms); visitors load no app-shell chunk (resource timing).
- **Beams parity**: the owner's component (three 0.186, R3F 8, drei 9) and the port side by side at 880×800 device px, same time and per-beam offsets: max |Δ| 1/255, mean 0.004–0.006, mean brightness 11.86 vs 11.87 and 21.18 vs 21.18.
- **Browser (dev, landing.localhost — its own cookie jar)**: every chapter screenshotted at desktop (1301×1025) and phone (375×812); the story's rise / acts / dive, theme tour and controls, word list, founder reveal, closing, footer. Header tone flips at each chapter; anchors land at the top / at `#subprocessors` (104 px under the header); a footer link from 16,008 px down opens Privacy at 0.
- **Sign-in sheet**: computed animations (overlay 0.38 s, panel 0.52 s + 40 ms; exit copy 0.26 s, removed after); demo login from the landing → app shell + Dashboard, browser tint restored.
- **Theme carry-over, end to end**: picked "Paper" → "Start with this theme" → sheet shows "Your theme comes with you" → created a throwaway local account (`landing-carryover-test@example.com`) → `/auth/me` returned the Paper theme, the app painted it, the stored pick was cleared → account deleted with the app's own `DELETE /auth/me` (200, then 401).
- Legal wording: a word diff of old vs new Privacy/Terms shows only the old page chrome changed.
- NOT verified: real frame timing (the in-app pane stayed hidden — rAF throttled, smooth scroll frozen); Safari/Firefox; a real reduced-motion browser (code paths reviewed, not driven); a real phone (emulation only); cold-start timing on Vercel.

### Sharp edges
- **Never style one property from both a Tailwind utility and Landing.css/Legal.css on the same element** — the files load in opposite orders in dev and in the build.
- **The in-app pane when hidden**: screenshots right after a reload/scroll can come back black, rAF-driven scenes lag, `behavior: "smooth"` never advances — read state with JS, not screenshots.
- Cookies are per host, not per port: use `landing.localhost:<port>` for a signed-out view without signing the main session out (Vite allows `*.localhost`).
- three.js ≥ r17x adds a direct-light multi-scattering term (`STANDARD` is defined for the extended ShaderMaterial); at roughness 0.3 it's ≈ 1.001 — the port leaves it out.
- The landing's pinned sections are height-driven (`--lp-*` in Landing.css): tone bands (`data-lp-tone`) in pinned sections are sized to the same numbers — change them together.

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
