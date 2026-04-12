# HireTrail Extension — Session Handoff Document

## What This Is
This document contains everything needed to continue building 8 new features for the HireTrail Chrome extension and web app. Start by reading this, then implement phase by phase.

---

## Project Structure

```
Hire Trail/
├── backend/                    # Express + MongoDB API (deployed on Vercel)
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts          # Zod env validation (54 lines)
│   │   │   ├── db.ts           # MongoDB connection
│   │   │   └── passport.ts     # Passport local + Google OAuth strategies
│   │   ├── models/
│   │   │   ├── Application.ts  # Job application schema (164 lines) — MODIFY
│   │   │   ├── User.ts         # User schema with googleId (112 lines) — MODIFY
│   │   │   ├── EmailTemplate.ts # Email template model (exists)
│   │   │   └── ...
│   │   ├── routes/
│   │   │   ├── applications.ts # CRUD for applications (190 lines) — MODIFY
│   │   │   ├── auth.ts         # Login/register/Google/extension-token
│   │   │   ├── email.ts        # Placeholder 501 endpoints (31 lines) — REPLACE
│   │   │   └── ...
│   │   ├── validators/
│   │   │   └── applications.ts # Zod create/update schemas (37 lines) — MODIFY
│   │   ├── middleware/
│   │   │   └── auth.ts         # ensureAuth (session + Bearer JWT)
│   │   └── server.ts           # Express setup, CORS, routes (139 lines) — MODIFY
│   ├── package.json
│   └── vercel.json
├── frontend/                   # React + Vite (deployed on Vercel)
│   ├── src/
│   │   ├── types/index.ts      # TypeScript interfaces (249 lines) — MODIFY
│   │   ├── utils/api.ts        # Axios API client (196 lines) — MODIFY
│   │   ├── pages/
│   │   │   ├── Applications/Applications.tsx  # Table + sidebar (485 lines) — MODIFY
│   │   │   ├── Dashboard/Dashboard.tsx        # Widget grid (229 lines) — MODIFY
│   │   │   └── Profile/Profile.tsx            # Has disabled "Connect Gmail" (271 lines) — MODIFY
│   │   └── main.tsx            # react-hot-toast Toaster configured here
│   └── package.json
├── extension/                  # Chrome MV3 extension (load unpacked)
│   ├── manifest.json           # Permissions + content script matches (42 lines) — MODIFY
│   ├── content/
│   │   └── content.js          # FAB + scrapers (130 lines) — MODIFY (heaviest changes)
│   ├── background/
│   │   └── background.js       # Service worker (119 lines) — MODIFY
│   └── popup/
│       ├── popup.html          # Login/logged-in views (75 lines)
│       ├── popup.js            # Auth logic (159 lines) — MODIFY
│       └── popup.css           # Styles (40 lines)
```

---

## Current State (What Already Works)

- **Extension login**: Email/password, Google OAuth, auto-login from web session cookie
- **Job tracking**: Click H button on LinkedIn/Indeed/Greenhouse/Lever → creates application in HireTrail
- **Data captured**: company, role, jobUrl, stage="Applied", primaryResumeId
- **Popup UI**: Loading state, login form, Google sign-in, logged-in view with user info
- **Backend**: CORS allows chrome-extension:// origins, JWT auth for extension, session-to-token exchange
- **Deployment**: Backend + frontend on Vercel at `hiretrail.manavkaneria.me`, extension loaded unpacked locally

## What's NOT Captured Yet
- Job description text
- Location, salary, job type
- No duplicate detection
- No Glassdoor or Workday support
- No auto-detect of Apply button clicks
- No badge count on extension icon
- Email integration is placeholder only

---

## Application Model — Current Fields
```typescript
// backend/src/models/Application.ts
{
  userId: ObjectId,          // required, indexed
  company: String,           // required, max 200
  companyId: ObjectId|null,  // auto-linked
  role: String,              // required, max 200
  jobUrl: String,            // optional, validated URL
  applicationDate: Date,     // defaults to now
  stage: "Applied"|"OA"|"Interview"|"Offer"|"Rejected",  // default "Applied"
  stageHistory: [{ stage, date }],  // auto-populated
  notes: String,             // max 5000
  resumeId: ObjectId|null,
  contactId: ObjectId|null,
  outreachStatus: "none"|"reached_out"|"referred"|"response_received",
  archived: Boolean,
  archivedAt: Date|null,
  archivedReason: "auto_stale"|"rejected"|"manual"|null,
}
```

## User Model — Current Fields
```typescript
// backend/src/models/User.ts
{
  name: String,              // required
  email: String,             // required, unique, lowercase
  password: String|null,     // null for Google-only users
  googleId: String,          // for Google OAuth
  role: "user"|"admin",
  suspended: Boolean,
  deleted: Boolean,
  tourCompleted: Boolean,
  primaryResumeId: ObjectId|null,
}
```

## Extension Content Script — Current Scrapers
```javascript
// extension/content/content.js — scrapers object (lines 4-27)
const scrapers = {
  "linkedin.com": () => ({ title: "...", company: "..." }),
  "indeed.com":   () => ({ title: "...", company: "..." }),
  "greenhouse.io": () => ({ title: "...", company: "..." }),
  "lever.co":     () => ({ title: "...", company: "..." }),
};
```

## Extension Background — Current POST Body
```javascript
// extension/background/background.js — trackJob() sends:
{
  company: data.company || "Unknown",
  role: data.title || "Unknown",
  jobUrl: data.url || "",
  stage: "Applied",
  notes: "",
  resumeId,  // from /auth/me primaryResumeId
}
```

## Backend Email Route — Current Placeholder
```typescript
// backend/src/routes/email.ts — all return 501 Not Implemented
POST /api/email/connect  → 501
GET  /api/email/status   → { connected: false }
POST /api/email/scan     → 501
```

## Frontend Profile — Gmail Button
```
// frontend/src/pages/Profile/Profile.tsx (lines 248-260)
// Has a disabled "Connect Gmail" button with "Coming soon" text and beta badge
```

## Key API Endpoints
```
POST /api/auth/token              # email/password → JWT (extension login)
POST /api/auth/google/extension   # Google access token → JWT
POST /api/auth/extension-token    # session cookie → JWT (auto-login)
GET  /api/auth/me                 # current user (session or Bearer)
POST /api/applications            # create application
PUT  /api/applications/:id        # update application
GET  /api/applications            # paginated list with search/filter
```

## Environment Variables (backend/.env)
```
MONGO_URI=...
SESSION_SECRET=...
CLIENT_URL=https://hiretrail.manavkaneria.me
GOOGLE_CLIENT_ID=15875098947-v3ki4761r0f9d2co11f1kef87oj0ocar.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://hiretrail.manavkaneria.me/api/auth/google/callback
```

## Tech Stack
- **Backend**: Express 4, MongoDB/Mongoose, Passport.js, JWT, Zod validation
- **Frontend**: React 18, Vite, Axios, react-hot-toast, TailwindCSS
- **Extension**: Chrome Manifest V3, vanilla JS (no build step)
- **Deploy**: Vercel (monorepo: backend serves API + frontend static)

---

# Implementation Plan — 8 Features in 4 Phases

## Phase 1: Scraping Foundation (Features 1, 3, 4)

### Feature 1: Job Description Capture

**Backend**
- `backend/src/models/Application.ts` — Add `jobDescription: { type: String, default: "", maxlength: 50000 }`
- `backend/src/validators/applications.ts` — Add `jobDescription: z.string().max(50000).default("")` to create schema, `.optional()` to update schema
- `backend/src/routes/applications.ts` — Ensure PUT handler includes `jobDescription`

**Extension**
- `extension/content/content.js` — Extend each scraper to return `jobDescription` (use `.innerText` for line breaks):
  - LinkedIn: `.jobs-description__content` or `#job-details`
  - Indeed: `#jobDescriptionText`
  - Greenhouse: `#content .body`
  - Lever: `[data-qa="job-description"]` or `.section.page-centered`
- `extension/background/background.js` — Include `data.jobDescription` in POST body

**Frontend**
- `frontend/src/types/index.ts` — Add `jobDescription?: string` to Application interface
- `frontend/src/pages/Applications/Applications.tsx` — Add collapsible "Job Description" section in sidebar (between date and resume). Show first ~150 chars collapsed, "Show more" toggle to expand.

### Feature 3: Richer Job Data

**Backend**
- `backend/src/models/Application.ts` — Add `location`, `salary`, `jobType` (all String, default "", max 200)
- `backend/src/validators/applications.ts` — Add to both schemas
- `backend/src/routes/applications.ts` — Include in PUT handler

**Extension**
- `extension/content/content.js` — Extend scrapers to return `location`, `salary`, `jobType`:
  - LinkedIn: `.tvm__text` (location), `[class*="salary"]` (salary)
  - Indeed: `[data-testid="jobsearch-JobInfoHeader-companyLocation"]`, `.salary-snippet`
  - Greenhouse: `.location`
  - Lever: `.sort-by-location`, `.commitment`
- `extension/background/background.js` — Pass all new fields in POST body

**Frontend**
- `frontend/src/types/index.ts` — Add `location?`, `salary?`, `jobType?`
- Sidebar: Show metadata pills below company (only if non-empty)

### Feature 4: Duplicate Detection

**Backend**
- `backend/src/models/Application.ts` — Add index: `{ userId: 1, jobUrl: 1 }`
- `backend/src/routes/applications.ts` — In POST, before create: if `jobUrl` non-empty, check for existing. Return 409 `{ error: "Already tracked", applicationId }` if found.

**Extension**
- `extension/background/background.js` — Handle 409: `return { success: false, duplicate: true, error: "Already tracked!" }`
- `extension/content/content.js` — Show amber toast (#f59e0b) for duplicates instead of red error

---

## Phase 2: New Portals (Features 5, 6)

### Feature 5: Glassdoor

- `extension/manifest.json` — Add to content_scripts matches: `"https://www.glassdoor.com/job-listing/*"`, `"https://www.glassdoor.com/Job/*"`
- `extension/content/content.js` — Add `"glassdoor.com"` scraper:
  - title: `[data-test="job-title"]` or `h1`
  - company: `[data-test="employer-name"]`
  - jobDescription: `[data-test="description"]`
  - location: `[data-test="job-location"]`
  - salary: `[data-test="detailSalary"]`

### Feature 6: Workday

- `extension/manifest.json` — Add `"https://*.myworkdayjobs.com/*"` to both matches and host_permissions
- `extension/content/content.js` — Add `"myworkdayjobs.com"` scraper:
  - title: `[data-automation-id="jobPostingHeader"]`
  - company: extracted from subdomain (e.g., `apple.myworkdayjobs.com` → "Apple")
  - jobDescription: `[data-automation-id="jobPostingDescription"]`
  - location: `[data-automation-id="locations"]`
- Add `waitForSelector()` utility using MutationObserver (5s timeout) since Workday is an SPA

---

## Phase 3: Extension Polish (Features 2, 7)

### Feature 2: Auto-detect Apply Click

- `extension/content/content.js` — Add `setupApplyDetection()` after FAB setup:
  - Map of portal → apply button selectors:
    - LinkedIn: `button[aria-label*="Apply"]`, `.jobs-apply-button`
    - Indeed: `.indeed-apply-button`
    - Greenhouse: `.apply-button`
    - Lever: `.postings-btn-submit`
    - Glassdoor: `button[data-test="apply-button"]`
    - Workday: `button[data-automation-id="applyButton"]`
  - Event delegation on `document.body` with `capture: true`
  - On match: debounce 5s, check auth silently, scrape + send TRACK_JOB
  - Show subtle "Auto-tracked!" toast on success; stay silent on 409 duplicate
  - Depends on Feature 4 (duplicate detection)

### Feature 7: Badge Count

- `extension/manifest.json` — Add `"alarms"` to permissions
- `extension/background/background.js`:
  - After successful `trackJob()`: increment `badgeCount` in chrome.storage, call `chrome.action.setBadgeText({ text: count })` + `setBadgeBackgroundColor({ color: '#378add' })`
  - Register `chrome.alarms.create('resetBadge', { periodInMinutes: 1440 })` for daily reset
  - `chrome.alarms.onAlarm` listener to clear badge
- `extension/popup/popup.js` — On open, display count in `#track-count` ("X jobs tracked today"), then reset badge

---

## Phase 4: Email Integration (Feature 8)

### Approach
- Gmail API with `gmail.readonly` scope, test mode (100 whitelisted users)
- Scan runs nightly at 1 AM + manual "Scan now" button in app header
- Match rejection emails to user's tracked companies by sender domain
- Auto-update stage to "Rejected", create notification

### New Dependencies
- `backend/package.json` — Add `googleapis`, `node-cron`, `@types/node-cron`

### New Files to Create

1. **`backend/src/utils/encryption.ts`** — AES-256-GCM encrypt/decrypt for Gmail refresh tokens. Key from `env.ENCRYPTION_KEY`.

2. **`backend/src/models/Notification.ts`** — Schema:
   ```
   userId: ObjectId (required, indexed)
   type: "rejection_detected" | "info"
   title: String
   message: String
   applicationId: ObjectId | null
   read: Boolean (default false)
   readAt: Date | null
   createdAt: Date
   Index: { userId: 1, read: 1, createdAt: -1 }
   ```

3. **`backend/src/services/gmailService.ts`** — Core Gmail service:
   - `getAuthUrl(userId)` — OAuth URL with `gmail.readonly`, `access_type: 'offline'`, `prompt: 'consent'`
   - `handleCallback(code, userId)` — Exchange code, encrypt refresh token, save to User
   - `scanUserInbox(user)` — Decrypt token, query Gmail (`newer_than:1d`), match rejection keywords + sender domain to user's applications, update stage, create Notification
   - `disconnectGmail(userId)` — Clear tokens, revoke at Google
   - Rejection keywords: "unfortunately", "not moving forward", "other candidates", "regret to inform", "position has been filled", "not been selected", "decided not to move forward"

4. **`backend/src/services/emailScanJob.ts`** — node-cron job at `0 1 * * *` (1 AM). Query all users with `gmailConnected: true`, call `scanUserInbox` for each. Handle `invalid_grant` by marking disconnected.

5. **`backend/src/routes/notifications.ts`** — Routes:
   - `GET /api/notifications` — paginated list
   - `GET /api/notifications/unread-count` — count
   - `PUT /api/notifications/:id/read` — mark one read
   - `PUT /api/notifications/read-all` — mark all read

### Files to Modify

- **`backend/src/config/env.ts`** — Add `GMAIL_REDIRECT_URI`, `ENCRYPTION_KEY` (optional defaults)
- **`backend/src/models/User.ts`** — Add `gmailRefreshToken: String|null`, `gmailConnected: Boolean`, `gmailEmail: String|null`, `gmailLastSyncAt: Date|null`. Strip `gmailRefreshToken` from toJSON.
- **`backend/src/routes/email.ts`** — Replace all 3 placeholders:
  - `POST /connect` → returns OAuth URL
  - `GET /callback` → OAuth callback, redirects to frontend with success param
  - `GET /status` → { connected, email, lastSyncAt }
  - `POST /scan` → manual scan trigger
  - `POST /disconnect` → remove connection
- **`backend/src/server.ts`** — Register notification routes, start cron job conditionally
- **`frontend/src/types/index.ts`** — Add `Notification` interface, gmail fields to User type
- **`frontend/src/utils/api.ts`** — Add `emailAPI` and `notificationsAPI` client objects
- **`frontend/src/pages/Profile/Profile.tsx`** — Wire up "Connect Gmail" button with real OAuth flow + connected status + disconnect
- **`frontend/src/pages/Dashboard/Dashboard.tsx`** — Add notification banner for auto-rejections
- **App header/Navbar** — Add "Scan now" button + notification bell with unread count

### New Environment Variables Needed
```
ENCRYPTION_KEY=<random-32-byte-hex-string>
GMAIL_REDIRECT_URI=https://hiretrail.manavkaneria.me/api/email/callback
```

### Google Cloud Console Setup
- Add `gmail.readonly` scope to the OAuth consent screen
- Add `https://hiretrail.manavkaneria.me/api/email/callback` to authorized redirect URIs
- Keep in test mode (add test user emails manually)

---

## Verification Checklist

### Phase 1
- [ ] LinkedIn job page → click H → dashboard shows full JD, location, salary, jobType
- [ ] Track same job twice → "Already tracked!" amber toast
- [ ] Sidebar shows collapsible JD section with Show more/less

### Phase 2
- [ ] Glassdoor job page → H button appears → tracks correctly
- [ ] Workday job page → H button appears → tracks correctly

### Phase 3
- [ ] Click "Apply" on LinkedIn → job auto-tracked without clicking H
- [ ] Extension icon shows badge count → resets when popup opens

### Phase 4
- [ ] Profile → Connect Gmail → OAuth flow → shows connected status
- [ ] "Scan now" → finds rejection emails → stage changes to Rejected
- [ ] Dashboard shows notification banner for auto-detected rejections
