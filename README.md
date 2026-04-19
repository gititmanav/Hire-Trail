# HireTrail — Internship & Job Application Command Center

![HireTrail Screenshot](screenshot.png)
![HireTrail Screenshot](screenshot2.png)

## Authors

- **Manav Kaneria** — Applications & Resumes module (full stack)
- **Tisha Anil Patel** — Contacts & Deadlines module (full stack)

Dashboard, authentication, accessibility pass, and usability study were worked on jointly.

## Class

[CS5610 Web Development — Northeastern University, Khoury College of Computer Sciences](https://johnguerra.co/classes/webDevelopment_fall_2025/)

## Links

- **Live App:** [https://hire-trail-webdev.vercel.app](https://hire-trail-webdev.vercel.app)
- **Demo Video:** [https://youtu.be/gXdi4DEMhLw](https://youtu.be/gXdi4DEMhLw)
- **Presentation Slides:** [https://docs.google.com/presentation/d/1EP8yyFO1Fp1cxK44g_lF3OL5UuxNCs7SAX7Zh3UlRoQ/edit?usp=sharing](https://docs.google.com/presentation/d/1EP8yyFO1Fp1cxK44g_lF3OL5UuxNCs7SAX7Zh3UlRoQ/edit?usp=sharing)
- **Design Document:** [https://drive.google.com/file/d/1uuVTc4PUYyaIpMTHK6DkAzHOQYuqdx5U/view?usp=sharing](https://drive.google.com/file/d/1uuVTc4PUYyaIpMTHK6DkAzHOQYuqdx5U/view?usp=sharing)

---

## Project Objective

HireTrail is a browser-based job-search command center for students and early-career professionals navigating internship and full-time recruiting cycles. It combines five interconnected modules into a single application:

- Track applications through every hiring stage with timestamped history and stage-by-stage drill-down
- Version resumes with tags, upload PDFs, preview them inline, and measure response rate per version
- Log contacts, referrals, and recruiters per company, toggle between People and Companies views, and link them to applications
- Manage deadlines with urgency-based color coding and completion tracking
- Customize a draggable dashboard that aggregates funnel conversion, weekly trends, and resume performance

The goal is to replace the scattered spreadsheets, sticky notes, and email threads that most students use during recruiting season.

---

## Features

### Dashboard
- At-a-glance stat cards: total applications, in-progress, offers, rejections
- Recent applications table with stage badges
- Upcoming deadlines sorted by urgency
- Embedded analytics: funnel chart, stage-to-stage conversion rates, weekly application trend, resume response-rate breakdown
- **Customizable layout** — toggle edit mode to drag and resize widgets, layout persisted per user

### Applications (Manav)
- Full CRUD with a detail sidebar that shows notes, linked resume, linked contacts, and full stage-change history
- Stage options: Applied, OA, Interview, Offer, Rejected — every change timestamped
- Filter by stage with count badges (color-coded to match the rest of the app)
- Search by company or role
- **Company grouping** — applications at the same company collapse into a single row with a stacked stage bar; expand the caret to see individual rows
- Pagination for large application lists

### Resumes (Manav)
- Full CRUD with real file upload — PDF/Word hosted on Cloudinary
- **Tags** on each resume version with autocomplete; **tag-filter chips** at the top of the page
- **Inline preview** — open a Cloudinary-hosted resume in a side panel without leaving the page
- Live usage count per version, computed with a MongoDB aggregation pipeline
- Linked to applications — each application references one resume version

### Contacts (Tisha)
- Full CRUD — name, company, role, LinkedIn URL, connection source, last contact date, notes
- Connection sources: Cold email, Referral, Career fair, LinkedIn, Professor intro, Alumni network
- **People / Companies toggle** — flip between a person-centric grid and a company-rollup view
- Contact detail sidebar
- Search by name or company

### Deadlines (Tisha)
- Full CRUD — deadlines linked to applications
- Types: OA due date, Follow-up reminder, Interview prep, Offer decision, Thank you note
- Tab filtering: Upcoming, Overdue, Completed, All
- Color-coded urgency (overdue red, urgent amber, soon blue, normal gray)
- One-click completion toggle with visual strikethrough

### Authentication
- Passport.js Local (email + password, bcrypt hashing)
- Passport.js Google OAuth 2.0
- **"Log in as Demo User"** button on the landing page — no signup needed to explore the app
- Server-side sessions stored in MongoDB via connect-mongo
- Protected routes — every API endpoint requires authentication

### Onboarding
- First-time login triggers a guided tour that walks new users through the sidebar, dashboard customization, and the five main modules

### Accessibility & Design
- WCAG AA compliant color palette — verified with axe DevTools across all pages
- Keyboard navigation throughout; focus indicators on every interactive element
- Proper heading hierarchy, landmark regions, and aria attributes
- Plus Jakarta Sans (headings) + Inter (body) — loaded via Google Fonts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 with hooks |
| Routing | React Router DOM v6 |
| Charts | Recharts |
| Dashboard layout | react-grid-layout |
| Type Checking | PropTypes |
| Backend | Node.js + Express (ES Modules) |
| Database | MongoDB Atlas with the native driver |
| File storage | Cloudinary (resumes) |
| Multipart uploads | multer |
| Authentication | Passport.js (Local + Google OAuth 2.0) |
| Sessions | express-session + connect-mongo |
| Password Hashing | bcrypt |
| Linting | ESLint |
| Formatting | Prettier |
| Deployment | Vercel (serverless) |

**Not used (per course rules):** Axios, Mongoose, CORS, or any other prohibited library.

---

## MongoDB Collections

| Collection | Owner | Operations |
|---|---|---|
| `users` | Shared | Create (register), Read (auth) |
| `applications` | Manav | Full CRUD + stage history tracking |
| `resumes` | Manav | Full CRUD + tags + Cloudinary file refs + usage aggregation |
| `contacts` | Tisha | Full CRUD |
| `deadlines` | Tisha | Full CRUD + completion toggling |
| `sessions` | System | Managed by connect-mongo |

Database is seeded with **1,000+ synthetic records** (a demo user, 180 deadlines, hundreds of applications/contacts/resumes) via `node backend/seed.js`.

---

## Usability Study

Six 45-minute moderated sessions were conducted (three per team member) following Prof. Guerra-Gomez's 5/10/5/tasks/Likert/5 format: warm-up and consent, free exploration and user-story listing, persona framing, three hands-on tasks with per-task Likert probes, and a wrap-up with overall ratings and open feedback. Findings were synthesized into a prioritized MoSCoW issue list; the top items (contact-linking searchability affordance, resume reassignment discoverability, company-group caret discoverability) were addressed before submission. Session recordings and the full report were submitted separately on Canvas.

---

## Project Structure

```
hiretrail/
├── api/
│   └── index.js               # Vercel serverless entrypoint
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB native driver connection
│   │   ├── passport.js        # Local + Google OAuth strategies
│   │   └── cloudinary.js      # Cloudinary configuration
│   ├── middleware/
│   │   └── auth.js            # Route protection middleware
│   ├── routes/
│   │   ├── auth.js            # Register, login, logout, Google OAuth, demo login
│   │   ├── applications.js    # Applications CRUD + stage history
│   │   ├── resumes.js         # Resumes CRUD + tags + file upload
│   │   ├── contacts.js        # Contacts CRUD
│   │   ├── deadlines.js       # Deadlines CRUD
│   │   └── analytics.js       # Aggregation pipelines
│   ├── server.js              # Express app entry (supports local + serverless)
│   ├── seed.js                # Synthetic data seeder (1,000+ records)
│   ├── .env.example           # Environment variable template
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApplicationDetail/
│   │   │   ├── DashboardGrid/      # Draggable/resizable layout wrapper
│   │   │   ├── DetailSidebar/      # Shared slide-in detail panel
│   │   │   ├── Layout/             # Sidebar + content wrapper
│   │   │   ├── MultiSelect/        # Searchable multi-select (contacts etc.)
│   │   │   ├── OnboardingTour/     # First-login guided tour
│   │   │   ├── Pagination/
│   │   │   ├── ProtectedRoute/
│   │   │   ├── ResumePreview/      # Inline Cloudinary PDF preview
│   │   │   ├── Sidebar/            # Main navigation
│   │   │   └── TagInput/           # Tag chips with autocomplete
│   │   ├── pages/
│   │   │   ├── Login/
│   │   │   ├── Register/
│   │   │   ├── Dashboard/          # Overview + embedded analytics + customizable grid
│   │   │   ├── Applications/       # Tracker with CRUD + company grouping
│   │   │   ├── Resumes/            # Version manager with tags + preview
│   │   │   ├── Contacts/           # People/Companies toggle
│   │   │   └── Deadlines/
│   │   ├── utils/
│   │   │   └── api.js              # Centralized fetch wrapper
│   │   ├── App.jsx                 # Root component with routing
│   │   ├── App.css                 # Global design tokens
│   │   └── main.jsx
│   ├── vite.config.js              # Vite config with API proxy
│   └── package.json
├── vercel.json                     # Vercel rewrites + build config
├── .gitignore
├── .prettierrc
├── LICENSE                         # MIT
├── README.md
└── screenshot.png
```

---

## Instructions to Build

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- Cloudinary account (for resume file uploads)
- Google Cloud Console project (optional, for OAuth)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/gititmanav/Hire-Trail.git
   cd Hire-Trail
   ```

2. **Install dependencies**

   ```bash
   npm run install-all
   ```

3. **Configure environment**

   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `backend/.env`:

   ```
   MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/HireTrail?retryWrites=true&w=majority
   SESSION_SECRET=any-random-string-here
   CLIENT_URL=http://localhost:5173
   PORT=5050

   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

   For Google OAuth (optional):

   ```
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5050/api/auth/google/callback
   ```

4. **Seed the database**

   ```bash
   npm run seed
   ```

   Creates a demo user (`demo@hiretrail.com` / `password123`) and 1,000+ synthetic records. The landing page also has a one-click "Log in as Demo User" button.

5. **Run in development**

   Terminal 1:
   ```bash
   cd backend && node --watch server.js
   ```

   Terminal 2:
   ```bash
   cd frontend && npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173)

6. **Build for production**

   ```bash
   npm run build
   npm start
   ```

---

## License

[MIT](LICENSE)
