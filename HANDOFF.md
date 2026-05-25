# HireTrail — Session Handoff

A living document for whoever (Claude or human) picks up next. Read top-to-bottom on first arrival.

---

## 1. Who you're working with

**Manav** is the owner. He's pushing HireTrail from "project" to "product" — preparing for an open-source launch on LinkedIn. The quality bar is *recruiter-grade*: the app may be shown to recruiters as a portfolio piece. He treats it as both a job-search tool and a product showcase.

### How to communicate with him

- **Be direct. Push back when you think he's wrong.** He explicitly asks for "brutal honesty." If an idea is bad, say so before you build it — building first then reverting wastes everyone's time. (We learned this the hard way with a 60/40 split-pane layout he reverted.)
- **Plan before action.** When asked to do something big, surface trade-offs first, then ask 2–4 clarifying questions (use `AskUserQuestion`), then execute. Don't just dive in.
- **Concise comms.** Skip filler. He reads everything; don't waste his time.
- **Phase aggressively.** Multi-turn sessions over single-marathon. If something is >120h of work, propose a phased plan and execute one phase per turn.
- **Audit your own work.** When a phase ends, list bugs/risks/regressions you can spot in what you wrote — grouped by severity. He will ask for this explicitly; do it proactively when finishing a substantial change.
- **He likes parallelization** but only when work is *genuinely independent*. Page redesigns that share state/components are NOT parallelizable. Cross-cutting utilities (empty states, toasts, shortcuts) WERE done in this session and are now safe to parallelize against.
- **Trust the user's product instincts.** When he says "this looks wrong" trust him before defending the design. He's the one who'll show it to recruiters.

### Things he repeatedly values

- **No bugs before shipping.** He explicitly said "I am going to send this to a recruiter." Always run `tsc + vite build + extension tests` before reporting done.
- **Consistency across the app.** New patterns (e.g. row redesign) should propagate to every page that benefits.
- **Code quality / standards.** Strict TypeScript (no `any`), proper `aria-*`, focus rings, `prefers-reduced-motion`, memoization, pure utilities with co-located node tests where they make sense.
- **Visual delight without overdoing it.** Subtle animations (fade-up, stage-history sparklines), brand-aligned palettes (HireTrail blue gradient), but not "decorated." Think Linear/Notion, not Stripe-marketing-page.
- **Truthful scoping.** If you can't finish in one session, say so. He'll happily phase it.

### Anti-patterns (things he will call out)

- Saying "Done!" when something isn't fully tested.
- Sycophancy ("Great idea!"). He doesn't need encouragement.
- Hand-waving ("the rest is straightforward"). Be specific.
- Implementing a feature that already exists. Search the codebase first — `EmptyState`, `useMediaQuery`, `applicationHealth`, `dashboardSignals`, etc. are already built.
- Deleting unrelated code while making an unrelated change. Touch only what the task demands.

---

## 2. Tech stack quick reference

- **Frontend**: Vite + React 18 + TypeScript (strict), Tailwind, react-router-dom v6, react-hot-toast, react-grid-layout (Dashboard), Chart.js (some widgets), @dnd-kit (Kanban). Path is `/frontend`.
- **Backend**: Node.js + Express + Mongoose, Zod validators, Cloudinary uploads, Vercel AI SDK for LLM calls. Path is `/backend`.
- **Extension**: vanilla JS Chrome extension (Manifest v3) at `/extension`. Tests are `node --test extension/tests/*.test.js`.
- **Deployment**: production at `https://hiretrail.manavkaneria.me`.

### Common scripts (run from `/frontend` unless noted)

```bash
npx tsc -b --noEmit        # frontend type-check
npm run build               # vite production build
cd backend && npx tsc --noEmit   # backend type-check
cd .. && npm run test:extension  # extension tests (project root)
```

### Project layout cheat-sheet

```
/frontend/src/
  components/                  # shared UI
    EmptyState/                # use this for every empty list
    GlobalShortcuts/           # ?, g a, n a, etc.
    CompanyLogo/               # Cloudinary-cached logos
    FeedbackWidget/            # bug reports, "request access" pre-fill
  hooks/
    useMediaQuery.ts           # for responsive logic
    useApplicationsListState.ts
    useWidgetLayout.ts         # dashboard widget grid
  pages/
    Applications/
      Applications.tsx
      ApplicationDetailSidebar.tsx   # OVERLAY chrome only — body is shared
      AiAnalysisSidebar.tsx
      components/
        ApplicationRow.tsx
        ApplicationDetailBody.tsx    # shared body (used by sidebar; reusable elsewhere)
        AppFitPanel.tsx              # blue AI Fit panel on each row
        AppFieldGrid.tsx             # icon-led detail strip on each row
        PipelinePulse.tsx            # stage dots + age + next action
        fieldIcons.tsx               # shared icon vocabulary
    Dashboard/
      Dashboard.tsx
      components/StreakCard.tsx, WeeklyCapacityCard.tsx
  utils/
    applicationHealth.ts       # age + tone + nextAction (pure)
    dashboardSignals.ts        # streak, weekly capacity, hero, attention (pure)

/backend/src/
  services/
    ai/autoAnalyze.ts          # canonical analyze worker + on-create trigger
    ai/tailor.ts               # LLM analyze
    jdExtractor.ts             # heuristic JD field extractor (no LLM)
  routes/
    applications.ts            # POST also triggers autoAnalyze + jd-extract
    companies.ts               # logo Cloudinary cache
    ai.ts                      # BYOK + /keys/validate (rate-limited)
  middleware/rateLimiter.ts    # apiLimiter + byokValidateLimiter
```

### Conventions established this session — follow these going forward

- **Empty states** use `<EmptyState intent="welcome|filtered" title="..." description="..." actions={...} />`. Internal `href` routes via `<Link>`, external via `<a target="_blank">`.
- **Field labels in detail panels** use `<FieldLabel icon="contact|company|salary|...">` (see `pages/Applications/components/fieldIcons.tsx`). Add new icons to the registry; never inline an SVG that should be reusable.
- **Toasts** are themed in `main.tsx`; new toasts inherit. Use `--success`, `--danger`, `--warning` CSS vars (defined in `App.css` light + dark blocks).
- **Page widths**: routes in the Layout `fullWidth` array span 100%; others are capped at `max-w-[1200px]`. Currently full-width: `/`, `/kanban`, `/calendar`, `/profile`, `/tailor`. Applications is now narrow (1200px) again — Contacts pattern.
- **Sticky toolbars inside a page** use `-mx-4 md:-mx-6 px-4 md:px-6` to match the parent's padding. NEVER use `-mx-8` — it overshoots and causes horizontal scroll.
- **Form modals**: ANY `<button>` inside a `<form>` that isn't the submit button MUST have `type="button"`. Otherwise clicking it submits the form. This bit us with dropdown triggers; sweep new modals for the same.
- **Deep links**: `?focus=ID` to open a detail sidebar; `?new=1` to open the create modal. Both params should be **stripped after handling** via `setSearchParams(next, { replace: true })` so a refresh doesn't re-trigger.
- **Branded blue gradient** (HireTrail mark): `linear-gradient(135deg, #3B82F6 0%, #1E3A8A 100%)`. Use for AI Fit panel, primary logo tile, etc.
- **Stage colors**: see `utils/stageStyles.ts`. Always derive — never hardcode hex values.
- **Time-sensitive computations** depend on `now: Date`. The Dashboard ticks a `nowTick` state every 60s so midnight rollovers refresh "overdue" / "today" / "this week".
- **CSS vars over hardcoded colors** in inline `style={}` props. Use `hsl(var(--success))`, etc.

### Conventions to RESPECT (existing patterns I observed)

- Existing dropdowns use `ActionDropdown`. New dropdowns should too — don't roll your own.
- Confirm dialogs use `useConfirm` + `ConfirmModal`.
- All API access goes through `frontend/src/utils/api.ts`. New endpoints add a new method on the appropriate API object (`applicationsAPI`, `contactsAPI`, `aiAPI`, etc.).
- Use the global error handler in `backend/src/middleware/errorHandler.ts`. Throw `AppError`/`NotFoundError`/`ValidationError`/`AuthError`/`ForbiddenError`.

---

## 3. What's already been shipped (recent sessions)

This is a sanity check — don't redo any of these.

### Applications page redesign (Phase A — done)
- Full row redesign (logo tile, role/company, age badge, AppFieldGrid, PipelinePulse, blue AppFitPanel).
- `useApplicationsListState` hook (search, sort, filter, density, grouping, selection).
- Density toggle (Comfortable/Compact). Group-by-company toggle.
- Bulk-select without mode toggle (hover-reveal checkbox).
- Keyboard nav: `j/k/Enter/e/x/?`, `g a/d/k/c/o/r/l/m/p`, `n a/c/d`, `/` for search.
- Mobile-responsive row reflow.
- `applicationHealth.ts` util — age + tone + nextAction (pure, tested via `node:test`).

### AI Fit pipeline (done)
- `services/ai/autoAnalyze.ts` — canonical worker. Per-user concurrency cap (2), daily soft cap (50), short-circuit when no master profile.
- Auto-trigger on `POST /applications` (skips demo user).
- `TailorSession.status` now includes `"deferred"` for cap-hit case.
- `loadFitSummaries()` in applications route populates `app.fit` on list/get.
- Demo seed creates synthetic TailorSessions with weighted random A–F grades.
- `AiAnalysisSidebar` — read-only summary with "Open in Tailor" CTA.

### Logo pipeline (done)
- `Company.logoUrl` cached in Cloudinary, fetched once from Google s2 favicons (Clearbit removed — defunct).
- `POST /companies/:id/logo` never 400s — best-effort, always 200.
- Session-scoped dedupe in Applications to prevent re-spam.
- CompanyLogo component guards against any legacy `logo.clearbit.com` URL.

### Background JD field extractor (done)
- `services/jdExtractor.ts` — heuristic salary/jobType/location/title/company extraction.
- Triggered fire-and-forget on application create, never overwrites user-typed values.

### Dashboard (done — partial)
- Two new widgets in movable grid: `StreakCard` (activity streak) + `WeeklyCapacityCard` (per-user goal).
- `useWidgetLayout` backfills missing widgets so existing users auto-get new ones.
- `nowTick` minute-interval refreshes time-based signals.
- (Hero strip, Attention list, animated Funnel were tried then reverted — existing FunnelWidget covers the funnel; the others felt redundant.)

### Settings (done — partial)
- BYOK key validation: live ping per provider, debounced 500ms, AbortController-cancelable, rate-limited (30 req / 5 min).
- Google uses `x-goog-api-key` header — never URL.
- Outlook "Coming soon" gated behind `feature_outlook_integration` flag.
- Gmail "Request access" → opens pre-filled FeedbackModal so the admin can add the user as a Google OAuth test user.

### Cross-cutting (done)
- Branded toast theme (CSS-var-driven `--success`, `--danger`, `--warning`).
- Shared `EmptyState` component, applied to Contacts/Deadlines/Companies/Resumes.
- Global keyboard shortcuts (`?`, `g a/d/k/c/o/r/l/m/p`, `n a/c/d`).
- Route code-splitting: main chunk 1.7MB → 1.3MB. Calendar (256kB) on demand.
- `useMediaQuery` hook available for any responsive logic.
- Module preload of sidebar routes 600ms after auth.
- Bug audit + 16 fixes (see git log if needed).

### Bugs fixed
- Dropdown `type="submit"` bug in all form modals (Applications, Contacts, Deadlines).
- `nextFollowUpDate` validator accepting both date and ISO datetime.
- Company combobox in Contact form (search + find-or-create).
- Logo endpoint 400 spam.
- Horizontal stretch on multiple pages.
- Sidebar shadow overlap removed.
- Global search → ID-based focus param + click-outside-closes + fallback fetch when paginated past.
- Search icon overlap in toolbar.
- `?new=1` / `?focus=ID` URL stripping after open.
- Streak / weekly capacity now uses `applicationDate` preferentially over `createdAt` (CSV imports don't break the streak).
- And more — see git log.

---

## 4. What is NOT been shipped — the remaining work

Grouped by surface. Effort: **S** ≈ <1h, **M** ≈ a few hours, **L** ≈ a day+ and probably its own design pass.

### Pages awaiting redesign (highest leverage)

#### Contacts (M+)
- Apply row redesign (mirror Applications): logo, name, role at company, outreach status, days-since-last-contact, action CTA.
- **Contact strength score (0–100)** — derived from recency + response rate + LinkedIn-connected + introduced-applications. Differentiator.
- **LinkedIn quick-action** (open profile in new tab) — small but high-utility.
- **Outreach email templates** — pre-built follow-up emails personalized with contact data. One-click "Copy to clipboard."
- ~~Network graph view~~ — deferred (L, post-launch).

#### Companies (M)
- **Logo-first card grid** (now that Cloudinary cache exists, logos are real).
- "Contacts at this company" inline avatars.
- **Quick-jump links**: Glassdoor / Levels.fyi / Blind / careers page.
- **Company timeline**: lifetime stage history at this company ("Applied 3× — 1 Rejected, 1 Interview, 1 Offer").
- **Compensation memory**: aggregate of every salary seen at this company.

#### Deadlines (M+)
- Apply row redesign (icon-led like Applications).
- **Smart grouping**: Today / Tomorrow / This Week / Later / Overdue, with sticky section headers.
- **Snooze with quick options** (right-click: 1d / 3d / next Mon).
- **Auto-complete suggestions**: when a stage advances on a linked app, prompt "Mark related deadline complete?"
- **Recurring deadlines**: "Follow up every 2 weeks until response."

#### Resumes (M+)
- **PDF preview thumbnails** (not just text names). Needs a thumbnail extractor — `pdfjs-dist` page → canvas → cloudinary.
- **Performance metrics per resume**: response rate, OA rate, interview rate. Backend already has the data.
- **"Tailored from..." relationships**: when a tailored resume is generated, show which base resume it descends from (tree view).
- **Version timeline**: history of edits.
- ~~A/B comparison view~~ — deferred (L, post-launch).

#### Kanban (S+)
- **WIP-style stage stats** under each column header ("Avg 8d in OA").
- **Card density toggle** (mini / regular / detailed).
- **Smart suggestions** ("3 apps stuck in Applied >30d — bump to Rejected?").
- **Filters in kanban**: slice by resume / company / source.
- **Animated card transitions** when stage changes (drag OR row trigger).
- ~~"Predicted" hatched cards~~ — deferred (L, post-launch).

#### Calendar (M)
- "Week ahead" focused view as the default (vertical 7-day strip).
- Quick-add deadline by clicking an empty day.
- Interview prep blocks auto-suggested before scheduled interviews.
- Stage-change overlay dots on dates.
- iCal export ("Subscribe to your HireTrail calendar").

#### AI Tailor page (M)
- **Side-by-side diff** (before/after columns). Currently shows suggestions but not the actual diff visually.
- **Bulk actions**: Accept all / Reject all / Accept top N.
- **Suggestion impact score**: "+2.4 to your fit estimate" per suggestion.
- **Re-tailor with different model** dropdown.
- **Cost transparency**: "$0.04 used on this analysis" for BYOK users.
- **Save tailoring as template** (longer-term, L).

#### Profile / Master Profile (L)
- **Live resume preview** side-by-side. The form on the left, a rendered preview on the right that updates as you edit. **This would be the launch screenshot.** Large effort.
- **Skill cloud** — visual skill frequency from experiences. Click a skill to see roles that use it.
- **Coverage meter** ("78% complete — add 2 projects to unlock better AI tailoring").
- **Experience timeline** visualization (horizontal bars).
- ~~Bulk import from LinkedIn~~ — deferred (L, requires OAuth or scraping).

#### Import / Export (M)
- **Drag-drop with live CSV preview**.
- **Smart column mapping** with confidence scores ("Your column 'job_title' → our 'role'?").
- **Conflict resolution UI** for duplicates.
- **Templates** for popular sources: Simplify export, LinkedIn data download, Notion table.

#### Settings (S)
- **Categorized + searchable**: page already has sectioned tabs; search box not added yet.
- **Theme picker with live preview** (hover a theme → page tints; click to lock).
- **Connected integrations card** improvements: show last-sync timestamp per integration.

### Cross-cutting NOT done

- **Onboarding tour (M)** — first-run tooltips walking new users through Applications → Kanban → Add → Resumes. Pause-able. Skippable.
- **Sample-data toggle (M)** — signed-out demo mode: visitors play with seeded data without account. Critical for OSS launch conversion. Probably the highest-impact unshipped item for the landing page funnel.
- **Mobile-responsive sweep (L)** — most pages probably break under 640px. Will need page-by-page.
- **OG image for landing (S)** — a beautiful screenshot of the new Applications row for LinkedIn shares.
- **Bundle code-splitting next pass (S)** — main chunk is still 1.3MB. Splitting react-chartjs-2 + react-grid-layout into a separate lazy chunk would shave 200kB+.
- **Performance: virtualize long lists** — if users hit 500+ applications, the Applications page slows. Use `react-window`.
- **Internationalization scaffolding (M)** — currently English-only.

### Known bugs / risks NOT addressed

- **L-1**: One-frame toast border flash on first render. Cosmetic, low priority.
- **L-2**: `DashboardHero` (now removed) used naive `name.split(/\s+/)[0]` — for the "Maria Del Carmen → Maria" case. Re-add user-preferred-name when reviving any "Hi, {name}" surface.
- **L-7**: `<GlobalShortcuts />` is mounted only when `user` is truthy. The landing page doesn't get it. Verify intentional.
- **L-8**: `EmptyState` illustration uses `hsl(var(--primary))`. In extreme custom themes the gradient may clash with the surrounding card. Cosmetic.
- Bundle warning >500kB still present — splitting more aggressively or using `rollupOptions.output.manualChunks` would silence it.
- No global error-monitoring (Sentry / Rollbar). When an exception fires in prod it goes to the void. Recommend wiring before LinkedIn launch.
- No E2E tests. Only co-located node tests for two pure utils (`applicationHealth`, `jdExtractor`) and 5 extension tests. Adding Playwright smoke tests for "create application", "open detail", "tailor flow" would protect against regressions during fast iteration.

### Tech debt / quality items

- TypeScript strict mode — confirm `strict: true` is on across both tsconfigs.
- A11y audit — focus order, WCAG AA contrast, screen-reader pass.
- Pagination of contacts (currently `limit: 500` everywhere — fine for now, but won't scale).
- Server-side telemetry — number of users, AI calls/day, error rates. Nothing in place.

---

## 5. Common pitfalls in this codebase (saves time)

- **Port 5173 collision**: the user has multiple Vite dev servers running locally. When the preview tool serves a different app than expected (e.g. "EssayGrader Pro"), it's a port conflict, not a code bug. Stop the preview server and confirm cwd before retrying.
- **Auth-gated previews**: most pages redirect to landing in the Claude Preview because there's no session. To verify a page visually, either:
  1. Spin up a temporary dev-only `/__preview` route under `App.tsx`, render the component with mock data, screenshot, then **delete the route**. (We did this for ApplicationRow.)
  2. Trust `tsc + vite build` if the diff is small.
- **HMR stale state**: edits during a session can leave stale React error overlays. If errors look weird, hard-reload the preview.
- **Form modal submit-on-dropdown** — any `<button>` inside a `<form>` defaults to `type="submit"`. Always set `type="button"` for non-submit buttons (dropdown triggers, icon buttons, etc.).
- **`useSearchParams`** — calling it twice in the same component is wasteful but not broken. Prefer one declaration up top + share.
- **Mongoose**: lean projections drop default-undefined fields. When adding new fields, also update any `.select(...)` calls that explicitly list fields.
- **Clearbit is dead** — don't add it back. `logo.clearbit.com` DNS is intermittent post-HubSpot acquisition. Google s2 favicons is the fallback we use.
- **`useFeatureFlags()` is a context hook** — must be inside `<FeatureFlagsProvider>`. Doesn't work in dev preview routes outside the auth shell.
- **Demo user is identified by `email === "demo@hiretrail.com"`**. Skip background work for that user (we skip auto-analyze).
- **The extension uses `https://hiretrail.manavkaneria.me/api` hardcoded** in `extension/background/background.js` and `extension/popup/popup.js`. Don't deploy the extension pointing at a local dev backend.

---

## 6. Critical files / one-paragraph "what is this"

- **`frontend/src/App.tsx`** — root router + lazy-loaded routes + module-preload after auth. Be careful when adding routes; keep the lazy/eager split intentional.
- **`frontend/src/components/Layout/Layout.tsx`** — page shell, sidebar overlap, `fullWidth` route allowlist. Currently full-width: `/`, `/kanban`, `/calendar`, `/profile`, `/tailor`. Everything else caps at 1200px.
- **`frontend/src/pages/Applications/Applications.tsx`** — most complex page. Uses `useApplicationsListState`, `ApplicationRow`, `ApplicationDetailSidebar`, `AiAnalysisSidebar`. Three deep-link param handlers (`?focus`, `?new`, `?stage` — last one is pending). Be very gentle with edits here.
- **`frontend/src/pages/Applications/ApplicationDetailSidebar.tsx`** — OVERLAY chrome ONLY now. Content lives in `components/ApplicationDetailBody.tsx`. The body is reusable; the chrome isn't.
- **`backend/src/routes/applications.ts`** — POST triggers JD extraction + auto-analyze + logo fetch. Read carefully before changing the create flow.
- **`backend/src/services/ai/autoAnalyze.ts`** — single canonical analyze worker. Used by both `/tailor/analyze` route and on-create trigger. Has concurrency + daily cap.
- **`extension/background/background.js`** — all extension network calls go through here. `TRACK_JOB`, `TAILOR_INIT`, `ANALYZE_JD`, `GOOGLE_LOGIN`, etc. Authoritative source of extension behavior.

---

## 7. Quick start for a new session

1. Read this file end-to-end.
2. Skim `README.md` for the product pitch.
3. Run `npm run build` in `/frontend` to confirm a clean baseline (should be ~2-3s, 1.3MB main chunk).
4. Run `cd backend && npx tsc --noEmit` for backend type-check.
5. Read the user's latest message carefully. Ask 1–4 clarifying questions if scope is fuzzy.
6. Plan with `TaskCreate` before any substantial change.
7. After completing each phase: `tsc + vite build + extension tests` + self-audit list.

---

## 8. Things the user has explicitly opted out of (don't propose these)

- Anything Clearbit-related.
- A persistent right-detail-panel on the Applications page (he tried it and reverted — full-width row + click-to-overlay-sidebar is the chosen pattern).
- The "Hero today" strip on the Dashboard + the "What needs your attention" list — both were built and removed. Dashboard widgets stay in the movable grid.
- The bespoke `AnimatedFunnel` on Dashboard — the existing chart.js `FunnelWidget` is the canonical visualization.
- Outlook integration (gated behind feature flag, "Coming soon" visible to users).
- Network graph view for Contacts — deferred to post-launch.
- A/B compare view for Resumes — deferred to post-launch.
- "Predicted" hatched cards on Kanban — deferred to post-launch.

If he changes his mind on any of these, that's fine — just don't propose them unprompted.

---

## 9. The launch context

He's launching on LinkedIn. The North Star is: **a single screenshot of HireTrail that stops a scroll.**

The current strongest candidates for that screenshot:
1. Applications page with the 3-rail row (logo / role + chips / Pipeline Pulse / blue AI Fit). Already shippable.
2. A future "live resume preview" on the Profile page (not yet built). Would be the most distinctive.
3. A future Contacts network graph (deferred).

When making UI decisions, ask: "does this make the screenshot more remarkable?" If yes, prioritize. If it's polish that won't show up in a screenshot, deprioritize until launch is closer.

---

*Last updated: this session. Append a dated line below when you change major facts so future sessions see the trail.*

- 2026-05 — initial handoff written. Applications redesign Phase A complete. Persistent split-panel reverted; page capped at 1200px.
