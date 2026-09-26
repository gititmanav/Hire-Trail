# handoff.md — for the next session

_Last updated: 2026-09-26 — Calendar revamp (our own calendar; react-big-calendar + FullCalendar + date-fns removed); fixes for the sticky row highlight and Settings' Back button_

## Current state

- **On `main` (deployed):** the prod-500 fix (5b66f07). Nothing from the revamp is on prod.
- **On `master` (pushed to `origin/master`, not merged to `main`):** the Applications revamp, the card shell / dropdowns / motion, Personalize + Custom themes, the charcoal default, the new landing, the sign-in sheet, the dark public pages, the first-paint split (BUILD_JOURNAL "2026-09-25 (later)"), the phone/tablet landing (BUILD_JOURNAL "2026-09-25 (evening)"), and the chapter hand-offs (BUILD_JOURNAL "2026-09-25 (night)").
- **Decision log:** `Revamp.md` — "2026-09-25 — Landing page, the sign-in sheet, About / Privacy / Terms" (+ "Noted, not changed" and "Parked — decide at the end").
- **On `master` (pushed, 2026-09-26):** the Calendar revamp, the row-highlight fix, the Back-to-HireTrail fix and the full Filters Reset — BUILD_JOURNAL "2026-09-26", Revamp.md "2026-09-26 — Calendar revamp".
- **Also on `master`:** long menus scroll inside a 360px panel with the search pinned (shared `ui/Menu`); Dashboard Company/Stage filters show counts (5a08f5c — Revamp.md "2026-09-25 (late) — Dashboard filter menus").

## Ship blockers — land these before `master` goes to `main`

The landing makes three claims by owner decision; the owner is building what backs them. Until they land, the page over-promises:

1. **JSON export** — the landing (FAQ, "And everything else" → Import, the Import vignette) says "CSV or JSON". Today export is CSV only (applications, contacts) on `/import-export`; JSON exists only in Admin backups.
2. **"40+ AI providers"** — hero facts row, the comparison table, "Your AI". The built-in BYOK catalog has 11 providers (`backend/src/models/AIProviderConfig.ts`, `services/ai/catalog.ts`); the gateway's public model list has 38 model makers today. Also confirm BYOK works in prod (it needed paid gateway credits in July).
3. **Account deletion removes everything** — promises ("Gone when you say"), FAQ, Privacy §7. `DELETE /auth/me` (`backend/src/routes/auth.ts` ~492) skips `AIProviderConfig` (encrypted keys), `ResumeDocument`, `EmailScanJob` / `EmailScanCandidate` (sender, subject, snippet), `AiUsage`, and Cloudinary resume files; Outlook tokens are cleared in our DB but not revoked at Microsoft (the Graph scopes we hold can't revoke).

## Immediate next step

0. **Owner hand-check of the calendar** in a visible browser (the pane was hidden, so no real frames were seen): drag a deadline between days in Month and Week (feel, the grab cursor, the target tint), the paging slide (‹ › and ← →), the day peek opening over its cell, hover cards, the title's mini calendar (days → months → years), real keyboard shortcuts (← → T D W M, `c`, and arrows/PageUp/PageDown/Enter inside the grid), and a window resize re-measuring how many chips fit.

1. **Owner hand-check in a visible browser and on a real phone** (the in-app pane stayed hidden, so real frame timing was never seen; phones were emulated): scroll the whole landing on a laptop and on an iPhone + an Android — the story (rise → dock, the three beats, the dive), the theme dock, the word list, the sign-in bottom sheet; scroll far enough for Safari's toolbars to tuck away (no strip under a white chapter); rotate the phone once. Safari + Firefox. Reduced motion should keep the fades and drop every move.
2. **og:image** — still `Dashboard.png` (old UI). Needs a 1200×630 image of the new page (`frontend/public`, `index.html`).
3. **Privacy / Terms facts** (wording untouched — owner's text): `hiretrail.vercel.app` → the live domain; the Outlook revocation claim; "all associated data" (ship blocker 3).
4. Earlier owner calls still open: Dark mirrors charcoal (keep?), "Table" vs "Minimal", tag chips 4.2:1, white on `bg-amber-600` 3.2:1 (Revamp.md → "Noted, not changed").
5. Queued engineering: the six hand-rolled switches → `ui/Toggle`; the other hand-rolled overlays → `ui/Modal`; `GET /deadlines` status tabs need the viewer's zone (a picked day counts as overdue from 00:00 UTC on its due day — with the Deadlines revamp); analytics bucket applied dates with Date math (Dashboard revamp); drop the old `{userId, completed}` Deadline index in Atlas; press Admin → "Run seed" on prod after deploy so the demo gets the rolling window.

## How the landing works (short)

- `pages/Landing/LandingPage.tsx` assembles the chapters and owns the sign-in sheet + demo login. Palette/type/choreography CSS = `Landing.css` under `.lp` (not the app theme).
- Scroll-driven motion = `engine/scroll.ts` (`useScene(ref, "pin" | "view", fn, stageRef)`): one listener, geometry measured on resize, callbacks write styles directly. Header colours come from `data-lp-tone` bands.
- Pinned lengths are CSS (`--lp-hero/gap/act/zoom`, `.lp-everything`, `.lp-founder`, `.lp-closing`) and the tone bands inside pinned sections are sized from the same numbers — change them together.
- **Hand-offs** (`.lp-handoff`, `--lp-overlap`): Theme, Founder and Closing are pulled up over the end of the chapter before them and are see-through there. Founder's 80svh assumes the word list's stage is 100svh; Closing's 40svh assumes the FAQ ends in 16vh of padding — change them together. Their tone bands are `.lp-band-before/over/after`.
- The story's window (`story/`) is a 1200×760 replica built from the app's own tokens and parts; if the real Board / Studio / extension / Personalize markup changes, update the replica — **and the phone one** (`story/mobile/screens.tsx`, 360-wide; below 1024px `LandingPage` renders `MobileStory` instead of `StoryScene`, and the theme scene uses its list as the preview).
- Beams = `hero/beams.ts` (a pixel-matched port of the owner's three.js component — keep the maths as is).
- Visitors: `App.tsx` `LIKELY_SIGNED_IN` (the theme boot cache) → no app shell, no session-check spinner at "/". Don't import the signed-in shell eagerly again.

## How the calendar works (short)

- `GET /api/calendar?from&to&tz&<filters>` (`backend/src/services/calendar/buildCalendar.ts`) returns the range's events + all open overdue deadlines + recurring sources + a summary per application (hover card). Day rule on both sides: exactly UTC midnight = a picked day (its UTC date), anything else = a moment (the viewer's local day) — `services/calendar/days.ts` / `frontend/src/utils/dates.ts` `dayOf`.
- `frontend/src/utils/calendarGrid.ts` is the pure engine (tested: `TZ=… node --test src/utils/dates.test.ts src/utils/calendarGrid.test.ts`). UI in `pages/Applications/views/calendar/`: `CalendarView` (scale, URL anchor `?d=`, data, drag, popovers), `MonthView` / `WeekView` / `DayView`, `parts.tsx` (chip + hover card), `DeadlinePopover`, `DayPeek`, `TitlePicker`, `useCalendarDrag`, `data.ts` (queries + optimistic mutations with Undo).
- Shared: `ui/MonthGrid` (every month grid), `ui/CalendarPicker` (DateInput + the title picker), `components/DeadlineFormModal`, `widgets/DashboardCalendarCard`.

## How the theme works (short)

- Presets live only in `App.css` (`:root` / `.dark`; `.theme-light` / `.theme-dark` for previews). Palette classes read `--palette-*` (Tailwind's exact values).
- Custom = `utils/theme.ts` `generateTheme(custom)` → inline tokens on `<html>` via `utils/themeDom.ts` `paintTheme` (the only painter). `text-primary` reads `--brand-text`.
- State: `hooks/useTheme.tsx` — `ThemeContext` (dark, mode, revision) and `ThemeControlsContext` (Personalize). Charts re-read on `revision`. A landing pick (`utils/landingTheme.ts`) is adopted once by a new account without a theme.
- Run the proof after touching the engine: `cd frontend && node --test src/utils/theme.test.ts`.

## Still open from earlier sessions

- Gmail OAuth roundtrip on prod should land on `/settings/mailboxes?gmail=success`.
- Create/edit a real application, deadline, and contact end-to-end on prod.
- The old `{userId, archived}` index still exists in Atlas — drop it manually.
- Prod soak for the 500 fix; Board drag with a real mouse; Export CSV; real account with JDs.
- Parked (Revamp.md): the "auto-archiving in 7 days" promise; the nightly inbox scan that probably never runs on Vercel (the landing avoids promising it).
