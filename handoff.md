# handoff.md — for the next session

_Last updated: 2026-10-05 — the AI revamp (AI layer, My AI, Admin AI, MCP, Connectors, admin cleanup, account deletion, extension 1.5.0), one toast system, and AI map "Reset to defaults" — on `master`, pushed._

## Current state

- **On `main` (deployed):** the prod-500 fix (5b66f07). Nothing from the revamp is on prod.
- **On `master` (pushed to `origin/master`, not merged to `main`):** the Applications revamp, the card shell / dropdowns / motion, Personalize + Custom themes, the charcoal default, the new landing, the sign-in sheet, the dark public pages, the first-paint split (BUILD_JOURNAL "2026-09-25 (later)"), the phone/tablet landing (BUILD_JOURNAL "2026-09-25 (evening)"), and the chapter hand-offs (BUILD_JOURNAL "2026-09-25 (night)").
- **Decision log:** `Revamp.md` — "2026-09-25 — Landing page, the sign-in sheet, About / Privacy / Terms" (+ "Noted, not changed" and "Parked — decide at the end").
- **On `master` (pushed, 2026-09-26):** the Calendar revamp, the row-highlight fix, the Back-to-HireTrail fix and the full Filters Reset — BUILD_JOURNAL "2026-09-26", Revamp.md "2026-09-26 — Calendar revamp".
- **Also on `master`:** long menus scroll inside a 360px panel with the search pinned (shared `ui/Menu`); Dashboard Company/Stage filters show counts (5a08f5c — Revamp.md "2026-09-25 (late) — Dashboard filter menus").
- **Also on `master` (pushed):** landing round 3 — BUILD_JOURNAL "2026-10-04", Revamp.md "2026-10-04 — Landing round 3".
- **On `master` (pushed, 2026-10-05):** the toast system (1f74771), the AI revamp in 14 slices (c6fe98d … 74ee7e1: AI core, endpoints, features, inbox, MCP, account deletion, admin API, boot wiring, My AI, Admin, Connectors, the app's AI surfaces, deletion + legal + landing, extension 1.5.0) and the map reset (000bf25), then the local seed accounts (f44679d), real brand logos (1584394) and the gateway-era env/README cleanup (237e101) — BUILD_JOURNAL "2026-10-05", Revamp.md "2026-10-05 — AI revamp" (Built / Added). The slices were split from one working tree: the tip builds; the commits in between aren't each guaranteed to (the toast commit was checked on its own and does).

## Ship blockers — land these before `master` goes to `main`

1. **JSON export** — the landing (FAQ, "And everything else" → Import, the Import vignette) says "CSV or JSON". Export is CSV only (applications, contacts) on `/import-export`, and since the admin cleanup removed Backups, JSON exists nowhere. Build a user-facing JSON export or change the copy.
2. ~~"40+ AI providers"~~ — done 2026-10-05: the landing says 8 providers + your assistant, which is what `services/ai/providers.ts` ships.
3. ~~Account deletion removes everything~~ — done 2026-10-05: `services/account/deletion.ts purgeUser` erases every user collection, Cloudinary files, revokes Gmail, ends sessions (Outlook is hidden; its tokens are cleared).

## Before the AI revamp goes to prod (owner)

- ~~`ENCRYPTION_KEY`~~ — set in Vercel's env (owner, 2026-10-05). Never change it without re-encrypting: AI keys and Gmail tokens are AES-GCM under it.
- **Vercel plan + function duration** — job steps budget min(200 s, 70% of `FUNCTION_MAX_DURATION_S`); the default assumes 300 s (Hobby with Fluid compute). If prod allows less, set `FUNCTION_MAX_DURATION_S`.
- **`API_PUBLIC_URL`** — the public origin of the API, for job self-continuation (falls back to the `GOOGLE_CALLBACK_URL` origin). No cron is needed: due deletions and stuck jobs are swept at boot, hourly on `/auth/me`, and on status reads.
- **Add a platform key in Admin → AI → Map** after deploy (the boot migration copies the old admin default key if one exists — check it shows up and passes its health check). Included AI does nothing without one.
- **Extension 1.5.0** — `frontend/public/extension.zip` is repacked; publish it on the Chrome Web Store.
- Press **Admin → Settings → Reset demo** after deploy (was "Run seed") so the demo account gets the rolling window.
- `docker-compose.yml`'s `full` profile still passes `AI_GATEWAY_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` (no longer read — harmless; tooling, left for you).

## Immediate next step

0. **Owner hand-check of the calendar** in a visible browser (the pane was hidden, so no real frames were seen): drag a deadline between days in Month and Week (feel, the grab cursor, the target tint), the paging slide (‹ › and ← →), the day peek opening over its cell, hover cards, the title's mini calendar (days → months → years), real keyboard shortcuts (← → T D W M, `c`, and arrows/PageUp/PageDown/Enter inside the grid), and a window resize re-measuring how many chips fit.

1. **Owner hand-check in a visible browser and on a real phone** (the in-app pane stayed hidden, so real frame timing was never seen; phones were emulated): scroll the whole landing on a laptop and on an iPhone + an Android — the story (rise → dock, the three beats, the dive), the theme dock, the word list, the sign-in bottom sheet; scroll far enough for Safari's toolbars to tuck away (no strip under a white chapter); rotate the phone once. Safari + Firefox. Reduced motion should keep the fades and drop every move.
2. **Landing round 3 in a real browser** — Chrome, Safari 26+ (the headings' sweep runs on scroll timelines), Firefox (sweep falls back to plain ink), Windows/Android (the Inter font); the dive (pick Dark → lift → grow), ⌘K, the theme wipe, the founder sweep, the closing beams, and the footer rising over the last ask. Frames so far came from headless Chrome only. If the share image needs refreshing after copy changes, `frontend/public/og.jpg` is a 1200×630 capture of the hero.
3. **Terms** still names `hiretrail.vercel.app` (`pages/Legal/Terms.tsx` §1) — swap in the live domain when you confirm it. (Privacy was rewritten with the AI revamp.)
4. Earlier owner calls still open: Dark mirrors charcoal (keep?), "Table" vs "Minimal", tag chips 4.2:1, white on `bg-amber-600` 3.2:1 (Revamp.md → "Noted, not changed").
5. Queued engineering: the six hand-rolled switches → `ui/Toggle`; the other hand-rolled overlays → `ui/Modal`; `GET /deadlines` status tabs need the viewer's zone (a picked day counts as overdue from 00:00 UTC on its due day — with the Deadlines revamp); analytics bucket applied dates with Date math (Dashboard revamp); drop the old `{userId, completed}` Deadline index in Atlas; `FeedbackModal` hand-rolls a `fixed inset-0` overlay (→ `ui/Modal`); the Classic application card clips its left edge at phone width (seen at 375 px, 2026-10-05).

## How the landing works (short)

- `pages/Landing/LandingPage.tsx` assembles the chapters and owns the sign-in sheet + demo login. Palette/type/choreography CSS = `Landing.css` under `.lp` (not the app theme).
- Scroll-driven motion = `engine/scroll.ts` (`useScene(ref, "pin" | "view", fn, stageRef)`): one listener, geometry measured on resize, callbacks write styles directly. Header colours come from `data-lp-tone` bands.
- Pinned lengths are CSS (`--lp-hero/gap/act/zoom`, `.lp-everything`, `.lp-founder`, `.lp-closing`) and the tone bands inside pinned sections are sized from the same numbers — change them together.
- **Hand-offs** (`.lp-handoff`, `--lp-overlap`): Theme, Founder and Closing are pulled up over the end of the chapter before them and are see-through there. Founder's 80svh assumes the word list's stage is 100svh; Closing's 40svh assumes the FAQ ends in 16vh of padding — change them together. Their tone bands are `.lp-band-before/over/after`.
- The story's window (`story/`) is a 1200×760 replica built from the app's own tokens and parts; if the real Board / Studio / extension / Personalize markup changes, update the replica — **and the phone one** (`story/mobile/screens.tsx`, 360-wide; below 1024px `LandingPage` renders `MobileStory` instead of `StoryScene`, and the theme scene uses its list as the preview).
- Beams = `hero/beams.ts` (a pixel-matched port of the owner's three.js component — keep the maths as is). A second instance runs behind the closing ask.
- **Round 3 pieces:** the font (`public/fonts/inter-landing.woff2`, "Inter Landing" in Landing.css; previews keep the system font); `story/CardMorph.tsx` (the dive's end, both stories); `engine/Sweep.tsx` (headings on `view()` timelines; `driven` on pinned stages); `dom.ts streamWords` (Tailor); the theme wipe (`ThemeScene` `paint`, `.lp-wipe`); the ⌘K keys (`.lp-key`) and the search's `data-lp="query"/"result"`; promise receipts — keep them true to the code (scopes in `gmailService.ts`/`outlookService.ts`, services in `Privacy.tsx`, Settings → Profile, LICENSE).
- Visitors: `App.tsx` `LIKELY_SIGNED_IN` (the theme boot cache) → no app shell, no session-check spinner at "/". Don't import the signed-in shell eagerly again.

## How the calendar works (short)

- `GET /api/calendar?from&to&tz&<filters>` (`backend/src/services/calendar/buildCalendar.ts`) returns the range's events + all open overdue deadlines + recurring sources + a summary per application (hover card). Day rule on both sides: exactly UTC midnight = a picked day (its UTC date), anything else = a moment (the viewer's local day) — `services/calendar/days.ts` / `frontend/src/utils/dates.ts` `dayOf`.
- `frontend/src/utils/calendarGrid.ts` is the pure engine (tested: `TZ=… node --test src/utils/dates.test.ts src/utils/calendarGrid.test.ts`). UI in `pages/Applications/views/calendar/`: `CalendarView` (scale, URL anchor `?d=`, data, drag, popovers), `MonthView` / `WeekView` / `DayView`, `parts.tsx` (chip + hover card), `DeadlinePopover`, `DayPeek`, `TitlePicker`, `useCalendarDrag`, `data.ts` (queries + optimistic mutations with Undo).
- Shared: `ui/MonthGrid` (every month grid), `ui/CalendarPicker` (DateInput + the title picker), `components/DeadlineFormModal`, `widgets/DashboardCalendarCard`.

## How the AI layer works (short)

- One door: `services/ai/gateway.ts` `runAiObject` / `runAiText` — lane (`routing.ts decideLane`) → route + key → cache (public posting reads only) → budget hold (`ledger.ts`) → the provider adapter with a deadline → settle → key health. Features live in `services/ai/features/`, each registered in `registry.ts`.
- Long work = an AI job (`jobs.ts`): `registerJobHandler(kind, …)`, steps that save state and continue themselves, revived on status reads; assistant-lane jobs wait for the person's MCP client (`waiting_assistant`).
- Policy = `AiSettings` (Admin → AI → Rules); a person's choices = their `AiRoute`s (Settings → AI; "Reset to defaults" deletes them). Copy for every refusal = `errors.ts`; the client acts on `code`.
- MCP = `routes/mcp.ts` + `services/mcp/server.ts`; tokens in Settings → AI → Your assistant.
- Test with the mock model (`MockLanguageModelV3`) on the local DB — never real keys.

## Toasts (short)

- `components/ui/toast.ts` is the API and the store (timers, ids, the three-toast limit); `ui/Toaster.tsx` draws the stack; CSS under "Toasts" in `App.css`. Words only: title, optional description, one action. `toastWithUndo` for reversible changes.

## How the theme works (short)

- Presets live only in `App.css` (`:root` / `.dark`; `.theme-light` / `.theme-dark` for previews). Palette classes read `--palette-*` (Tailwind's exact values).
- Custom = `utils/theme.ts` `generateTheme(custom)` → inline tokens on `<html>` via `utils/themeDom.ts` `paintTheme` (the only painter). `text-primary` reads `--brand-text`.
- State: `hooks/useTheme.tsx` — `ThemeContext` (dark, mode, revision) and `ThemeControlsContext` (Personalize). Charts re-read on `revision`. A landing pick (`utils/landingTheme.ts`) is adopted once by a new account without a theme.
- Run the proof after touching the engine: `cd frontend && node --test src/utils/theme.test.ts`.

## Still open from earlier sessions

- Gmail OAuth roundtrip on prod should land on `/settings/connectors?gmail=success`.
- Create/edit a real application, deadline, and contact end-to-end on prod.
- The old `{userId, archived}` index still exists in Atlas — drop it manually.
- Prod soak for the 500 fix; Board drag with a real mouse; Export CSV; real account with JDs.
- Parked (Revamp.md): the "auto-archiving in 7 days" promise; the nightly inbox scan that probably never runs on Vercel (the landing avoids promising it).
