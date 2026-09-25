# CLAUDE.md — start here

HireTrail is a job-search tracker ("Tailor. Apply. Track.") — applications pipeline, Kanban, calendar/deadlines, contacts/companies, resume management with AI tailoring (Resume Studio), Gmail/Outlook inbox scanning, and a Chrome extension. It is **live in production with real users** at hiretrail.manavkaneria.me. Solo-maintained. Treat every change as a production change.

> **Start every session by reading BUILD_JOURNAL.md and handoff.md. End every session by updating both.**

## Standing agreements (condensed from the owner)

- Act as a senior engineer and fellow developer, not an assistant. Push back, propose, give opinions.
- Plain language; define jargon briefly when unavoidable.
- **Root-cause, don't patch.** Measure before fixing. No band-aids.
- **Honest scope calls** — defer explicitly and write it down; never silently drop work.
- **Report faithfully** — failed check = say so; unverified = say so. Never claim "done" unseen.
- **No AI attribution in commits.** No Co-authored-by Claude, no robot emojis.

## Non-negotiables

1. **Speed is a feature** — optimistic UI, skinny payloads, route-level code splitting, indexes designed with queries.
2. **A1 codebase** — every diff reads like one careful person wrote it.
3. **The Benchmark Check** — after ANY UI change: preview in browser, screenshot, judge honestly against Linear/Apple/Stripe. Ship only if it passes. Never skip.
4. **Production safety** — never break existing functionality; small reviewable slices; verify live before moving on; handle legacy Mongo document shapes explicitly (docs in the wild predate new fields — see the migration patterns in `backend/src/services/migrations/`).

## Design philosophy

Clean, calm, minimal — Apple/Linear. Restraint over decoration: generous whitespace, quiet neutrals, **one accent (the existing blue, `--primary`)**, color only for meaning (stage, status). No raw native form widgets — shared primitives only (one dropdown, one dialog, one toast, one tooltip). Calm motion: quick fades/collapses ~200ms, `cubic-bezier(0.16,1,0.3,1)`, everything behind `prefers-reduced-motion`; never animate opacity/filter on an ancestor of a `backdrop-filter` element. Keyboard-friendly: Enter/Escape everywhere, `:focus-visible`-only rings. Quiet confirmations via toasts (+Undo where destructive-ish); one light confirm for destructive actions. All colors/radii/shadows as CSS variables (already in `frontend/src/App.css` — extend it, never hardcode). Light + dark first-class. Craft the edges: empty states, view-shaped skeletons, error states, truncation.

**Owner-locked UI decisions (do not re-propose):**
- No "Today" strip / "What needs your attention" list on the Dashboard — built and reverted twice.
- AI "working" indicator: glow-pulse only. Never spin, never scale.
- Notifications: bell + page both have Current | Past tabs; dismiss archives (resolves), never hard-deletes.
- Landing + public pages (2026-09-25): monochrome black/white page, colour only inside the product previews; chapters alternate black · white · black · white · black; the header keeps its layout/pill motion and takes the chapter's tone; footer links are real ones only; no fake stats or status badges; About / Privacy / Terms are dark. Every claim on the landing must be true in code (three are owner-held until built — handoff "Ship blockers").

## Stack + layout map

**Monorepo:** `backend/` (Express 4 + TS strict + Mongoose 8, ESM), `frontend/` (React 18 + Vite 5 + TS strict + Tailwind 3.4 + react-router 6), `extension/` (Chrome MV3, packed to `frontend/public/extension.zip`).

- Frontend pages: `frontend/src/pages/<Feature>/` (~26k LOC). Shared components: `frontend/src/components/`. API client: `frontend/src/utils/api.ts` (single axios instance, cookie session, typed namespaces) + `studioApi.ts`. Types: `frontend/src/types/index.ts`. Server state: **TanStack Query** (`utils/queryClient.ts`) — adopted page by page, starting with Applications (`pages/Applications/data/`); pages not yet revamped still use Context + useState/useEffect.
- Design tokens: `frontend/src/App.css` (`:root` + `.dark`, shadcn-style HSL triplets) mapped in `tailwind.config.js` via `hsl(var(--x))` — the **only** place preset values live. Tailwind's palette classes read `--palette-<family>-<shade>` (RGB triplets, Tailwind's exact values) so a Custom theme can re-tint them; `--paper` = always white (knobs, logo plates, resume paper), `--scrim` = always black (overlays); `text-primary` reads `--brand-text` (the accent *as text*), fills/borders/rings keep `--primary`. JS/inline colours: `utils/palette.ts` `cssPalette()` / `utils/chartSetup.ts` helpers — never a literal. Neutral state fill = `bg-control` (not `bg-muted`, which is near-white); shadows = `shadow-panel` / `shadow-floating` (never name a shadow after a colour key — `shadow-card` compiles to a shadow colour).
- Default look (owner, 2026-09-25): charcoal accent (#262626) on near-white (#fcfcfc), neutral greys; colour only for meaning. Sidebar items rest in `muted-foreground`, brighten on hover (no fill); the selected one is a raised pill (`navTone` in `components/Sidebar/navParts.tsx` — the one style for app, Settings, Admin). Plain cards on a page in Settings/Admin = `.surface-card` (soft shadow); nowhere else yet.
- Themes (Settings → Personalize: System / Light / Dark / Custom): prefs on the account (`preferences.theme`, server wins; demo = device only). `hooks/useTheme.tsx` = `ThemeProvider` + `ThemeContext` (dark, mode, **revision**) + `ThemeControlsContext` (Personalize previews). No theme toggle in the header (owner, 2026-09-25). **All painting goes through `utils/themeDom.ts` `paintTheme`** (deduped; Custom writes the generated tokens inline, presets clear exactly those); `index.html` paints the boot cache before JS. Custom generation = `utils/theme.ts` (pure; the background is always the picked colour, text flips once) — after touching it run `cd frontend && node --test src/utils/theme.test.ts` (must be 0 failures). Canvas charts re-read tokens keyed on `revision`, and pass alpha to the helpers — never append hex alpha to a colour string. Signed-out pages paint the Light preset (the landing and the public pages draw their own dark palette, `.lp` in `pages/Landing/Landing.css`); Admin shows presets only.
- Shell (app **and** Admin): header + sidebar are one backdrop; the main section is a card and **the scroll container** (`#app-scroll`). Read/set page scroll via `utils/scrollRoot.ts`, never `window.scrollY`/`window.scrollTo`; page sticky bars use `top: 0`. Sidebar collapse is a View Transition (`hooks/useShellCollapse`, shared nav rows in `components/Sidebar/navParts.tsx`) — don't add live width/margin transitions to the shell.
- Backend routes: `backend/src/routes/` (+ `routes/admin/` with 22 sub-routers), business logic in `backend/src/services/`. **All AI calls must go through `services/ai/run.ts`** (resolve → cache → quota → retry → meter). Models: `backend/src/models/`. Env: `backend/src/config/env.ts` (Zod; `.env.local` loads first and wins).
- Auth: Passport cookie sessions (+ Bearer JWT for the extension only). `ensureAdmin` is session-only. Demo user (`demo@hiretrail.com`) is blocked from state-changing/AI routes via `blockDemoUser`.
- PDF: Gotenberg (`services/pdf/renderHtml.ts`); resume HTML sanitized in `services/resume/html.ts` — Studio preview must stay pixel-faithful to the PDF.

## Rules that will bite you if ignored

- **Revamp.md is the decision log for the page-by-page revamp** — read the page's section before touching it.
- **Applications** is one route area: `ApplicationsLayout` (shell: header, URL filters, dialogs, deep links `?new/?focus/?tailor/?tailorSession/?stage`) + `views/` (List = Classic|Table, Board, Calendar) + `ApplicationDetailPage` (`/applications/:id`). Filters are URL params — patch them with ONE `setFilters` call (two `setSearchParams` in one tick drop an update). Extension-shipped links (`/applications?tailor=`, `?tailorSession=`) must keep working forever.
- **Query requests pass `quiet: true`** (the axios interceptor then skips its toast; QueryCache toasts after one silent retry). Mutations are NOT quiet — the interceptor is their only error toast; don't add a second one in `onError` (just roll back).
- **Page single-key shortcuts go through `hooks/usePageShortcuts`** (skips typing, open layers, and pending global `g`/`n` sequences). Never bind "?" in a page — it's GlobalShortcuts'.
- **Portaled menus bubble React events through the tree** — clickable rows must ignore clicks whose DOM target isn't inside them (`e.currentTarget.contains(e.target)`).
- **Never add Vercel rewrites to `backend/vercel.json`** — Express routes everything itself; a rewrite reaches Express as the *rewritten* path (2026-09-23 outage).
- **Mongo on Vercel**: keep `attachDatabasePool` + `maxIdleTimeMS` in `config/db.ts` (freeze/thaw crash, 2026-09-24). User search text → `utils/regex.ts` (`searchRegex`/`escapeRegex`), never raw `new RegExp(input)`.
- List payloads use `fields=summary` (no `jobDescription`; has `hasJobDescription`). Read JD presence via `utils/applicationFields.hasJobDescription`, never `app.jobDescription` in list code.

- **Dialogs and pickers**: build on `frontend/src/components/ui/` (Modal + Button + Field + Select + DateInput + Toggle + Slider + ColorPicker). Never hand-roll a `fixed inset-0` overlay, raw `<select>`, `<datalist>`, `<input type="date">`, `type="range"` or `type="color"` in product surfaces.
- **Every dropdown goes through `ui/Popover`** (the one floating surface: look, motion, placement, portal, layer stack, dismissal). Use `Menu` (actions / single-choice with a custom trigger), `Select` (value picker; `variant="pill"` for settings rows; option `icon`s), `DateInput`, `ComboboxList` (suggestions under your own input), `HoverCard`; compose custom panels (notifications, Filters) from `Popover` + `PopoverSection/Label/Divider` + `itemClass`. Outside clicks close a layer unless they land inside it or a layer above it (`layers.ts`, capture phase). Only exception: react-big-calendar's own "+N more" overlay (token-styled).
- **Exit motion**: `ui/Modal` animates out by itself. Any other overlay root rendered conditionally gets `ref={useExitAnimation(MODAL_EXIT)}` (+ `modal-overlay-in` on the root, `data-modal-panel animate-in` on the panel). Collapsible sections use `ui/Collapse`.

- **Never run dev against prod Atlas.** `backend/.env.local` (local `MONGO_URI`) loads before `.env` and wins. Verify the boot log says `127.0.0.1/hiretrail_dev` before touching data.
- Legacy data shapes are real: old docs lack `versions[]`, `jdKeywords`, `baseResumeId`, `TailorSession.status`; company docs may carry poisoned `domain` from an old bug. Follow existing patterns (`setOnInsert` upserts, boot-time idempotent migrations, schema defaults).
- The Vercel AI Gateway has **no `bedrock/*` model namespace** — Bedrock BYOK routes canonical model ids with AWS creds as a JSON credential blob. Never auto-activate a key that failed validation.
- `tsx watch` restarts the backend on stray fs events → transient proxy 500s on `/api/*` in dev. Not a product bug; check the backend log before chasing it.
- Header dropdowns close on `mousedown` outside — browser-automation clicks can race this; real users are unaffected. Use DOM `.click()` when driving the UI in tests.
- The dashboard is `react-grid-layout` with per-user saved layouts (localStorage); it measures on mount — window resizes mid-session don't re-flow until reload (known gap).
- Demo data: `cd backend && npm run seed` creates/refreshes `demo@hiretrail.com / password123` (650 apps). Local dev login: `dev@hiretrail.local / devpass123` (`npm run db:seed`). AI/email-scan testing in prod uses test@test.com (see memory).
- Settings is its own route area (`/settings/*` with `SettingsLayout`, NOT inside the main `Layout`). Legacy `/settings` links + `#hash` anchors + OAuth `?gmail=` params are handled by `SettingsIndexRedirect` in App.tsx — keep it working if you touch settings routes. Email review lives at `/email-review`.
- **Restart the Vite dev server after editing `tailwind.config.js`** — a stale one silently drops new utilities (they render transparent in dev only).
- Frontend `npm run lint` is dead (no ESLint config exists). The real gates are `npx tsc --noEmit` (backend) and `npm run build`/`npx tsc -b` (frontend). `noUnusedLocals` is off — check touched files for unused imports yourself.
- Boot-time data migrations go through `services/migrations/runBootMigrations.ts` (a `migrations` ledger; each runs once per database). New migration = new permanent name; never rename a shipped one.
- **Deploy/build-pipeline/tooling work is out of scope by owner instruction (2026-08-05)** — don't set up CI, linting infra, or touch deployment configs unless asked.
- **Landing / public pages** (`pages/Landing/`, `pages/Legal/`): own palette under `.lp` — never app tokens for page chrome (product previews wear `.theme-light`/`.theme-dark`). Scroll-driven motion only through `engine/scroll.ts` (`useScene`; callbacks write styles, no React state per frame). **Never set one property from both a Tailwind utility and Landing.css/Legal.css on the same element** — those files load before App.css in dev and after it in the build. Pinned-section lengths (CSS) and the `data-lp-tone` bands inside them change together. Public pages call `hooks/usePageEntryScroll` (the document scrolls; nothing else resets it). The story's window is a replica of real UI — update it when the real Board / Studio / extension / Personalize change. **Below 1024px the landing has its own compositions** (`story/mobile/`, `useCompactLanding`) — change both. Pinned stages that change colour are `100lvh` with content inside `100svh`; clip overhangs with `overflow: clip`, never `hidden` (it kills `sticky`).
- **First paint** (`App.tsx`): the landing, public pages and the signed-in shell are lazy. `LIKELY_SIGNED_IN` (the theme boot cache) decides what to warm; visitors at "/" render the landing without waiting for `/auth/me`; `preloadAppShell()` on sign-in intent. Don't add eager imports of app pages/shell to `App.tsx`/`main.tsx`. The sign-in sheet (`components/AuthModal`) is `ui/Modal` with `motion="soft"`.

## Commands

```bash
npm run db:up                      # root: local Mongo via docker compose
cd backend && npm run dev          # API on :5050 (uses .env.local)
cd frontend && npx vite --port 5175 --strictPort   # SPA (proxies /api → :5050)
cd backend && npm run seed         # seed demo@hiretrail.com dataset
cd backend && npx tsc --noEmit     # backend typecheck (gate)
cd frontend && npx tsc -b          # frontend typecheck (gate)
cd frontend && npm run build       # full frontend build (gate)
```
