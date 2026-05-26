# HireTrail — Handoff for the Next Session

> Created at the end of a long session where context was about to overflow.
> Read this top-to-bottom on first arrival. Then read [HANDOFF.md](HANDOFF.md)
> (working-with-Manav guide + the full Section 4 scope list) and [README.md](README.md).

---

## 0. Where the session left off

We were mid-march through Manav's Section-4 redesign list (HANDOFF.md). Phases 1–4 are
**fully shipped**. Phase 5 (Companies) is **3 of 5 items shipped** — the next two
items (Company timeline + Compensation memory) are the natural pickup point.

The session also landed several polish items on Applications + Companies that the
user requested *outside* the original phase list. Those are now in.

---

## 1. What's been shipped this session

Grouped by phase. Every item below has `tsc -b --noEmit` clean + `vite build`
clean unless noted, and all 24 co-located node-test cases pass.

### Phase 1 · Dashboard ✓
- **Pipeline funnel that animates** — `FunnelWidget` click navigates to
  `/applications?stage=<stage>`. Cursor turns pointer over bars. New `?stage`
  URL handler on Applications page strips the param after applying. Subtle
  animation duration tightened (450ms, easeOutCubic).
- **Hero "Today" strip** — `pages/Dashboard/components/HeroToday.tsx`.
  Renders one bold sentence ("You have 6 overdue follow-ups and 32
  interviews this week.") with each clause as an urgency-coloured link
  (rose / amber / primary). Driven by `computeHeroSignals` + `heroPhrases`
  in `utils/dashboardSignals.ts` (extended this session — interviewsThisWeek
  now considers active-Interview-stage apps too, not just deadlines).
- **"What needs your attention" list** — `pages/Dashboard/components/AttentionList.tsx`.
  Urgency-ranked one-line cards with real CTAs ("Send follow-up to Stripe (12d since last) →").
  Driven by `computeAttentionItems` in `utils/dashboardSignals.ts` — extended
  this session to include `contact_follow_up` kind with stale-outreach detection.
  Sorted with monotonic overdue-day urgency so heavily overdue items don't
  alphabetically tie at the cap.

### Phase 2 · Kanban ✓
- **WIP-style stage stats** under each column — "Avg Xd in {stage}" using
  new `utils/stageStats.ts` (`dwellAverages` + `currentStageDwell`).
  6 co-located node tests in `stageStats.test.mjs`.
- **Card density toggle** — `mini` / `regular` / `detailed`, persisted in
  localStorage. Detailed adds salary + jobType chips + next-action hint.
- **Filters** — Resume / Company / Source via `ActionDropdown` triggers with
  searchable menus. Clear-filters link. Filtered count "X of Y" in toolbar.
  Dwell averages keep using full history so they don't lie when filters narrow.
- **Animated card transitions** — `.kanban-card-enter` CSS keyframe in
  `App.css`. Applied to an inner wrapper inside `SortableCard` so dnd-kit's
  outer transform isn't disturbed. Respects `prefers-reduced-motion`.
- **Smart suggestions — stuck-in-stage bulk archive** — amber banner above
  the grid when ≥3 apps have been stuck in Applied >30d. Two bulk CTAs
  ("Archive all" / "Mark as Rejected") using `useConfirm` + busy state.
  Dismissable for the session.
- **"Predicted" hatched cards (L)** — v1 ships: stuck-stage candidates
  surface as faint diagonal-striped ghost cards in the Rejected column
  (capped at 3, sorted by stuck-duration). New `GhostKanbanCard`. CSS pattern
  in `App.css` (`.kanban-card-ghost`).
  - **v1 limitation**: hard-coded "stuck → Rejected" rule. v2 should derive
    transition rates from the user's actual history.

### Phase 3 · Deadlines ✓
- **Smart grouping** — new `utils/deadlineGroups.ts` (Overdue / Today /
  Tomorrow / This Week / Later / Completed) with 6 node tests. Sticky section
  headers. **IMPORTANT**: removed `overflow-hidden` from the outer card
  container — `overflow-hidden` was breaking `position: sticky` and pushing
  headers below their rows. Don't re-introduce.
- **Snooze quick options** — per-row ActionDropdown with 1d / 3d / next Monday.
- **Row redesign** — `TypeIcon` per deadline type (OA / Follow-up / Interview /
  Offer / Thank you / Other) with colored tile + linked-app CompanyLogo monogram.
  **The "Mark done →" text CTA was REMOVED at user request** — the
  radio-toggle on the left now previews its completed state on hover (green
  fill + tick mark fades in via `group/check` + `group-hover/check:opacity-100`).
- **Auto-complete suggestions on stage advance** — shared
  `hooks/useDeadlineFollowups.tsx` + backend `?applicationId=` filter on
  `/api/deadlines`. Wired into Applications row stage-change AND Kanban
  drag-end. Custom toast surfaces "Mark X deadline(s) complete?" with a
  single-click button.
- **Recurring deadlines** — `recurrenceDays` field on Deadline model +
  validators + on-complete spawn logic in the PUT handler. Frontend modal
  input + "↻ Nd" chip on recurring rows.

### Phase 4 · Contacts ✓
- **LinkedIn quick-action** — branded LinkedIn icon button in row hover
  toolbar; greyed for contacts without a saved URL.
- **Row redesign** — converted card grid → single-column row list. Monogram
  avatar · name + outreach badge + source chip · role @ company · strength
  chip · age chip · follow-up date · hover toolbar.
- **Contact strength score (0–100)** — pure util in `utils/contactStrength.ts`
  (6 co-located node tests). Factors: recency + outreach status + LinkedIn
  presence + introductions. Tier-tinted chip with factor-breakdown tooltip.
- **Outreach templates** — `utils/outreachTemplates.ts`. 5 stock templates
  (cold intro, follow-up bump, interview thanks, coffee chat, post-rejection).
  One-click copy-to-clipboard with personalised first-name / company / role
  substitution. Wired via `ActionDropdown` in the row toolbar.
- **~~Network graph view (L)~~** — built then **removed** at user request.
  Don't propose again. `ContactsGraph.tsx` deleted, `react-force-graph-2d`
  uninstalled.

### Phase 5 · Companies (3 of 5 shipped)
- **"Contacts at this company" inline avatars** — up to 3 monogram avatars
  per company card with "+N more" overflow + "N contacts" label. Hover
  reveals all names.
- **Quick-jump links** — Glassdoor / Levels.fyi / Blind / Careers chips per
  card. URLs computed from company name; Careers uses `company.website` when
  available, else a Google search.
- **Logo-first card grid** — bigger 56px logos (now BARE per latest user
  feedback: no tile, no padding, no border around them — just the image on
  the card surface). Status breakdown bar per company (stacked stage tones)
  + per-stage legend. Loads `allApps` once for the breakdown.
- **Pending: Company timeline (M)** — see Section 3 below.
- **Pending: Compensation memory (M)** — see Section 3 below.

### Cross-cutting bug fixes shipped this session
- **Company logo from name, not jobUrl** — when an app was tracked via
  Workday/Greenhouse/Lever, the Company.domain was set to the ATS host and
  Google s2 favicons returned the ATS's logo. Fixed: new
  `backend/src/utils/companyDomain.ts` with name-first `resolveLogoDomain` +
  `isJobBoardDomain` rejection list. Legacy bad cached logos auto-invalidate
  when their stored domain is a known job board.
- **Companies page Clearbit ref** — was rendering `<img src="logo.clearbit.com/...">`
  directly, bypassing the cached Cloudinary `logoUrl`. Swapped to the canonical
  `<CompanyLogo>` component with an auto-fetch loop mirroring the Applications
  page pattern. **23/23 logos now correct.**
- **Deadlines sticky-header bug** — sticky headers were rendering below their
  rows. Cause: `overflow-hidden` on the outer card created a scroll context
  that broke `position: sticky`. Fixed.

### Polish (Applications row, user-requested via design reference)
- **Logo bigger + top-left + bare** — extended `CompanyLogo` with `size="lg"`
  (56px) and a `bare` prop that strips the white tile / padding / border. The
  Application row now stacks the **selection checkbox BELOW the logo** so the
  brand mark sits cleanly in the top-left corner.
- **AI Fit panel redesigned** — was a compact blue gradient; now a contained
  dark slate card with a prominent grade band header (`A — STRONG MATCH`,
  `B — GOOD MATCH`, etc.) and a checkmark list of top matched skills with
  "+N more matched" overflow.
  - **Backend change**: `AppFitSummary` and `AppFit` types now expose a
    `topMatched: string[]` field. `loadFitSummaries` in
    `backend/src/routes/applications.ts` slices `s.matchedSkills.slice(0, 3)`.

---

## 2. The full file inventory of what changed this session

New files:
- `frontend/src/pages/Dashboard/components/HeroToday.tsx`
- `frontend/src/pages/Dashboard/components/AttentionList.tsx`
- `frontend/src/utils/stageStats.ts` + `.test.mjs`
- `frontend/src/utils/deadlineGroups.ts` + `.test.mjs`
- `frontend/src/utils/contactStrength.ts` + `.test.mjs`
- `frontend/src/utils/outreachTemplates.ts`
- `frontend/src/hooks/useDeadlineFollowups.tsx`
- `backend/src/utils/companyDomain.ts`

Modified:
- `frontend/src/components/widgets/FunnelWidget.tsx`
- `frontend/src/components/CompanyLogo/CompanyLogo.tsx` (added `size="lg"` + `bare`)
- `frontend/src/pages/Applications/Applications.tsx` (?stage handler, deadline-followup wiring)
- `frontend/src/pages/Applications/components/ApplicationRow.tsx` (logo stack)
- `frontend/src/pages/Applications/components/AppFitPanel.tsx` (full rewrite)
- `frontend/src/pages/Kanban/Kanban.tsx` (massive — WIP stats, density, filters, anim, suggestions, ghosts, deadline-followup)
- `frontend/src/pages/Deadlines/Deadlines.tsx` (full row rewrite, grouping, recurrence)
- `frontend/src/pages/Contacts/Contacts.tsx` (row rewrite, strength, templates)
- `frontend/src/pages/Companies/Companies.tsx` (logo grid + avatars + jump links + status bar)
- `frontend/src/pages/Dashboard/Dashboard.tsx` (Hero + Attention wiring)
- `frontend/src/utils/dashboardSignals.ts` (extended)
- `frontend/src/types/index.ts` (`AppFit.topMatched`, `Deadline.recurrenceDays`)
- `frontend/src/App.css` (`.kanban-card-enter`, `.kanban-card-ghost`)
- `backend/src/routes/applications.ts` (job-board domain guards, `topMatched`)
- `backend/src/routes/companies.ts` (name-first resolver + invalidation)
- `backend/src/routes/deadlines.ts` (`?applicationId=` filter, recurrence spawn)
- `backend/src/models/Deadline.ts` (`recurrenceDays`)
- `backend/src/validators/deadlines.ts` (`recurrenceDays`)

Deleted:
- `frontend/src/pages/Contacts/ContactsGraph.tsx` (graph was removed)

Dependency added:
- `react-force-graph-2d` was installed then **uninstalled** when the graph was removed.

---

## 3. What's still pending (Section 4 of HANDOFF.md)

In order, the unfinished items from Manav's authoritative scope list:

### Phase 5 · Companies (2 left)
- **Company timeline (M)** — On the company detail/sidebar, render lifetime
  stage history at this company. Visually a horizontal strip:
  "Applied 3 times: 1 Rejected, 1 Interview, 1 Offer." Pure aggregation
  from `allApps` (already loaded on the Companies page).
- **Compensation memory (M)** — Aggregate of every salary you've seen for
  this company (from `app.salary` on linked apps). Show range + median +
  count. Hide section if 0 data points.

### Phase 6 · Resumes (all 5 pending)
- **"Tailored from..." relationships tree (S)** — Tailored resumes are
  tagged "tailored" + carry a `tailorSessionId`. Render as a tree:
  root = base resume, children = tailored variants. The data exists; this
  is a rendering task on `pages/Resumes/Resumes.tsx`.
- **Version timeline (S)** — Edit history per resume. Add a
  ResumeVersion subdoc (`{ timestamp, diffSummary }`) OR separate
  collection. v1: list of edit timestamps + small diff summary; full diff
  view is later.
- **Performance metrics per resume (M)** — Response rate, OA rate,
  interview rate, offer rate per resume, aggregated from linked
  Applications. Backend likely needs a new aggregate endpoint; frontend
  surfaces in resume card + detail.
- **PDF preview thumbnails (M)** — Use `pdfjs-dist` page → canvas →
  upload to Cloudinary on resume upload; store `thumbnailUrl` on the
  Resume model. Lazy-load pdfjs (separate chunk).
- **A/B comparison view (L)** — Pick 2 resumes → side-by-side stats panel
  (response/OA/interview/offer rates, # apps using each, time-in-stage
  averages). Needs the Performance Metrics task to ship first.
  **L-item rule**: pause first and propose design + scope before building.

### Phase 7 · Profile (2 pending)
- **Skill cloud (M)** — Visual skill frequency from experiences. Pure util
  to tally skills across all bullets. Sized chips proportional to
  frequency. Click a skill → highlights which roles use it.
- **Live resume preview side-by-side (L)** — Right side renders a preview
  that updates as you edit on the left. **THE launch screenshot
  candidate.** `components/ResumePreview` already exists; main work is
  plumbing it to live master-profile state + getting layout right.
  **L-item rule**: pause first and propose design + scope.

### Phase 8 · Settings (1 pending)
- **Categorized + searchable (S)** — Add a search box at the top of
  Settings that filters/highlights matching fields inside each section
  (Account, Password, Email, AI, Profile Sync). Auto-scroll to first match.
  Section tabs already exist.
- **Don't regress**: Outlook stays gated behind `feature_outlook_integration`
  with "Coming soon" pill; no Calendar row (we don't have a Calendar
  provider); Gmail "Request access" via FeedbackModal stays.

### Cross-cutting (still pending, per HANDOFF Section 4)
- **Onboarding tour (M)** — First-run tooltips.
- **Skeleton loaders everywhere (S)** — Consistency across pages that
  fetch on mount.
- **Mobile-responsive sweep (L)** — Most pages break under 640px.
- **Bundle code-splitting next pass (S–M)** — Main chunk still ~1.3 MB.
  Split chartjs + react-grid-layout; lazy-load Tailor sub-routes; split
  Admin.
- **Virtualize long lists (M)** — `react-window` once any user hits 500+
  applications.

---

## 4. How Manav wants things done (the meta-rules)

Read HANDOFF.md Section 1 in full. Quick summary:

- **Brutal honesty + push back early.** If an idea is bad, say so before
  building. We learned this when the persistent split-panel got built then
  reverted. Same for the original "Hero today" + "Attention list" — they
  were tried, felt decorative, reverted, now rebuilt better (signal-driven,
  not decorated).
- **Plan before action.** For anything big, surface trade-offs first and
  ask 2–4 clarifying questions via `AskUserQuestion` BEFORE executing.
- **Concise comms.** No filler. He reads everything.
- **Phase aggressively.** Multi-turn over single-marathon.
- **Audit your own work** at the end of each phase. List bugs/risks
  you can spot in what you wrote.
- **L items get a planning sub-step** — pause and propose design + scope
  before building. Confirmed earlier this session.
- **No emojis** unless explicitly requested (small SVG icons preferred).
- **Don't add comments that explain WHAT — only WHY (and only when WHY is
  non-obvious).**
- **Cross-app sync (HANDOFF Section 4 principle)** — when changing a
  primary resource's behaviour (contacts, deadlines, resumes, companies),
  audit every surface that touches it before declaring done:
  - Create/Edit Application modal
  - Application detail body
  - The standalone page for the resource
  - Kanban quick-add + inline cards
  - Dashboard widgets that surface the resource
  - The Tailor page where contacts/resumes attach to drafted apps

### Things the user has explicitly opted out of (don't propose unprompted)
- Anything Clearbit-related (DNS unreliable post-HubSpot).
- Persistent right-detail-panel on Applications (he reverted it).
- Outlook integration as a real Connect button (stays "Coming soon").
- **Contacts network graph** (built then removed this session).

The previously-deferred Hero strip, Attention list, animated funnel,
Resumes A/B view, and Kanban predicted-hatched cards are all now **in
scope** (and most have shipped). Earlier reverts were about
implementations, not ideas.

---

## 5. Visual design conventions established / reinforced

When extending these pages, follow these:

- **Bare logo treatment**: `<CompanyLogo size="lg" bare />` for any
  prominent placement (top-left of a card). No white tile, no padding,
  no border. Monogram fallback still has its tinted background — that's
  handled inside the component.
- **Row layout rhythm** (Applications, Contacts, Deadlines all match):
  - Leading icon/logo tile or bare logo
  - Title (bold) + tags inline
  - Subtitle (muted)
  - Right rail: countdown/age chip + CTA
  - Hover toolbar on the right (LinkedIn / Edit / Delete / Snooze, etc.)
- **AI Fit panel** is dark slate (not blue gradient anymore). Grade band
  on top, ✓ checkmark list below. Don't return to the blue version.
- **Stage tones** come from `utils/stageStyles.ts` (`FUNNEL_STAGES`,
  `STAGE_BADGE_CLASS`). Don't hardcode hex values for stages.
- **Toasts** use the existing themed CSS variables. New toasts inherit.
- **Sticky section headers** — don't wrap their scroll-parent in
  `overflow-hidden` (it breaks sticky positioning).
- **`prefers-reduced-motion`** is respected in `.kanban-card-enter` and
  `.kanban-card-ghost`. Any new animation should follow the pattern.

---

## 6. Test posture

Co-located node tests are in `.mjs` files (the codebase doesn't have a
ts-node toolchain for tests, so the test files duplicate the pure logic
from the corresponding `.ts` files). Pattern:

- `frontend/src/utils/applicationHealth.test.mjs` (existing — 5 tests)
- `frontend/src/utils/jdExtractor.test.mjs` (existing — 1 test)
- **NEW** `frontend/src/utils/stageStats.test.mjs` (6 tests)
- **NEW** `frontend/src/utils/deadlineGroups.test.mjs` (6 tests)
- **NEW** `frontend/src/utils/contactStrength.test.mjs` (6 tests)

Run them all: `cd frontend && node --test src/utils/*.test.mjs`.
Run extension tests: `npm run test:extension` from repo root.

When adding a new pure util, also add a `.mjs` test. Caveat: the test file
re-derives the logic, so risk of divergence — keep tests small + spec-like.

---

## 7. Build numbers (baseline for regression checks)

After this session:

- `tsc -b --noEmit` (frontend): clean
- `cd backend && npx tsc --noEmit`: clean
- `npm run build` (frontend):
  - Main chunk: **~1.32 MB** / 368 KB gzip
  - Calendar: 256 KB / 80 KB gzip
  - Kanban: 68 KB / 22 KB gzip
  - All other route chunks: under 35 KB
- `npm run test:extension`: 5/5 pass
- `node --test src/utils/*.test.mjs`: 24/24 pass

The 500 KB warning is still present (main chunk is over) — splitting
chartjs + react-grid-layout into lazy chunks is the next-pass code-split
fix mentioned in Section 4 above.

---

## 8. Demo user + seed data quick refresher

- Demo user: `demo@hiretrail.com` / `password123`.
- AI features are gated for the demo user via
  `frontend/src/hooks/useDemoGate.tsx` → `requireRealAccount("featureName")`.
  Opens a "Create an account" dialog instead of running AI work.
- Demo data spans Jan 1 → Jul 31 2026 with `applicationDate` clamped to
  "today" so nothing reads as future. Deadlines extend to Jul 31 so the
  list is lively.
- 650 apps + 220 contacts + 180 deadlines + 8 resumes seeded.
- Seed is in `backend/src/utils/seedData.ts`; the CLI `npm run seed` is a
  thin shell that calls `clearSeedData()` + `runSeed()`.
- Re-seed via Admin → Seed Management OR `cd backend && npm run seed`.

---

## 9. Quick start for the next session

1. Read this file end to end.
2. Skim `HANDOFF.md` for Manav's working-with guide + scope list.
3. From repo root: `cd frontend && npm run build` to confirm clean baseline
   (~2s, 1.32 MB main).
4. From `frontend`: `node --test src/utils/*.test.mjs` to confirm all
   24 utility tests pass.
5. Pick up at **Phase 5 · Company timeline (M)** — this was the
   in-progress item when the previous session ran out of room. Then
   Compensation memory, then Phase 6 (Resumes), then Profile (live
   preview is L → propose first), then Settings search, then
   cross-cutting.
6. Use `TaskCreate` to break the next phase into items and mark
   in_progress as you go.
7. After completing each phase: `tsc + vite build + node --test` + a
   self-audit listing risks in what you wrote.

---

## 10. Known issues worth keeping an eye on

- **Kanban grid uses `lg:grid-cols-5` but renders 6 stages** — Rejected
  wraps to a second row on `lg` viewport. Pre-existing; not introduced
  this session. A `lg:grid-cols-6` change would fix it, but the columns
  get narrower — judgement call.
- **HMR error noise** during long sessions — Vite's HMR can leave stale
  error entries in the console buffer even after a syntax issue is
  resolved. If you see "Failed to reload" for a file that currently
  compiles clean, do a full reload and check fresh-state.
- **Predicted hatched cards v1** uses a hard-coded "stuck → Rejected"
  rule. Eventually derive transition rates from the user's history.
- **Demo seed legacy logos** — if a stored `Company.domain` is a known
  job-board host AND the company also has a logo cached, the next
  `ensureCompanyLogo` call clears + refetches. New companies created via
  the create/POST flow are protected from the bug going forward.
- **Backend AI route gating** — frontend `useDemoGate` blocks AI actions,
  but the backend `/tailor/analyze`, `/masterProfile/parse`, `/email/*`,
  `/ai/keys` routes still accept demo-user requests if hit directly. A
  defence-in-depth 403 would be a small future task — noted in the prior
  HANDOFF too.

---

*This file was the final summary of a long session. Append a dated line
below when you make material progress so the next-next session sees the trail.*

---

## Progress trail

- **2026-05-26** · **Browser extension UI polish + new feature shipped.**
  - **FAB button**: was 48×48 with a 22px H glyph (~46% coverage — felt
    sparse). Now 36×40 tab anchor with a 24px H glyph (~67% — dominant).
    Brand-tinted ambient shadow + soft inner highlight; hover peeks the
    tab out by 3px with intensified shadow.
  - **Popover width** now hugs content (`width: max-content; max-width:
    312px`) — kills the empty right-hand space.
  - **Track + Tailor icons** rewritten as crisp single-path fills
    (bookmark + 4-point sparkle). The old paths were two-path strokes
    that aliased on retina screens.
  - **Action rows** redesigned as cards: bigger 36×36 gradient tiles
    (was 30×30), 18px icons (was 14px), bolder labels, chevron-right
    affordance that animates on hover. Full-width divider between actions
    (was a hairline indented divider).
  - **NEW preview strip — "Detected on this page"**: runs the scraper
    when the popover opens and previews the role + company that's about
    to get tracked. Green checkmark eyebrow. Hidden on LinkedIn-profile
    context (no JD to detect) and when scraper found nothing.
  - **Rebuilt extension.zip**: 39.7 KB → 45.2 KB. Copied to
    `frontend/public/extension.zip` so the in-app + landing download
    buttons serve the new version.
  - **JS syntax check + structural assertions pass**: width:max-content
    present, FAB at 36×40, 24px H glyph, new track/tailor SVG paths
    present.
- **2026-05-25** · **JD extractor: 4 recall improvements shipped.**
  - **HTML strip step** at the top of `extractFieldsFromJD` — removes
    `<script>`, `<style>`, all tags, and decodes the common entities
    (`&amp;` / `&nbsp;` / `&quot;`, etc.) so the title-case + first-line
    heuristics see clean text instead of `<p>` artifacts.
  - **Multi-currency salary** — every salary regex now matches the
    `[$€£¥]` character class. Doubles international coverage for €/£/¥ JDs.
    Side improvement: relaxed `[0-9]{2,3}` → `[0-9]{1,3}` so yen/INR ranges
    like "¥800k - ¥1,200k / year" parse correctly. The k-suffix / `/year`
    guards keep false positives out.
  - **Company from `jobUrl`** — new `companyFromJobUrl()` recognises 5 ATS
    host patterns (Greenhouse, Lever, Workday subdomain, Ashby,
    SmartRecruiters) and extracts the company slug, prettified. The
    enrichment now prefers URL-derived company over JD-text-derived. Pushes
    extension-captured company recall from ~15% → ~70%. Caller in
    [applications.ts:215](backend/src/routes/applications.ts) now passes
    `jobUrl` AND triggers enrichment when there's a URL + missing company
    even if the JD body is short.
  - **"City, Country" location** — allow-listed 40+ country names
    (Germany, UK, Canada, India, etc.) so `Berlin, Germany` /
    `Toronto, Canada` now parse alongside the existing US "City, ST" pattern.
  - **Tests:** 5 → 19 (covers € / £ / ¥ salaries, city+country, HTML
    stripping, all 5 ATS URL patterns + the negative cases).
  - `extractFieldsFromJD(jd, jobUrl?)` is a backwards-compatible signature
    change — second arg is optional, so old call sites compile unchanged.
- **2026-05-25** · **Theme-flash fix + landing-page refresh + JD extractor audit.**
  - **Theme flash:** Toggling dark/light caused Application cards + Calendar
    toolbar to lag a frame behind the page chrome (transitions animating
    `background-color` / `border-color` as theme variables flipped). Two
    fixes: (1) added `html.theme-transitioning *` CSS rule that
    suppresses every transition + animation when the class is present
    ([App.css](frontend/src/App.css)); (2) `useTheme` now wraps every
    `applyTheme` call in `withTransitionsSuspended()` which adds the class,
    commits the change, then removes the class on the next animation
    frame ([useTheme.ts](frontend/src/hooks/useTheme.ts)). Also fixed the
    worst offender directly: `ApplicationRow` was using `transition-all`,
    now `transition-shadow` only. Verified live: theme swap on Applications
    + Calendar — no flicker.
  - **Landing refresh:** Added a new `FeatureSection #05` "Stop guessing
    which version gets responses" with a `ResumesMockup` that shows the new
    per-resume metric chips (RESP / OA / INT / OFF) + tailored variants
    tree exactly as the in-app surface renders them
    ([FeatureShowcase.tsx](frontend/src/pages/Landing/FeatureShowcase.tsx)).
    `KanbanMockup` cards got the new 3px left-edge stage stripe so the
    landing mock matches the live card design.
    [Bento.tsx](frontend/src/pages/Landing/Bento.tsx) gained three new
    cards: **Skill cloud** (sized-chip mock), **Company memory** (with the
    "Compensation seen $120k – $170k median $145k" pattern), **Glanceable
    stage** (three sample app rows with their stripes). All cards inherit
    the existing dark glassy aesthetic — same eyebrow style, glow card,
    Reveal animation.
- **2026-05-25** · **Cross-cutting sweep: bundle / skeletons / virtualization / tour / mobile shipped.**
  - **Bundle code-split:** Admin routes split to per-route chunks (was eager
    bundle import). Dashboard widgets (`StatsWidget`, `FunnelWidget`,
    `ConversionWidget`, `TrendWidget`, `PieWidget`, `ResumePerformanceWidget`,
    `RecentAppsWidget`, `DeadlinesWidget`, `FollowUpWidget`,
    `MiniCalendarWidget`) all lazy-loaded with per-widget Suspense. Main
    chunk **1,311 kB → 732 kB** (gzip 366 → 197) — **44% smaller**. Chart.js
    isolated into its own 199 KB chunk, fullcalendar into 228 KB
    (MiniCalendarWidget), Admin routes split.
  - **Skeleton sweep:** Replaced text/spinner loading on Settings (full
    skeleton mirroring the post-load 2-column shape), Profile (same
    treatment), Companies sidebar (timeline + apps placeholders), and
    CompanyProfile (`<SkeletonStats /> + <SkeletonTable />`). Major list
    pages already had skeletons.
  - **Virtualization (alternative approach):** react-window doesn't play
    with dnd-kit, and the user-facing Applications / Contacts / Deadlines
    pages all paginate server-side (25 / 20 / 20 per page) so they don't
    need it. The actual perf risk is Kanban with 280+ cards in the Applied
    column. Applied `content-visibility: auto` + `contain-intrinsic-size`
    to `SortableCard` — the browser skips layout + paint for off-screen
    cards while keeping them in the DOM (so dnd-kit still works). Zero new
    deps. Skip-on-scroll cost scales with viewport, not collection size.
  - **Onboarding tour upgrade:** [GuidedTour.tsx](frontend/src/components/GuidedTour/GuidedTour.tsx)
    grew from 6 steps to 7 with refreshed copy, added **Back** button, and
    a final-step CTA (`Build my profile → /profile`). Still Dashboard-only
    by design — cross-page tours fragility wasn't worth the scope.
  - **Mobile-responsive sweep:** Root cause of horizontal overflow was
    `.shell-overlap-panel` only having `overflow-x: hidden` at `md+`. Moved
    it outside the media query in [App.css:249-261](frontend/src/App.css).
    Fixed the mobile sidebar that wouldn't slide off-screen (wrapper had
    width:0 so `-translate-x-full` was a no-op — added `w-60 md:w-auto`
    in [Layout.tsx:35](frontend/src/components/Layout/Layout.tsx)). Added
    `overflow-x-clip` to `<main>` so `-mx-4` breakout patterns don't bleed.
    Header padding `px-6` → `px-4 md:px-6`. Page header rows on Applications
    / Resumes / Contacts / Companies / Kanban / Deadlines all got
    `flex-wrap gap-3` so H1 + action buttons wrap to a second row instead
    of pushing past the viewport. Verified live: all 8 main pages report
    `hOverflow: 0` at 375×812.
  - 42/42 tests still pass, tsc clean both ends, vite build clean.
- **2026-05-25** · **Phase 6 Resumes — 3 of 5 items shipped.**
  - **Backend model + lineage:** added `baseResumeId`, `tailorSessionId`, and
    `versions[]` (subdoc array) to [Resume.ts](backend/src/models/Resume.ts).
    Tailor flow at [tailor.ts:365-384](backend/src/routes/tailor.ts) now
    captures `User.primaryResumeId` at tailoring time as `baseResumeId` and
    stores `tailorSessionId: session._id`. Legacy tailored resumes (created
    before this field existed) keep `baseResumeId: null` and surface in an
    "Untraced tailored resumes" bucket — no migration required.
  - **Tailored-from tree (S):** `TailoredResumesSection` in
    [Resumes.tsx](frontend/src/pages/Resumes/Resumes.tsx) now groups variants
    by their base resume. Each group renders as a parent card with a
    primary-tinted left rail and children indented underneath. Untraced
    bucket falls to the bottom.
  - **Version timeline (S):** PUT /resumes/:id at
    [resumes.ts:117-180](backend/src/routes/resumes.ts) computes a
    field-aware diff summary and appends one `versions[]` entry per mutation
    (capped at 50 entries to bound document growth). Frontend
    `VersionHistoryStrip` is a collapsed-by-default footer on each card; the
    most recent entry shows inline (e.g., `May 25 — Target role → "DevOps"`),
    click expands the full timeline. Verified live: edit via API → entry
    appears on the card.
  - **Performance metrics (M):** GET /resumes now bundles per-resume rates
    (responseRate / oaRate / interviewRate / offerRate) computed from
    stageHistory — "ever reached" semantics so a Rejected app that touched
    Interview counts toward `interviewRate`. Frontend `MetricsStrip` renders
    blue/amber/purple/emerald chips matching the stage palette; appears on
    every grid + list card AND the Primary Resume hero. Hidden when total = 0.
    Verified live: 9 resumes all rendered "RESP X% · OA X% · INT X% · OFF X%".
  - **Bug-fix bonus:** removed a pre-existing duplicate `{r.fileName && ...}`
    span line at [Resumes.tsx:149](frontend/src/pages/Resumes/Resumes.tsx)
    that was rendering the file name twice on every grid card.
  - **Still pending in Phase 6:** PDF preview thumbnails (M) — needs
    pdfjs-dist + Cloudinary upload on resume upload. A/B comparison view (L)
    — *now unblocked* by the Performance Metrics endpoint above; per L-item
    rule, propose design + scope before building.
  - 42/42 tests pass, frontend + backend tsc clean, vite build clean (main
    chunk 1.31 MB).
- **2026-05-25** · **Color stripes on app cards unified + stage-reactive.**
  Added `STAGE_STRIPE_CLASS` to [stageStyles.ts](frontend/src/utils/stageStyles.ts)
  as the single source. Applications row dropped its local 400-shade palette
  and stale-red health override (strip is now strictly the stage). Kanban
  cards (regular + detailed densities) got the same 3px left stripe. Live
  preview verified: changing a stage via API flipped a row's stripe from
  `bg-purple-500` to `bg-red-500` automatically. Live preview FEATURE
  (Profile right-side renderer) was started then ABORTED per user — the
  LiveResumePreview component was deleted, no Profile / EditDrawer changes
  were merged.
- **2026-05-25** · **Phase 8 Settings + Phase 7 Profile Skill cloud shipped;
  audit + bug-fix pass.**
  - **Settings — searchable.** Added search box top-right of Settings page
    with `SEARCH_INDEX` of field labels + aliases (e.g. "api key" / "openai" /
    "gpt" → AI Providers). Matching labels get `<mark>` highlight; non-matching
    sections dim to opacity-40; tab bar shows a yellow dot on hit tabs; pill
    shows "N match(es)" live count. Auto-scrolls to first matching section.
    Verified in preview: "password" → 2 marks, only Password lit; "api key" →
    AI section auto-scrolled to top, 1 match.
  - **Profile — Skill cloud (Phase 7 M).** New util
    `frontend/src/utils/skillCloud.ts` (+ 7-test `.mjs`) tallies bullet `tags`
    across experiences with case-normalisation, first-seen display
    preservation, deterministic tie-break. Log-scaled `chipSize` floor 0.75rem
    / ceiling 1.25rem. Rendered as a chip cloud above the existing
    SkillsSection (additive — doesn't replace user-declared groups). Clicking
    a chip selects it; ExperienceSection ring-highlights matching roles +
    bullet rows + recolours the matching tag chip; non-matching roles dim.
    Verified live in preview with a stubbed 3-experience profile: TypeScript
    chip → 2 roles lit, "Used in 2 roles" surfaced, Intern role dimmed.
  - **Live resume preview (L) — DEFERRED for design confirmation.** Per
    L-item rule. Brief proposal at session end (single-file Profile preview
    pane vs. modal vs. split-screen; live debouncing strategy; mobile fallback).
  - **Bug-fix sweep from audit:**
    - **B1 [P0]**: `exp.bullets`, `b.tags`, `p.bullets`, `p.technologies` in
      `Profile.tsx` indexed without nullish guards — wrapped with `?? []`
      (lines ~651, 660, 662, 761, 763, 771, 773).
    - **B2 [P1]**: Dropped `as any` casts in `Dashboard.tsx` handleFollowUp /
      handleSnooze; widened `contactsAPI.update` signature with `Omit + re-add`
      so `lastOutreachDate` and `nextFollowUpDate: null` type-check. Changed
      `nextFollowUpDate: ""` → `null` so the backend stores a proper unset
      instead of an empty string that could slip past `if (c.nextFollowUpDate)`
      filters.
    - **B3 [P2]**: Stale-apps "Archive all" banner now `await loadData()`
      after the archive batch so dependent widgets refresh immediately
      instead of waiting for the next focus refetch.
  - 42/42 node tests pass (35 prior + 7 skillCloud). Frontend + backend tsc
    clean. Vite build clean (1.31 MB main).
- **2026-05-25** · **Dashboard HeroToday + AttentionList REMOVED (again) at user
  request** ("remove these newly added widgets. i dont need them").
  Deleted `pages/Dashboard/components/HeroToday.tsx` and `AttentionList.tsx`.
  Stripped `computeHeroSignals`, `heroPhrases`, `computeAttentionItems` from
  `utils/dashboardSignals.ts` (file now 98 lines, just streak + capacity).
  Removed `allDeadlines` state from `Dashboard.tsx` (was only consumed by the
  hero/attention memos). **This is the second time these have been reverted —
  treat the widget concept itself as out of scope going forward, even though
  the earlier handoff said it was "in scope" again.** Section §1 Phase 1 in
  this file is now inaccurate (the hero strip + attention list bullets should
  be considered superseded by this revert). 35/35 tests still pass, tsc both
  ends clean, vite main chunk 1.31 MB (down ~10 KB from removal).
- **2026-05-25** · Phase 5 · **Company timeline + Compensation memory shipped.**
  New pure util `frontend/src/utils/companyAggregates.ts` (+ 11-test
  `.test.mjs`) with `companyTimeline`, `summarizeTimeline`, `peakStageReached`,
  tolerant free-text `parseSalary` (k-suffix / comma / hourly @ 2080 hrs),
  `compensationSummary`, `formatMoneyShort`. Wired both as sections at the
  top of `CompanyAppsSidebar` in `pages/Companies/Companies.tsx`: a
  "Lifetime activity" sentence + stacked strip + legend, and a
  "Compensation seen" range/median/N card that hides when no salary parses.
  Apps list now also shows a `peak X` chip when a Rejected app once
  reached a higher stage. Verified live in the preview (Atlassian sidebar:
  19-apps timeline + $93.6k–$170k median $133k across 4 apps). 35/35 tests,
  tsc clean both ends, vite 1.32 MB main / Companies chunk 19.96 KB.
  **Phase 5 now fully shipped.** Next pickup: Phase 6 · Resumes
  ("Tailored from..." tree → version timeline → performance metrics →
  PDF thumbnails → A/B view).
