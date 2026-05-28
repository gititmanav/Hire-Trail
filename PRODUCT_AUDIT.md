# HireTrail — Product & Engineering Audit

> **Scope:** end-to-end audit covering product readiness, launch blockers, bugs, feature gaps vs competitors, and a prioritized roadmap.
> **Target persona:** a developer/job-seeker trying HireTrail for the first time, comparing it to JobRight or Simplify, alert to anything that feels broken or unsafe.

---

## TL;DR

The product is feature-rich and the engineering is solid. The persona who matters here will judge HireTrail in two windows:

1. **First 5 minutes** — extension install, OAuth, "load unpacked" warning.
2. **First week** — does it stay reliable? does the AI work? do features fail silently?

Today the **first 5 minutes are the biggest liability**, and almost every fix for that is checklist work, not engineering. The features themselves are stronger than JobRight and Simplify in three areas (Tailor lineage, Resume metrics, Companies memory) and weaker in one: zero-friction onboarding.

**If you do nothing else this month, do these three:**

1. Submit to the Chrome Web Store (today).
2. Submit Google OAuth verification (today — it takes weeks).
3. Wire up Sentry + a `/health` endpoint (one afternoon).

---

## Table of contents

- [P0 — First 5 minutes (trust killers)](#p0--first-5-minutes-trust-killers)
- [P1 — First week (retention killers)](#p1--first-week-retention-killers)
- [Pre-launch checklist](#pre-launch-checklist)
- [Trust signals for the persona](#trust-signals-for-the-persona)
- [Feature gaps vs JobRight / Simplify](#feature-gaps-vs-jobright--simplify)
- [Latent bugs from prior sessions](#latent-bugs-from-prior-sessions)
- [Things to add beyond the original ask](#things-to-add-beyond-the-original-ask)
- [4-week launch roadmap](#4-week-launch-roadmap)
- [Honest closing opinion](#honest-closing-opinion)

---

## P0 — First 5 minutes (trust killers)

These six items will lose the persona before they ever see a feature.

| # | Issue | Impact | Fix |
| --- | --- | --- | --- |
| 1 | **Chrome Web Store: not listed.** Users see "Load unpacked" + "developer mode" warning. | Most non-engineer users abandon at this point. | Submit to CWS. ~$5 one-time developer fee. 1–3 day review. |
| 2 | **Google OAuth still in test mode.** Users see *"Google hasn't verified this app — proceed at your own risk."* | The persona reads "scam" and bounces. | Submit OAuth verification. Requires a privacy-policy URL (✓ exists), a demo video of consent + scope usage, and ~3–6 weeks of Google's security review for `gmail.readonly`. **Start now.** |
| 3 | **No `robots.txt`, no `sitemap.xml`, no OG / Twitter meta tags** in [`frontend/index.html`](frontend/index.html). | Link previews on Twitter/LinkedIn show no card. Google indexes auth + admin pages. Looks like a hobby project. | 30 minutes: add a basic `robots.txt`, a static `sitemap.xml`, and OG title / description / image. |
| 4 | **No "About" / "Built by" surface.** The persona explicitly says *"this is made by someone."* | Today the only credibility signals are the GitHub link in the footer + a Bento card. | One small page or hero section: founder photo, 2-sentence story, why it exists. |
| 5 | **No error tracking (Sentry / equivalent).** When a user hits a bug, you won't know unless they email you. | A single silent 500 on a power-user path loses that user permanently. | One afternoon: `@sentry/react` + `@sentry/node`. Free tier covers launch. |
| 6 | **AI calls have no fallback or visible "provider is down" state.** [`backend/src/services/email/intake.ts:121`](backend/src/services/email/intake.ts) and the Tailor analyzer call `generateObject` with no try/catch wrapping a graceful fallback. | If Gemini Flash is throttled or the user's BYOK key is bad, they see a generic "Failed to analyze" toast. | Wrap LLM calls: one retry on 5xx / 429, catch provider-specific 401/403, surface real messages — e.g. *"Your Anthropic key was rejected — check Settings."* |

---

## P1 — First week (retention killers)

These will cost you users between day 2 and day 7 — the window where the persona decides whether to make HireTrail a habit.

| # | Issue | Where | Fix |
| --- | --- | --- | --- |
| 7 | **No DELETE-my-account flow.** Confirmed via grep — no route exists. | `backend/src/routes/auth.ts` | Add `DELETE /api/auth/me` that nukes owned docs (apps, contacts, resumes, master profile, sessions, notifications) + revokes Gmail/Outlook tokens. Surface from Settings → Account with typed confirmation. **Required for GDPR + Google OAuth verification.** |
| 8 | **No idle-timeout / re-verify on sensitive actions.** 24-hour session TTL; client never re-checks. | Auth shell | Soft idle warning at 60 min is enough for launch. For B2B, require password re-entry to delete account or rotate API keys. |
| 9 | **Calendar drag-to-reschedule fails silently** for completed deadlines. UI doesn't refetch after the error toast — date appears moved but isn't. | [`frontend/src/pages/Calendar/Calendar.tsx:191`](frontend/src/pages/Calendar/Calendar.tsx) | After the error toast, force a refetch + deselect so the date snaps back visibly. |
| 10 | **Tailor JD input has no client-side size warning.** Backend silently slices to 30k chars. | [`backend/src/routes/tailor.ts:70`](backend/src/routes/tailor.ts) | Frontend: warn at 25k chars, hard-block at 50k with a clear message. |
| 11 | **Notification bell has no unread-count badge.** Polling uses raw `setInterval` instead of `useRefetchOnFocus`. | `frontend/src/components/Header/Header.tsx` | Add an unread-count badge (primary-tinted dot or numeric). Swap raw interval for the existing focus hook. |
| 12 | **Demo gate not applied to Admin routes.** Demo user clicks `/admin` and sees the UI (API blocks them, but the screens render). | `frontend/src/pages/Admin/*` | One-line guard: redirect demo users away. |
| 13 | **First-time Gmail scan only covers 7 days.** Discussed, not yet shipped. | [`backend/src/services/gmailService.ts:13`](backend/src/services/gmailService.ts) | Wire the 7 / 15 / 30 / 45 selector. A first-impression killer today — user connects Gmail expecting magic, scan finds 1 email, they bounce. |
| 14 | **`useDemoGate` coverage is uneven.** Demo blocked from some AI features but not all. | Backend routes | Audit every AI call path. Add defence-in-depth 403s on `/tailor/analyze`, `/masterProfile/parse`, `/email/*`, `/ai/keys` for demo user. |
| 15 | **Resume version timeline has no backfill.** Historical resumes show no edit history — only NEW edits since the field was added. | [`backend/src/routes/resumes.ts`](backend/src/routes/resumes.ts) | We already hide the strip when versions = []. Add a one-time backfill that writes a single `Imported` entry on `uploadDate` so historical resumes show something. |

---

## Pre-launch checklist

### Legal + Privacy

- [x] `/privacy` page exists
- [x] `/terms` page exists
- [ ] **Subprocessor list in privacy policy** (Anthropic, OpenAI, Google AI, Cloudinary, MongoDB Atlas, email host). **Required for Google OAuth verification on `gmail.readonly`.**
- [ ] Account-deletion endpoint and UI (see P1 #7). **Also required for Google OAuth verification.**
- [ ] Cookie banner / consent — only needed if you target EU users; if so, even session cookies count under ePrivacy.

### Distribution

- [ ] Chrome Web Store listing (P0 #1)
- [ ] Google OAuth verification submission (P0 #2)
- [ ] Microsoft Outlook OAuth verification — lower priority since the feature is flagged as "Coming soon"

### Observability

- [ ] Sentry / error tracking (P0 #5)
- [ ] Structured logging (`pino` or `winston`)
- [ ] `GET /health` health-check endpoint
- [ ] Uptime monitoring (Better Stack, UptimeRobot — free tier fine)
- [ ] Status page (`status.hiretrail.app` via Better Stack / Atlassian Statuspage)

### SEO + Social

- [ ] `robots.txt`
- [ ] `sitemap.xml`
- [ ] OG / Twitter meta tags in `index.html`
- [ ] Schema.org markup (Product or SoftwareApplication on landing)

### Engineering hardening

- [x] Rate limiting on auth + sensitive endpoints
- [x] AES-256-GCM encryption for refresh tokens + API keys
- [x] Helmet + CORS configured
- [x] Compound indexes on Application (`userId+stage`, `userId+applicationDate`, etc.)
- [ ] Database backups verified (Atlas takes them daily on most tiers — confirm and **rehearse a restore once before launch**)
- [ ] MongoDB migration framework (e.g. `migrate-mongo`) — future schema changes are ad-hoc today
- [ ] API contract tests beyond the existing co-located node tests

### Security

- [ ] External security review — hire an hour on a freelance security platform (~$200 for a checklist review)
- [ ] OWASP ZAP scan or basic penetration test before launch

---

## Trust signals for the persona

Things you can ship in a single afternoon that compound trust.

1. **Founder face on the landing page.** Small photo + 2-sentence "why I built this." Not optional — the persona explicitly worried about this.
2. **"Privacy at a glance" panel** on the landing page. Four bullets:
   - "We never send mail. Read-only Gmail scope."
   - "We never share your data."
   - "You can delete your account anytime."
   - "We're open source — read the code."
   Link each to the relevant route or file.
3. **Real numbers** *(when you have them)*. "X users tracking Y applications." Use real numbers once you have above ~50 users; before that, leave it blank — fake testimonials are worse than no testimonials.
4. **A 90-second product video** above the fold. Loom is free. This single asset converts more than any other landing-page change.
5. **Status page link** in the footer (after you set one up).
6. **A clear `/changelog`** route showing recent shipped features. Persona reads "actively maintained" → "I can trust this for daily use."

---

## Feature gaps vs JobRight / Simplify

Ranked by ROI on retention, not by feature count.

| Feature | Competitor | ROI | Cost | Verdict |
| --- | --- | --- | --- | --- |
| **Resume ATS-score** (e.g. *"Your resume scores 6/10 vs. this JD"*) | JobRight ⭐ | **High** — single most-shared screenshot in JobRight's reviews | Medium — 1 week, reuses Tailor's matching | **Build this next.** Surface the score on the Tailor page even before the user runs full analysis. |
| **One-click apply-form autofill** | Simplify ⭐⭐ | Medium — saves time, but our extension is JD-capture not apply-form | High — 3+ weeks across 5 ATS providers | **Skip for v1.** Position is "we capture, you apply." Add later. |
| **Follow-up email templates from Applications view** | Simplify | Medium — you already have outreach templates on Contacts | Low — ½ day | **Easy win.** Add a *"Draft follow-up"* button on stuck Applied apps. |
| **Job recommendations feed** | JobRight | Medium — sticky retention | High — needs scraping or a JD-source partnership | Defer. |
| **Interview prep / mock questions** | Neither does this well | Low–Medium | Medium | Defer. Compete on tracking + tailoring, not interview content. |
| **Salary negotiation tool** | Neither | Low for v1 | Medium | Defer. |
| **Alumni / network search** | JobRight (light) | High for senior users | High + legal risk (LinkedIn scraping) | Skip. |
| **Email reply suggestions** ("Reply to the interviewer") | Neither | **High** — natural extension of Gmail integration | Medium — 1 week, requires `gmail.send` scope addition | **Strong v2 candidate.** Big value once OAuth is verified. |

**If you build one this month, build the ATS-score.** It's the single feature this persona will screenshot and share. JobRight grew on it.

---

## Latent bugs from prior sessions

Not formally tracked anywhere yet:

- **Predicted hatched cards v1 (Kanban)** uses a hard-coded *"stuck → Rejected"* rule. Derive transition rates from the user's actual history, or remove the feature. Today it looks like a half-finished surface.
- **Backend AI route gating.** Frontend `useDemoGate` blocks AI on the demo user, but `/tailor/analyze`, `/masterProfile/parse`, `/email/*`, `/ai/keys` accept demo-user requests if hit directly. One-line defence-in-depth 403 per route.
- **Companies seed-data legacy logos.** If a stored `Company.domain` is a known job-board host AND a logo is cached, the next `ensureCompanyLogo` should clear it. Verify the cleanup still triggers.
- **`requestedLogoIds` module-level Set** on the Companies page persists across remounts. Intentional, but a user who force-refreshes expecting fresh logos won't get them. Minor.

---

## Things to add beyond the original ask

1. **Data-deletion + portability flow** (`Settings → Data`). Two actions: *Export everything* (zip of JSON per collection) and *Delete account* (typed confirmation + 7-day soft delete + final purge). Without these, Google may reject the OAuth submission outright.
2. **Onboarding-tour completion telemetry.** Today you only know `tourCompleted: true/false`. Track which step the user quit on so you can iterate copy.
3. **Background-task recovery — actually test it.** The infra is there; verify end-to-end that a refresh mid-resume-parse re-attaches the task card. 30 minutes.
4. **A "Connect Gmail" demo path.** The demo user can't connect Gmail because the gate is account-wide. For a visitor's first 60 seconds, that's the most important feature to *show*. Consider a fake "scanned email" preview that walks them through the UI without a real connection.
5. **Backup + recovery rehearsal.** MongoDB Atlas takes daily snapshots. Have you ever restored one? A backup you can't restore isn't a backup.
6. **Subdomain readiness.** Set up DNS + host config now for `api.`, `status.`, `extension.hiretrail.app`. Cheaper to do today than the day before launch.
7. **A "what's new" toast** that fires once per user per release, pulled from a JSON file shipped with the build. Free retention mechanic.

---

## 4-week launch roadmap

A specific, opinionated plan. Owner of each line: you.

### Week 1 — Distribution prep (no code)

- Submit Chrome Web Store listing
- Submit Google OAuth verification (with demo video)
- Add Sentry + `/health` + `robots.txt` + OG tags
- Set up uptime monitoring

### Week 2 — Trust + reliability

- Founder bio on landing + "Privacy at a glance" panel
- DELETE-account endpoint + UI
- Subprocessor list in privacy policy
- AI provider fallback / retry / clear error messages
- Wire the first-time Gmail scan window selector (7 / 15 / 30 / 45)

### Week 3 — One killer differentiator + bug pass

- Ship the Resume ATS-score against a JD (reuses existing Tailor matching)
- Fix the P1 bugs above (Calendar refetch, demo gate on Admin, demo gate on backend AI routes)

### Week 4 — Polish + launch

- A 90-second product video (Loom)
- Follow-up email templates from Applications view
- Background-task recovery rehearsal
- Soft launch: r/cscareerquestions, Indie Hackers, Show HN

**What NOT to ship in weeks 1–4:** job recommendations, salary tools, interview prep, autofill. They sound exciting but they're not what loses you the persona — **reliability + credibility** are. Lock those in first.

---

## Honest closing opinion

The engineering is well ahead of where most solo-SaaS launches are. You've done the boring parts most founders skip — rate limiting, encryption, demo data, accessibility passes. What you haven't done is the **legitimacy theater**: Chrome Web Store, Google verification, Sentry, founder bio. None of these are technical work, but every one of them changes the persona's first impression more than any feature you could build in the same time.

**To convert the persona: fix the first 5 minutes before you build the next feature.** Specifically — CWS submission today, OAuth verification today (it takes weeks), Sentry this week. That's the unblock.

The AI working *"properly"* is your second-biggest risk because LLM providers have outages and your code surfaces no recovery path. That's a 1-day fix: proper try/catch + user-facing messages + one retry.

Everything else — including every cool feature idea — comes after these two.

---

*Last updated: 2026-05-26*
