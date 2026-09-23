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

## Stack + layout map

**Monorepo:** `backend/` (Express 4 + TS strict + Mongoose 8, ESM), `frontend/` (React 18 + Vite 5 + TS strict + Tailwind 3.4 + react-router 6), `extension/` (Chrome MV3, packed to `frontend/public/extension.zip`).

- Frontend pages: `frontend/src/pages/<Feature>/` (~26k LOC). Shared components: `frontend/src/components/`. API client: `frontend/src/utils/api.ts` (single axios instance, cookie session, typed namespaces) + `studioApi.ts`. Types: `frontend/src/types/index.ts`. No state library, no server cache — Context + useState/useEffect per page.
- Design tokens: `frontend/src/App.css` (`:root` + `.dark`, shadcn-style HSL triplets) mapped in `tailwind.config.js` via `hsl(var(--x))`. Theme engine: `hooks/useTheme.ts` + `utils/themes.ts` (42 presets; only light/dark reachable from UI).
- Backend routes: `backend/src/routes/` (+ `routes/admin/` with 22 sub-routers), business logic in `backend/src/services/`. **All AI calls must go through `services/ai/run.ts`** (resolve → cache → quota → retry → meter). Models: `backend/src/models/`. Env: `backend/src/config/env.ts` (Zod; `.env.local` loads first and wins).
- Auth: Passport cookie sessions (+ Bearer JWT for the extension only). `ensureAdmin` is session-only. Demo user (`demo@hiretrail.com`) is blocked from state-changing/AI routes via `blockDemoUser`.
- PDF: Gotenberg (`services/pdf/renderHtml.ts`); resume HTML sanitized in `services/resume/html.ts` — Studio preview must stay pixel-faithful to the PDF.

## Rules that will bite you if ignored

- **Dialogs and pickers**: build on `frontend/src/components/ui/` (Modal + Button + Field + Select + DateInput + Toggle). Never hand-roll a `fixed inset-0` overlay, raw `<select>`, or `<input type="date">` in product surfaces. Floating widgets that handle Escape must register on `ui/layers.ts` (one stack for modals + popovers) or the dialog underneath closes too. Popovers inside a scrollable ModalBody must portal to `<body>` fixed-position (Select/DateInput show the pattern).

- **Never run dev against prod Atlas.** `backend/.env.local` (local `MONGO_URI`) loads before `.env` and wins. Verify the boot log says `127.0.0.1/hiretrail_dev` before touching data.
- Legacy data shapes are real: old docs lack `versions[]`, `jdKeywords`, `baseResumeId`, `TailorSession.status`; company docs may carry poisoned `domain` from an old bug. Follow existing patterns (`setOnInsert` upserts, boot-time idempotent migrations, schema defaults).
- The Vercel AI Gateway has **no `bedrock/*` model namespace** — Bedrock BYOK routes canonical model ids with AWS creds as a JSON credential blob. Never auto-activate a key that failed validation.
- `tsx watch` restarts the backend on stray fs events → transient proxy 500s on `/api/*` in dev. Not a product bug; check the backend log before chasing it.
- Header dropdowns close on `mousedown` outside — browser-automation clicks can race this; real users are unaffected. Use DOM `.click()` when driving the UI in tests.
- The dashboard is `react-grid-layout` with per-user saved layouts (localStorage); it measures on mount — window resizes mid-session don't re-flow until reload (known gap).
- Demo data: `cd backend && npm run seed` creates/refreshes `demo@hiretrail.com / password123` (650 apps). Local dev login: `dev@hiretrail.local / devpass123` (`npm run db:seed`). AI/email-scan testing in prod uses test@test.com (see memory).
- Settings is its own route area (`/settings/*` with `SettingsLayout`, NOT inside the main `Layout`). Legacy `/settings` links + `#hash` anchors + OAuth `?gmail=` params are handled by `SettingsIndexRedirect` in App.tsx — keep it working if you touch settings routes. Email review lives at `/email-review`.
- Frontend `npm run lint` is dead (no ESLint config exists). The real gates are `npx tsc --noEmit` (backend) and `npm run build`/`npx tsc -b` (frontend).
- **Deploy/build-pipeline/tooling work is out of scope by owner instruction (2026-08-05)** — don't set up CI, linting infra, or touch deployment configs unless asked.

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
