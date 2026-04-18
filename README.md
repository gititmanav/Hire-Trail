# HireTrail

HireTrail is a full-stack job search operating system for serious candidates: track applications, run your pipeline, automate routine updates, and review outcomes with analytics.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Frontend%20%2B%20Backend-3178C6.svg)](https://www.typescriptlang.org/)

**Live app:** [hiretrail.manavkaneria.me](https://hiretrail.manavkaneria.me/login)  
**Repository:** [github.com/gititmanav/Hire-Trail](https://github.com/gititmanav/Hire-Trail)

## Why HireTrail

Most job trackers are either too simple (spreadsheet replacement) or too rigid for real recruiting cycles. HireTrail is built for people applying at volume while still wanting structure, automation, and clean UX.

- Unified system for applications, resumes, contacts, deadlines, and job search
- Fast daily workflow with Kanban + dashboard widgets
- Built-in automation for Gmail rejection detection and notification flows
- Includes a browser extension for one-click tracking from major job boards

## Screenshots

| Dashboard (light) | Dashboard (dark) |
| :---: | :---: |
| ![Dashboard — light](frontend/public/Dashboard.png) | ![Dashboard — dark](frontend/public/Darkmode%20dashboard.png) |

![Kanban board](frontend/public/Kanban%20Board.png)
![Job search](frontend/public/Job%20Search.png)

## Feature Set

### Core job tracking

- **Applications**: Full CRUD, server-side search + pagination, stage filters, stage history timeline, duplicate protection
- **Kanban pipeline**: Drag-and-drop stage management with optimistic updates
- **Resumes**: Versioned resume records with PDF uploads (Cloudinary) and performance stats
- **Contacts and companies**: Keep recruiter/referral contacts organized per company
- **Deadlines**: Upcoming/overdue/completed states with urgency cues and quick completion

### Analytics and reporting

- **Dashboard widgets**: Draggable, resizable, show/hide widgets with persisted layout
- **Pipeline analytics**: Funnel, conversion, stage distribution, trends, and resume-level metrics
- **Import/export**: CSV import/export workflows for portability and bulk updates

### Automation and integrations

- **In-app job search**: JSearch integration through backend proxy (API key stays server-side)
- **Gmail integration (beta)**: Connect Gmail, scan inbox, detect rejection emails, auto-update application stages
- **Nightly email scan job**: Scheduled inbox scan for connected users
- **Manual rejection reporting**: Fast one-off rejection update from profile settings
- **Notification center**: Per-user read/unread notifications and bulk mark-as-read actions

### Admin platform features

- **Role-based admin area** with separate admin layout
- **Admin modules** for users/RBAC, audit logs, content moderation, storage, system config, announcements
- **Operational tooling** for invites, backup management, seed management, email templates, and Gmail controls
- **Feature flags** to progressively roll out modules like Kanban, job search, and import/export

### Browser extension (Chrome, Manifest V3)

- **One-click job tracking** from LinkedIn, Indeed, Greenhouse, Lever, Glassdoor, and Workday
- **Smart page scraping** for title/company/location/description/job type/salary
- **Auto-track on apply click** (supported boards) plus floating quick-track action
- **Extension auth options**: email/password, Google, and session handoff from web app
- **Daily tracked-job badge count** with automatic reset

## Tech Stack

| Layer | Stack |
|------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Express (ESM), TypeScript, Mongoose, Zod |
| Auth | Passport Local + Google OAuth 2.0, sessions with connect-mongo, extension JWT |
| Storage | MongoDB, Cloudinary (resume PDFs) |
| UI/Charts | react-grid-layout, @dnd-kit, Chart.js, react-chartjs-2 |
| Security | Helmet CSP, rate limiting, httpOnly cookies, CORS allowlist |
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
- Optional integrations: Google OAuth, Cloudinary, RapidAPI (JSearch)

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

Minimum required backend variables:

- `MONGO_URI`
- `SESSION_SECRET`
- `CLIENT_URL` (must match frontend origin exactly)

Optional:

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- JSearch: `JSEARCH_API_KEY`
- Admin bootstrap: `ADMIN_EMAILS`

Frontend:

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

Creates demo account and realistic sample records.

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

## Chrome Extension Setup (optional)

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked extension from `extension/`
4. Log in via extension popup and start tracking jobs from supported boards

## License

MIT - see [LICENSE](LICENSE)
