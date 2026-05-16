# HireTrail

HireTrail is a full-stack job search operating system for serious candidates: track applications, run your pipeline, tailor resumes to a JD with AI, auto-update statuses from your inbox, and review outcomes with analytics.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Frontend%20%2B%20Backend-3178C6.svg)](https://www.typescriptlang.org/)

**Live app:** [hiretrail.manavkaneria.me](https://hiretrail.manavkaneria.me/login)
**Repository:** [github.com/gititmanav/Hire-Trail](https://github.com/gititmanav/Hire-Trail)

## Why HireTrail

Most job trackers are either too simple (spreadsheet replacement) or too rigid for real recruiting cycles. HireTrail is built for people applying at volume while still wanting structure, automation, and clean UX.

- One canonical career profile, then tailored resumes per role with an AI fit score and accept/reject suggestions
- Auto-status updates from Gmail and Outlook — interview, offer, follow-up, rejection — with one-click confirm/revert
- BYOK AI: bring your own key (Anthropic, OpenAI, Google, OpenRouter) or use the bundled Gemini Flash default
- Built-in browser extension to one-click track jobs and view AI fit analysis without leaving the JD page
- Full admin platform: users, RBAC, audit logs, broadcasts, feedback inbox, analytics, mailbox controls

## Screenshots

| Dashboard (light) | Dashboard (dark) |
| :---: | :---: |
| ![Dashboard light](frontend/public/Dashboard.png) | ![Dashboard dark](frontend/public/Dashboard-Darkmode.png) |

| Kanban (light) | Kanban (dark) |
| :---: | :---: |
| ![Kanban light](frontend/public/Kanban%20Board.png) | ![Kanban dark](frontend/public/Kanban%20Board%20Dark.png) |

![Resume manager](frontend/public/Resume.png)

## Feature Set

### Core job tracking

- **Applications**: Full CRUD, server-side search + pagination, stage filters, stage history timeline, duplicate protection
- **Kanban pipeline**: Drag-and-drop stage management with optimistic updates; fixed-width columns that hold their layout when cards move
- **Resumes**: Versioned resume records with PDF uploads (Cloudinary) and performance stats
- **Contacts and companies**: Keep recruiter/referral contacts organized per company
- **Calendar (revamped)**: 3-column shell (mini-cal + upcoming + filters / month or week grid / event detail + today agenda), drag-to-reschedule deadlines, quick-add by clicking an empty day, keyboard shortcuts (`T`, `M / W / D / A`, `← / →`, `Esc`)
- **Deadlines**: Upcoming / overdue / completed states with urgency cues and quick completion
- **Dark mode** support across every page

### AI features

- **AI Tailor (beta)**: Paste a JD; HireTrail compares it against your master profile and returns a fit score (1–5), A–F grade, matched/missing skills, and a punch list of accept-or-reject rewrite/add/reorder suggestions. Generates an ATS-friendly tailored PDF via Typst, with a `X-Resume-Pages` header for the 1-page check.
- **Master Profile**: One canonical career history (Personal · Experience · Projects · Education · Skills · Certifications) used by AI Tailor and the extension. Scroll-spy tabs on the profile page, right-slide section editor with per-section save, source-resume re-parse, optional AI merge on subsequent parses.
- **BYOK provider abstraction**: Per-user encrypted (AES-GCM) API keys for Anthropic, OpenAI, Google Gemini, and OpenRouter. Fallback order is `google → anthropic → openai → openrouter`. Default user gets free-tier Gemini Flash if a default key is configured.

### Inbox auto-status (Gmail + Outlook)

- **Source-agnostic intake pipeline**: pre-filter → dedupe → LLM classify → application match → stage update + notification
- **Signals detected**: `interview_detected`, `offer_detected`, `follow_up_detected`, `rejection_detected`
- **Outlook integration** via Microsoft Graph (MSAL), parallel to Gmail
- **Confirm / revert** on every auto-applied stage change. Revert restores the prior stage and removes the auto-added history entry.
- **Nightly cron** at `0 1 * * *` scans every connected mailbox per user
- **Per-user mailbox connections** managed from Settings

### Analytics and reporting

- **Dashboard widgets**: Draggable, resizable, show/hide widgets with persisted layout
- **Pipeline analytics**: Funnel, conversion rates, stage distribution, weekly signup + rejection trends, resume-level metrics
- **Tailor + Master Profile analytics**: total sessions, last-30-day usage, avg fit score, grade distribution, section coverage, adoption rate
- **AI provider mix** and **mailbox adoption** rolled into platform analytics
- **CSV import/export** for portability and bulk updates
- **Theme-aware charts**: Chart.js defaults and widget visuals adapt to light/dark mode

### Feedback widget

- **In-app "Send feedback"** button in the bottom of the main sidebar — opens a modal portaled to `document.body` so it never gets clipped
- Five feedback types (bug, idea, question, praise, other), severity, auto-attached page path + user-agent
- **Admin Feedback Inbox** with status/type/severity filters, search, paginated list, sticky detail pane with status + severity controls and admin notes
- Counters on the Admin Dashboard turn red when there's open feedback

### Admin platform

- **Admin Dashboard** with 6-card KPI strip (users, 7-day active, applications, mailbox-connected, BYOK keys, open feedback), 30-day trend charts (signups · applications · tailor sessions), pipeline doughnut, email-signal breakdown, AI provider mix, master-profile coverage %, feedback by type, recent audit activity table.
- **User Management** with row-level checkboxes, "select all on page", a sticky bulk-action bar, and **Email selected** that deep-links to the Broadcasts page with the picked users pre-filled. New integration pills surface Gmail/Outlook connections, master profile presence, BYOK key count, and tailor session count.
- **Broadcasts** (new): compose subject + HTML body, live preview with `{{appName}}` / `{{senderEmail}}` substitution, recipient toggle between "All users" and "Selected" (with a searchable user picker), per-broadcast progress bar with live polling, and a paginated history table with sent / failed counts. Sends via SMTP using a Google App Password. Disabled with a clear banner if email isn't configured.
- **Mailbox Management** (replaces Gmail Management): Gmail + Outlook + "all" provider tabs, per-row scan/disconnect, four signal-stat cards (interviews / offers / follow-ups / rejections), provider adoption stats.
- **Notification Center**: filter by signal type (interview/offer/follow-up/rejection/info), source (Gmail/Outlook), read state, and resolved state. Click any signal card to filter to that type.
- **Platform Analytics**: pipeline funnel, conversion rates, top companies / roles, weekly trends, plus AI Tailor and Master Profile sections.
- **Audit Logs** with new resource filters (`master_profile`, `tailor_session`, `feedback`, `ai_provider`, `mailbox`, `broadcast`) and a metadata block in the expanded row view.
- **Email Templates**, **Announcements**, **Invites**, **Backups**, **Seed Data**, **System Config**, **Storage**, **Content Moderation**, **RBAC** modules all visually unified with consistent header/stat/card patterns.
- **Role-based admin area** with separate admin layout and feature flags for progressive rollout (Kanban, job search, import/export)

### Browser extension (Chrome, Manifest V3) — v1.2.0

- **One-click job tracking** from LinkedIn, Indeed, Greenhouse, Lever, Glassdoor, and Workday
- **Smart page scraping** for title/company/location/description/job type/salary
- **Auto-track on apply click** (supported boards) plus floating quick-track action
- **AI Tailor sidebar**: purple FAB on the JD page scrapes the description and opens a 380px right-side sidebar with the fit grade, top suggestions, and an "Open in HireTrail" deep-link to `/tailor?session=…`
- **Extension auth options**: email/password, Google, and session handoff from the web app
- **Daily tracked-job badge count** with automatic reset

## Tech Stack

| Layer | Stack |
|------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Express (ESM), TypeScript, Mongoose, Zod |
| Auth | Passport Local + Google OAuth 2.0, sessions with connect-mongo, extension JWT |
| AI | Vercel AI SDK (`@ai-sdk/{anthropic,openai,google,openrouter}`), Zod schemas for structured output |
| PDF | `@myriaddreamin/typst-ts-node-compiler` (Typst → PDF for tailored resumes) |
| Mail | nodemailer over SMTP (Google App Password by default) |
| Outlook | `@azure/msal-node` (Microsoft Graph) |
| Storage | MongoDB, Cloudinary (resume PDFs) |
| UI/Charts | react-grid-layout, @dnd-kit, Chart.js, react-chartjs-2 |
| Security | Helmet CSP, rate limiting, httpOnly cookies, CORS allowlist, AES-GCM for BYOK keys |
| Tooling | Papa Parse, Axios interceptors, node-cron |

## Repository Layout

```text
Hire Trail/
├── backend/            # Express API + jobs + admin services
│   └── src/
├── frontend/           # React SPA
│   └── src/
├── extension/          # Chrome extension (MV3)
│   ├── content/
│   ├── background/
│   └── popup/
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas (or compatible Mongo URI)
- Optional integrations: Google OAuth, Cloudinary, RapidAPI (JSearch), Microsoft Identity Platform (Outlook), Gmail App Password (broadcasts)

### 1) Install dependencies

```bash
git clone https://github.com/gititmanav/Hire-Trail.git
cd Hire-Trail
npm run install-all
```

### 2) Configure environment

```bash
cd backend
cp .env.example .env
```

**Required**

- `MONGO_URI`
- `SESSION_SECRET`
- `CLIENT_URL` (must match frontend origin exactly)

**Auth (recommended)**

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Admin bootstrap: `ADMIN_EMAILS=you@example.com,team@example.com` (comma-separated)
- Maintenance bypass (optional): `MAINTENANCE_BYPASS_EMAIL` — single account that can sign in while maintenance mode is on

**AI Tailor (any one of these gives users a default)**

- `GOOGLE_GENERATIVE_AI_API_KEY` (recommended — Gemini Flash free tier)
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

**Outlook integration (optional)**

- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID=common`
- `OUTLOOK_REDIRECT_URI=http://localhost:5050/api/email/outlook/callback`

**Admin broadcasts (optional)**

- `EMAIL_SENDER` — the Gmail account that will send (e.g. `notifications@yourdomain.com`)
- `EMAIL_APP_PASSWORD` — a 16-character Google App Password (https://myaccount.google.com/apppasswords); requires 2FA on the account
- `EMAIL_SENDER_NAME` (defaults to `HireTrail`)
- `EMAIL_SMTP_HOST` / `EMAIL_SMTP_PORT` (defaults to `smtp.gmail.com` / `465`)

The Broadcasts admin page will show a red banner with these exact instructions if SMTP isn't configured, and the Send button stays disabled — there's no way to silently fail.

**Other optional integrations**

- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- JSearch: `JSEARCH_API_KEY`
- BYOK encryption: `ENCRYPTION_KEY` (64-char hex; rotated by re-encrypting stored keys)

**Frontend**

```bash
cd frontend
cp .env.example .env
```

- `VITE_API_PROXY_TARGET` for local dev proxy
- `VITE_API_BASE_URL` only for split frontend/API deployments

### 3) (Optional) seed demo data

```bash
npm run seed
```

Creates a demo account (`demo@hiretrail.com` / `password123`) with realistic sample records.

### 4) Run locally

From project root:

```bash
npm run dev:backend
npm run dev:frontend
```

App runs at `http://localhost:5173`.

## Deployment Notes

- **Monolith deploy**: build frontend, build backend, serve `frontend/dist` from backend
- **Split deploy**: set frontend `VITE_API_BASE_URL` and backend `CLIENT_URL` to deployed origins
- For cross-origin production cookies, backend uses `SameSite=None` + `Secure`
- On Vercel, add all `EMAIL_*`, `MICROSOFT_*`, AI provider, and `ADMIN_EMAILS` env vars to the project environment

## Chrome Extension Setup (optional)

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked extension from `extension/`
4. Log in via extension popup and start tracking jobs from supported boards
5. On a job description page, click the purple sparkle FAB to open the AI Tailor sidebar

## Breaking changes from earlier versions

| Endpoint | Status |
|---|---|
| `POST /api/email/connect` | renamed to `POST /api/email/gmail/connect`; legacy alias kept for backwards-compat |
| `POST /api/email/scan` response shape | changed from `{ count }` to `{ applied, scanned, errors[] }` |
| `/api/resume-profile/*` | removed — use `/api/master-profile/*` |
| `Notification` shape | added `source`, `sourceEmailId`, `previousStage`, `resolved` fields |
| `/admin/gmail` | redirects to `/admin/mailbox` (Gmail + Outlook unified) |

Existing `ResumeProfile` documents in MongoDB become orphans; users will need to re-parse from the Profile page (single click). No automated migration ships.

## License

MIT - see [LICENSE](LICENSE)
