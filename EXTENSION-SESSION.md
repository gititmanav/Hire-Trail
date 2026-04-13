# HireTrail Extension — Bug & Improvement Session

## Quick Context
Chrome MV3 extension that tracks job applications from job boards into the HireTrail web app. User clicks the floating "H" button (or apply buttons are auto-detected) on supported portals, and the extension scrapes job data and POSTs it to the backend API.

**Deployed at:** `https://hiretrail.manavkaneria.me`
**Extension:** Load unpacked from `extension/` directory

---

## Extension File Structure

```
extension/
├── manifest.json          # MV3 config, permissions, content script matches
├── content/
│   └── content.js         # FAB button, scrapers for 6 portals, auto-detect, toasts
├── background/
│   └── background.js      # Service worker: trackJob(), Google login, badge count
├── popup/
│   ├── popup.html         # Login/logged-in views
│   ├── popup.js           # Auth logic, badge count display
│   └── popup.css          # Popup styles
└── icons/                 # Extension icons (16, 48, 128)
```

---

## Supported Portals & Scraper Selectors

### 1. LinkedIn (`linkedin.com`)
- **Match:** `https://www.linkedin.com/jobs/*`
- **Title:** `.job-details-jobs-unified-top-card__job-title` → `h1`
- **Company:** `.job-details-jobs-unified-top-card__company-name` → `.jobs-unified-top-card__company-name`
- **JD:** `.jobs-description__content` → `#job-details` (`.innerText`)
- **Location:** `.tvm__text` → `.job-details-jobs-unified-top-card__bullet`
- **Salary:** `[class*='salary']` → `.job-details-jobs-unified-top-card__job-insight span`
- **Apply selectors:** `button[aria-label*="Apply"]`, `.jobs-apply-button`

### 2. Indeed (`indeed.com`)
- **Match:** `https://www.indeed.com/viewjob*`, `/jobs*`, `/rc/clk*`
- **Title:** `[data-testid="jobsearch-JobInfoHeader-title"]` → `h1`
- **Company:** `[data-testid="inlineHeader-companyName"]` → `.jobsearch-InlineCompanyRating-companyHeader`
- **JD:** `#jobDescriptionText`
- **Location:** `[data-testid="jobsearch-JobInfoHeader-companyLocation"]` → `[data-testid="job-location"]`
- **Salary:** `.salary-snippet` → `#salaryInfoAndJobType span`
- **JobType:** `.jobsearch-JobMetadataHeader-item`
- **Apply selectors:** `.indeed-apply-button`

### 3. Greenhouse (`boards.greenhouse.io`)
- **Match:** `https://boards.greenhouse.io/*/jobs/*`
- **Title:** `.app-title` → `h1`
- **Company:** `.company-name`
- **JD:** `#content .body` → `#content`
- **Location:** `.location`
- **Apply selectors:** `.apply-button`, `#apply_button`

### 4. Lever (`jobs.lever.co`)
- **Match:** `https://jobs.lever.co/*`
- **Title:** `.posting-headline h2`
- **Company:** `.posting-headline .sort-by-time` → `.posting-headline a`
- **JD:** `[data-qa="job-description"]` → `.section.page-centered`
- **Location:** `.sort-by-location` → `.posting-categories .location`
- **JobType:** `.commitment`
- **Apply selectors:** `.postings-btn-submit`

### 5. Glassdoor (`glassdoor.com`)
- **Match:** `https://www.glassdoor.com/job-listing/*`, `/Job/*`
- **Title:** `[data-test="job-title"]` → `h1`
- **Company:** `[data-test="employer-name"]`
- **JD:** `[data-test="description"]`
- **Location:** `[data-test="job-location"]`
- **Salary:** `[data-test="detailSalary"]`
- **Apply selectors:** `button[data-test="apply-button"]`
- **Note:** Glassdoor frequently A/B tests their UI — selectors may need updating

### 6. Workday (`*.myworkdayjobs.com`)
- **Match:** `https://*.myworkdayjobs.com/*`
- **Strategy:** JSON-LD structured data (primary) + `data-automation-id` DOM selectors (fallback)
- **JSON-LD:** `script[type="application/ld+json"]` → `.title`, `.hiringOrganization.name`, `.description`, `.jobLocation.address.addressLocality`, `.employmentType`
- **DOM Title:** `a[data-automation-id="jobTitle"]` → `[data-automation-id="jobPostingHeader"]` → `h2`
- **DOM Company:** JSON-LD `hiringOrganization.name` → subdomain extraction (e.g., `pg.wd5.myworkdayjobs.com` → "Pg")
- **DOM JD:** `[data-automation-id="richTextBody"]` → `[data-automation-id="jobPostingDescription"]`
- **DOM Location:** `[data-automation-id="jobPostingLocation"]` → `[data-automation-id="locations"]`
- **Apply selectors:** `button[data-automation-id="applyButton"]`
- **SPA handling:** `waitForSelector()` with MutationObserver (8s timeout) waits for `jobTitle`, `jobPostingHeader`, or `richTextBody` before showing FAB
- **Example URL:** `https://pg.wd5.myworkdayjobs.com/en-US/1000/details/Brand-Manager-Internship_R000140820`

---

## Features Implemented

### Data Captured Per Job
Each scraper returns: `{ title, company, jobDescription, location, salary, jobType }`

The background script sends to `POST /api/applications`:
```json
{
  "company": "data.company || 'Unknown'",
  "role": "data.title || 'Unknown'",
  "jobUrl": "current page URL",
  "stage": "Applied",
  "notes": "",
  "resumeId": "from /auth/me primaryResumeId",
  "jobDescription": "scraped JD text",
  "location": "scraped location",
  "salary": "scraped salary",
  "jobType": "scraped job type"
}
```

### Duplicate Detection
- Backend returns `409 { error: "Already tracked", applicationId }` if same `jobUrl` exists for user
- Background script returns `{ success: false, duplicate: true, error: "Already tracked!" }`
- Content script shows amber (#f59e0b) toast "Already tracked!" for duplicates (not red error)

### Auto-detect Apply Clicks
- `setupApplyDetection()` runs after FAB is created
- Event delegation on `document.body` with `capture: true`
- Portal-specific apply button selectors (see above)
- 5-second debounce prevents double-tracking
- Uses `async/await` with try-catch (robust for MV3 service worker lifecycle)
- Shows "Auto-tracked!" success toast; silent on 409 duplicate
- Silently skips if user is not authenticated

### Badge Count
- After successful `trackJob()`: increments `badgeCount` in `chrome.storage.local`
- Sets `chrome.action.setBadgeText({ text: count })` with blue (#378add) background
- Daily reset via `chrome.alarms.create('resetBadge', { periodInMinutes: 1440 })`
- Popup shows "X jobs tracked today" on open, then resets badge to 0

### Authentication
1. **Existing JWT** in `chrome.storage.local` (already logged in)
2. **Auto-login from web cookie** — reads `connect.sid` cookie via `chrome.cookies.get()`, exchanges for JWT via `POST /api/auth/extension-token`
3. **Email/password** — `POST /api/auth/token` → JWT
4. **Google OAuth** — `chrome.identity.launchWebAuthFlow` → Google access token → `POST /api/auth/google/extension` → JWT

---

## Backend API Endpoints Used by Extension

```
POST /api/auth/token              # email/password → { token, user }
POST /api/auth/google/extension   # { accessToken } → { token, user }
POST /api/auth/extension-token    # session cookie → { token, user }
GET  /api/auth/me                 # Bearer token → user object (for primaryResumeId)
POST /api/applications            # create application (returns 201 or 409)
```

### Application Model Fields
```
userId, company, companyId, role, jobUrl, applicationDate, stage,
stageHistory[], jobDescription, location, salary, jobType, notes,
resumeId, contactId, outreachStatus, archived, archivedAt, archivedReason
```

### Zod Validation (createApplicationSchema)
```
company: string, min 1, max 200 (required)
role: string, min 1, max 200 (required)
jobUrl: string URL or "" (default "")
stage: enum (default "Applied")
jobDescription: string, max 50000 (default "")
location: string, max 200 (default "")
salary: string, max 200 (default "")
jobType: string, max 200 (default "")
notes: string, max 5000 (default "")
resumeId, companyId, contactId: nullable string refs
outreachStatus: enum (default "none")
```

---

## Manifest Permissions

```json
{
  "permissions": ["activeTab", "storage", "cookies", "identity", "alarms"],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://www.indeed.com/*",
    "https://boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://www.glassdoor.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://hiretrail.manavkaneria.me/*"
  ]
}
```

---

## Known Issues & Areas for Improvement

### Scraper Reliability
- **LinkedIn** frequently changes class names — `.job-details-jobs-unified-top-card__*` may break
- **Glassdoor** A/B tests DOM structure — `[data-test="*"]` selectors may not always be present
- **Workday** JSON-LD is the most reliable path; DOM selectors are fallback
- **Indeed** salary selector (`.salary-snippet`) only appears on some listings

### Extension UX
- FAB button overlaps with some site UIs (e.g., LinkedIn's chat widget)
- No visual feedback while background script fetches `/auth/me` for resumeId
- Toast disappears after 3s — may be too fast for slow connections
- Badge count doesn't distinguish between manual and auto-tracked jobs

### Auto-detect Edge Cases
- LinkedIn "Easy Apply" opens a modal — the apply button selector may not catch the initial click
- Indeed "Apply now" sometimes redirects to external site — content script loses context
- Glassdoor apply button might be behind a login wall

### Missing Features
- No settings/options page for the extension
- No way to edit or undo a tracked application from the extension
- No support for job search results pages (only individual job detail pages)
- No offline queueing — if API is down, tracking silently fails

---

## How to Test

1. `chrome://extensions` → Developer mode → Load unpacked → select `extension/` folder
2. Click extension icon → log in (email/password or Google)
3. Navigate to a supported job page
4. Click the blue "H" button → should show "Tracked!" toast
5. Click "H" again on same job → should show amber "Already tracked!" toast
6. Click an "Apply" button on the page → should auto-track (check for "Auto-tracked!" toast)
7. Check extension icon for blue badge number
8. Open popup → should show "X jobs tracked today"
9. Open HireTrail web app → verify application appears with JD, location, salary, jobType

### Test URLs
- **LinkedIn:** Any job at `https://www.linkedin.com/jobs/view/...`
- **Indeed:** Any job at `https://www.indeed.com/viewjob?jk=...`
- **Greenhouse:** e.g., `https://boards.greenhouse.io/stripe/jobs/...`
- **Lever:** e.g., `https://jobs.lever.co/notion/...`
- **Glassdoor:** Any job listing page
- **Workday:** e.g., `https://pg.wd5.myworkdayjobs.com/en-US/1000/details/Brand-Manager-Internship_R000140820`
