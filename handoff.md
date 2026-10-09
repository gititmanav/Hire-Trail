# handoff.md — for the next session

_Last updated: 2026-10-08 (night) — the Applications redesign (Ledger · Trail · Desk, Sweep, the Board, the audit's bugs), **uncommitted** on `master`'s working tree. Before that: Admin hardening + Admin's search (local, not pushed), one page header everywhere, the assistant connect card._

## Current state

**On `master`, pushed — 2026-10-08 (night), the Applications redesign** (232a906 … 6d2e7c4; per-slice typechecks not run, the tip passed every gate) (BUILD_JOURNAL "2026-10-08 (night)", Revamp.md "2026-10-08 — Applications: Ledger · Trail · Desk"). Gates green at the end of the session (backend `tsc --noEmit`, frontend `tsc -b` + build, focus/dates/calendarGrid 24/24 in four zones, theme 8/8). Check first:
1. ~~Commit in slices~~ — done: backend (batch / insights / sweep endpoints, company-link fix, calendar search, indexes, analytics route removed) → the model + shared parts (`focus.ts`, queries, RowBits, NextStep, TrailLine, detail) → Ledger → Trail → Desk → Board + Sweep → shell bits (fillHeight, Popover tooltip, PageSearch on phones) → docs. The admin session's doc edits (BUILD_JOURNAL / Revamp / handoff) sit in the same files — commit them with their own slice. **Restore `.claude/launch.json`** first (`git checkout -- .claude/launch.json` — it carries temporary `backend-5051` / `frontend-5051` entries). `design/applications-redesign.html` is the concept doc, untracked — keep or delete.
2. **Atlas, after deploy, by hand:** drop `userId_1`, `stage_1`, `source_1`, `companyId_1`, `tailorSessionId_1`, and the old `userId_1_archived_1_createdAt_-1` once `{userId, archived, createdAt, _id}` has built.
3. **The landing's replicas** still show the old Board card and phone list (`pages/Landing/story/BoardScreen.tsx`, `story/mobile/screens.tsx`) — update before `master` → `main`.
4. **Owner hand-check in a visible browser** (headless frames only so far): the peek sliding out of its row, the Desk tab gliding on J/K, Expand ⇄ Shrink + Back, Trail zooms, Sweep keys + ⌘Z, the Board's Rejected rail; Safari + Firefox (view transitions, `color-mix`); a real phone (Trail, phone headers); reduced motion.
5. **Owner call:** the detail's Next step card and the rail's Deadlines both show the top deadline — keep, or have the rail skip it.

- **On `main` (deployed):** the prod-500 fix (5b66f07). Nothing from the revamp is on prod.
- **On `master` (pushed to `origin/master`, not merged to `main`):** the Applications revamp, the card shell / dropdowns / motion, Personalize + Custom themes, the charcoal default, the new landing, the sign-in sheet, the dark public pages, the first-paint split (BUILD_JOURNAL "2026-09-25 (later)"), the phone/tablet landing (BUILD_JOURNAL "2026-09-25 (evening)"), and the chapter hand-offs (BUILD_JOURNAL "2026-09-25 (night)").
- **Decision log:** `Revamp.md` — "2026-09-25 — Landing page, the sign-in sheet, About / Privacy / Terms" (+ "Noted, not changed" and "Parked — decide at the end").
- **On `master` (pushed, 2026-09-26):** the Calendar revamp, the row-highlight fix, the Back-to-HireTrail fix and the full Filters Reset — BUILD_JOURNAL "2026-09-26", Revamp.md "2026-09-26 — Calendar revamp".
- **Also on `master`:** long menus scroll inside a 360px panel with the search pinned (shared `ui/Menu`); Dashboard Company/Stage filters show counts (5a08f5c — Revamp.md "2026-09-25 (late) — Dashboard filter menus").
- **Also on `master` (pushed):** landing round 3 — BUILD_JOURNAL "2026-10-04", Revamp.md "2026-10-04 — Landing round 3".
- **On `master` (pushed, 2026-10-05):** the toast system (1f74771), the AI revamp in 14 slices (c6fe98d … 74ee7e1: AI core, endpoints, features, inbox, MCP, account deletion, admin API, boot wiring, My AI, Admin, Connectors, the app's AI surfaces, deletion + legal + landing, extension 1.5.0) and the map reset (000bf25), then the local seed accounts (f44679d), real brand logos (1584394) and the gateway-era env/README cleanup (237e101) — BUILD_JOURNAL "2026-10-05", Revamp.md "2026-10-05 — AI revamp" (Built / Added). The slices were split from one working tree: the tip builds; the commits in between aren't each guaranteed to (the toast commit was checked on its own and does).

**Seeing the revamp locally:** the dev SPA runs on **http://localhost:5175** (`cd frontend && npx vite --port 5175 --strictPort`; the README's :5173 is Vite's default and is usually not running), the API on :5050 (it also serves the last `npm run build`). Production still runs `main` — nothing from the revamp is deployed there. Local logins: `dev@hiretrail.local` (user) / `admin@hiretrail.local` (admin), both `devpass123`.

**On `master` (pushed, 2026-10-06), in 12 slices (caf6f87 … the docs commit):** Classic rows by container width (caf6f87), Connectors everywhere (7132c63), AI map edges (3c0f9bb), quick-link preferences (c4a1f20), the header search + the bell's retirement (a2022b7), the radius scale (d8110b7 — owner's keep / go further / revert still open), plain dialog fields + modal motion (8220f26), every dialog on `ui/Modal` (cc0be35), the scan-wizard fixes (49218ea), `ui/Drawer` (cfc64fd), the tailor-drawer re-init fix (b98866d) — BUILD_JOURNAL entries 2026-10-05 (late) … 2026-10-06 (night). Every slice typechecks on its own (frontend + backend, checked in a scratch worktree). Not yet hand-checked in a visible browser: the search's feel (headless frames only), touch drag, Safari; the dialogs and drawers were checked in headless frames only.

**Dialog follow-ups (small, not started):** page controls still on `.input-premium` (Admin → Bug reports search, the Broadcasts composer, the Companies search) → `ui/Input`; the Import dialog's dropzone is a clickable `<div>` keyboard users can't reach; when a dialog swaps steps (Import, the scan wizard) the focused button disappears and focus drops to the page — move it to the new step's first control; `WidgetPicker/AdminWidgetPicker.tsx` is imported nowhere (delete, or wire it if Admin's dashboard should have one).

**On `master` (pushed, 2026-10-06 night), in 5 slices:** server-side Contacts search/status + Companies stage/sort (6c1ea6e), the assistant connect card (51e5d4e), one page header everywhere + Contacts/Deadlines on phones + `ui/Pagination` (b77a1ce), the board drag fix (deab85b), docs (ef2635d) — BUILD_JOURNAL "2026-10-06 (late night)", "(late night, later)", "(night, last)"; Revamp.md "One page header, everywhere", "Watching the assistant connect", "Phones and the board drag". The tip passed `tsc -b`, `npm run build` and backend `tsc --noEmit` before committing; **the per-slice worktree typecheck was not run this time** (cancelled before the push) — slices 6c1ea6e and 51e5d4e are self-contained, b77a1ce leaves BoardView at its old (compiling) version.

**On `master` (local, NOT pushed), 2026-10-08 — Admin hardening + Admin's own search, 2 slices:** admin security (5cac40e), Admin's Spotlight (4c0c942) — BUILD_JOURNAL "2026-10-08", Revamp.md "2026-10-08 — Admin: hardening + Admin's own search". Built in a worktree (branch `admin-hardening`), fast-forwarded into `master`; the worktree and branch are removed. `docs(claude)` (49853e8) adds the rules to CLAUDE.md. The parked branch `admin-revamp` (shell merge + admin settings + a component kit) is **not for merge** — the owner dropped that direction; delete it when convenient.

**Open from the 2026-10-08 admin session — check first:**
1. ~~Push~~ — pushed with the redesign.
2. ~~**The dev backend died when Mongo wasn't reachable at boot**~~ — fixed (c63c4a6, owner-approved): in development `config/db.ts` retries (1/2/4/8 s, then every 15 s) with a plain log line; production still exits. That was the owner's "can't log in, status 500" on 2026-10-08 (`ECONNRESET` at 7:09 PM; `tsx watch` only restarted it at 7:45 on a file change). Verified with a Mongo arriving 30 s late (two retries, then connected) and the production path (one attempt, exit 1).
3. **Admin search in a visible browser** (owner): hover the bar in Admin → Users · Feedback · Bug Reports dock (a dot on Feedback / Bug Reports while something's open), ⌘K, type a name → people + pages, pick a person → their details on Users, "+" → edit/drag links (saved on the account).
4. **CSRF beyond Admin** (owner call): the same-site guard covers admin writes only. The session cookie is SameSite=None in prod, so every cookie-authenticated POST in the app is forgeable from another site the same way; `middleware/sameSite.ts` is ready to mount on all of `/api` (check the extension's Bearer calls and OAuth callbacks first).
5. **`ADMIN_EMAILS`** (owner call): registering with a listed address makes the account an admin with no email verification (`routes/auth.ts` register + `/me` re-promote). Recommend granting it only to Google-verified sign-ins.

**Open from that session — check first:**
1. **Board flicker — owner to confirm after a reload.** The owner's recording (9:05) was the old bundle (the fixed build landed 9:04 and the tab wasn't reloaded). After ⌘R: the held card stays dimmed in place, the target column shows a card-sized slot, no counts move until the drop. If it still flickers, get a new recording.
2. **Possible DragOverlay offset** — in one headless test frame the floating card was drawn ~200px below the pointer. Not reproduced or explained (could be the scripted pointer path). Check in a real browser: the overlay should sit under the cursor where you grabbed it.
3. **Assistant connect step 3 with a real Claude Code session** — simulated with the same `tools/call` request; ask Claude Code "Say hi to HireTrail" with the card open and watch "First request: who you are" land. The owner's own token (••••HBR8, local DB) already shows Connected.
4. **Real phone** — Contacts cards (footer row + "⋯" menu) and Deadlines rows (due under the title) were checked at 375px emulated only; also touch: hover-only tools now show under `@media (hover: none)`.

**Follow-ups from the header work (not started):** Companies refetches resumes/contacts/deadlines/apps on every search keystroke (only the company list depends on it); the application detail page's loading skeleton has no header (a jump when it loads).

**Queued earlier (not started):** per-feature model switching from the AI map's hover card — the person's own keys only (never Included), and the same for HireTrail's platform keys in Admin → AI (Sora's "Switch model" with a searchable list of the key's live models). Then, if the owner says go: the control/field/surface radius tokens (pill controls), mocked on the Applications toolbar + header first.

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

**Next session, in order:** the redesign's "Check first" list at the top → the "Open from that session" checks above → the owner's radius-scale call (keep / go further / revert) → the queued per-feature model switching (below, "Queued earlier") → the dialog and header follow-ups. Older owner hand-checks follow.

0. **Owner hand-check of the calendar** in a visible browser (the pane was hidden, so no real frames were seen): drag a deadline between days in Month and Week (feel, the grab cursor, the target tint), the paging slide (‹ › and ← →), the day peek opening over its cell, hover cards, the title's mini calendar (days → months → years), real keyboard shortcuts (← → T D W M, `c`, and arrows/PageUp/PageDown/Enter inside the grid), and a window resize re-measuring how many chips fit.

1. **Owner hand-check in a visible browser and on a real phone** (the in-app pane stayed hidden, so real frame timing was never seen; phones were emulated): scroll the whole landing on a laptop and on an iPhone + an Android — the story (rise → dock, the three beats, the dive), the theme dock, the word list, the sign-in bottom sheet; scroll far enough for Safari's toolbars to tuck away (no strip under a white chapter); rotate the phone once. Safari + Firefox. Reduced motion should keep the fades and drop every move.
2. **Landing round 3 in a real browser** — Chrome, Safari 26+ (the headings' sweep runs on scroll timelines), Firefox (sweep falls back to plain ink), Windows/Android (the Inter font); the dive (pick Dark → lift → grow), ⌘K, the theme wipe, the founder sweep, the closing beams, and the footer rising over the last ask. Frames so far came from headless Chrome only. If the share image needs refreshing after copy changes, `frontend/public/og.jpg` is a 1200×630 capture of the hero.
3. **Terms** still names `hiretrail.vercel.app` (`pages/Legal/Terms.tsx` §1) — swap in the live domain when you confirm it. (Privacy was rewritten with the AI revamp.)
4. Earlier owner calls still open: Dark mirrors charcoal (keep?), "Table" vs "Minimal", tag chips 4.2:1, white on `bg-amber-600` 3.2:1 (Revamp.md → "Noted, not changed").
5. Queued engineering: the six hand-rolled switches → `ui/Toggle`; `GET /deadlines` status tabs need the viewer's zone (a picked day counts as overdue from 00:00 UTC on its due day — with the Deadlines revamp); analytics bucket applied dates with Date math (Dashboard revamp); drop the old `{userId, completed}` Deadline index in Atlas.

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
