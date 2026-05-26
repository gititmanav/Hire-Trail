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

Effort: **S** ≈ <1h, **M** ≈ a few hours, **L** ≈ a day+.

### Cross-app consistency principle (read first)

When you change how a primary resource behaves (contacts, deadlines, resumes, companies, applications), propagate the change to **every surface that touches it**, not just the page that owns it. The Create-Application modal in particular embeds contact picking, deadline scheduling, and resume linking — a feature added to the Contacts page that doesn't also work in the Add-Application flow will feel half-built.

Audit checklist before declaring a cross-cutting change "done":
- Create / Edit Application modal (`pages/Applications/*`)
- Application detail body — used by the overlay sidebar and reusable elsewhere (`pages/Applications/components/ApplicationDetailBody.tsx`)
- The standalone page for the resource itself (Contacts, Deadlines, Companies, Resumes)
- Kanban quick-add and inline cards
- Dashboard widgets that surface the resource
- The Tailor page where contacts/resumes get attached to drafted apps

### Dashboard
- **Hero "Today" strip (M)** — one bold sentence at the top: "You have 2 interviews this week and 3 follow-ups overdue." Each clause click-throughs to the right filtered view.
- **"What needs your attention" list (M)** — top-priority actions sorted by urgency. Each item is a one-line card with a CTA ("Send follow-up to Stripe (12d since last)" → opens a compose surface). This becomes the homepage; everything else is supplementary.
- **Pipeline funnel that animates (S)** — real-time funnel chart with stage counts. Click a stage → jump to filtered Applications.
- **Streak / momentum indicator (S)** — "8 days of activity this month." Playful, motivating, differentiator vs. competitors.
- **Weekly capacity meter (S)** — "12 applications this week / your goal: 15." Helps users gamify their job search.

### Kanban
- **WIP-style stage stats (S)** — "Avg 8d in OA" under each column header. Industry benchmark comparison.
- **Card density toggle (S)** — mini / regular / detailed. Mini = one line + logo.
- **Smart suggestions (M)** — "3 apps stuck in Applied for >30d — bump to Rejected?" bulk-archive prompt.
- **Filters in the kanban (S)** — slice by resume / company / source.
- **Animated card transitions (S)** — animate stage moves whether the trigger is drag OR a row action elsewhere.
- **"Predicted" hatched cards (L)** — faint placeholder card on the next column where the row is likely to land based on history. Removed when the stage actually changes.

### Deadlines
- **Apply the row redesign here (M)** — same icon-led structure as Applications: type icon · linked-application logo · countdown chip · status · quick-action CTA.
- **Smart grouping (S)** — Today / Tomorrow / This Week / Later / Overdue, with sticky section headers.
- **Snooze with quick options (S)** — right-click → "Snooze 1 day / 3 days / next Monday."
- **Auto-complete suggestions (M)** — when a stage advances on a linked app, prompt "Mark related deadline complete?" Closes the loop between app stage changes and the deadline tracker.
- **Recurring deadlines (M)** — "Follow up every 2 weeks until response."

### Contacts
- **Apply row redesign + icon grid (M)** — same treatment as Applications. Each row: avatar / monogram, name, role at company, outreach-status badge, days-since-last-contact age, "send follow-up →" CTA.
- **Contact strength score (M)** — small 0–100 derived from recency of contact + response rate + LinkedIn connection + introduced applications. Jobright-style differentiator.
- **Network graph view (L)** — force-directed graph: contacts as nodes, companies as bigger nodes, edges show "works at." Toggle between list and graph view. Could be the launch screenshot.
- **Outreach templates (M)** — pre-built follow-up email templates personalised with contact data. One-click "Copy email to clipboard."
- **LinkedIn quick-actions (S)** — open LinkedIn profile in a new tab from the row.

### Companies
- **Logo-first card grid (M)** — big logos (Cloudinary cache exists), apps count, status breakdown bar.
- **"Contacts at this company" chip (S)** — inline avatars (up to 3) per company card.
- **Quick-jump links (S)** — Glassdoor / Levels.fyi / Blind / careers page; one-click external research.
- **Company timeline (M)** — lifetime stage history at this company ("Applied 3 times: Rejected, Interview, Offer"). Tells the story of your relationship with the company.
- **Compensation memory (M)** — aggregate of every salary seen for this company. Useful at negotiation time.

### Resumes
- **PDF preview thumbnails (M)** — show the actual resume as a small image preview (`pdfjs-dist` page → canvas → Cloudinary).
- **Performance metrics per resume (M)** — response rate, OA rate, interview rate. Highlights your best performer.
- **A/B comparison view (L)** — pick 2 resumes, see their stats side-by-side. Differentiator.
- **"Tailored from..." relationships (S)** — when a tailored resume is generated, show which base resume it descends from. Tree view.
- **Version timeline (S)** — history of edits.

### Profile (Master Profile)
- **Live resume preview (L)** — right side shows a rendered preview that updates as you edit on the left. The form on the left, the artifact on the right. **The launch screenshot candidate.**
- **Skill cloud (M)** — visual skill frequency from experiences. Click a skill to see which roles use it.

### Settings
- **Categorized + searchable (S)** — sections Account, Integrations, AI, Notifications, Appearance. Add a search box at the top of the page that filters/highlights inside each section.
- Constraints for the Integrations card (do NOT regress these — they're already shipped):
  - Outlook stays disabled with a "Coming soon" pill (gated behind `feature_outlook_integration`).
  - We do **not** have a Calendar provider — don't add a Calendar row.
  - Gmail is in Google's OAuth test-mode; clicking Connect Gmail still shows a "Request access" affordance that opens the existing FeedbackModal pre-filled, so the admin can add the user to the Google Cloud Console test-user list manually.

### Cross-cutting (everywhere)
- **Onboarding tour (M)** — first-run tooltips for new users ("Click here to add your first application"). Pause-able, skippable.
- **Skeleton loaders everywhere (S)** — consistency across every list/page that fetches on mount.
- **Mobile-responsive sweep (L)** — most pages break under 640px. Page-by-page audit.
- **Bundle code-splitting next pass (S–M)** — main chunk is still 1.3 MB. Split chartjs + react-grid-layout into a lazy chunk; lazy-load Tailor sub-routes; consider splitting Admin off the main chunk. Target sub-1 MB first paint.
- **Virtualize long lists (M)** — `react-window` once any user hits 500+ applications.

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
- Outlook integration as a real Connect button (stays gated behind `feature_outlook_integration` with a "Coming soon" pill until the OAuth app is wired up).

> Note: the Dashboard "Hero today" strip, "What needs your attention" list, animated pipeline funnel, Contacts network graph, Resumes A/B view, and Kanban "predicted hatched cards" were all previously deferred but are now **in scope** (see Section 4). Earlier reverts were about the *implementation*, not the *idea* — when rebuilding these, treat the prior versions as cautionary tales (especially: don't make them feel decorative).

---

## 9. The launch context

He's launching on LinkedIn. The North Star is: **a single screenshot of HireTrail that stops a scroll.**

The current strongest candidates for that screenshot:
1. Applications page with the 3-rail row (logo / role + chips / Pipeline Pulse / blue AI Fit). Already shippable.
2. The "live resume preview" on the Profile page (Section 4 — not yet built). Would be the most distinctive.
3. The Contacts network graph (Section 4 — not yet built). Dense, visual, recognisably HireTrail.

When making UI decisions, ask: "does this make the screenshot more remarkable?" If yes, prioritize. If it's polish that won't show up in a screenshot, deprioritize until launch is closer.

---

*Last updated: this session. Append a dated line below when you change major facts so future sessions see the trail.*

- 2026-05 — initial handoff written. Applications redesign Phase A complete. Persistent split-panel reverted; page capped at 1200px.
- 2026-05-25 — Section 4 rewritten as Manav's authoritative scope list (Dashboard / Kanban / Deadlines / Contacts / Companies / Resumes / Profile / Settings + cross-cutting). Calendar, AI Tailor page enhancements, Import/Export, Sample-data toggle, OG image, i18n, the bug-register, and the tech-debt list were dropped to keep the file focused on the active scope. Section 8 trimmed accordingly: Hero strip, attention list, animated funnel, Contacts network graph, Resumes A/B view, and Kanban predicted cards are no longer opt-outs — they're in scope. Section 1 already covered the working-with-Manav guidance; the new "Cross-app consistency principle" at the top of Section 4 is the additional norm to read first when touching shared resources.
- 2026-05-25 — Demo-user AI gating shipped: `frontend/src/hooks/useDemoGate.tsx` + `requireRealAccount()` wired into Profile resume parse, Resumes "Sync to Profile", Tailor "Analyze JD", Settings Gmail/Outlook connect + Scan now, AISettingsCard "Save key", Settings Profile-Sync toggle. AuthModal gained an optional `contextHeader` prop for the upgrade banner. Demo data window moved to 2026 (Jan 1 → today for apps; Jan 1 → Jul 31 for deadlines) in `backend/src/utils/seedData.ts`; `backend/src/seed.ts` is now a thin shell around `runSeed` so CLI + admin produce identical data. Mock A–F fit scores were already part of `seedData.ts` — no change there, but re-seed required for them to appear on the demo account.
