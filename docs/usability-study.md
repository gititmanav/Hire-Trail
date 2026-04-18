# HireTrail — Usability Study Report

> **Access:** This document is shared with **john.guerra@gmail.com** with Editor access.
> **Recording evidence:** Every session is recorded (screen + audio + webcam). Links are listed under each participant below, stored in a shared Google Drive folder also shared with `john.guerra@gmail.com`.

---

## Authors

- **Manav Kaneria** — participants P1–P3
- **Tisha Anil Patel** — participants P4–P6

Total: **6 participants** (3 per team member, per rubric requirement).

---

## Application Scope

### Application description

**HireTrail** is a full-stack web application that acts as an internship and full-time recruiting command center for college students and early-career job seekers. It combines five modules — Dashboard, Applications, Resumes, Contacts, and Deadlines — into one tool so users stop losing information across spreadsheets, sticky notes, and email threads. Users can track each application through timestamped stages (Applied → OA → Interview → Offer / Rejected), upload and tag multiple resume versions (PDF/Word via Cloudinary), link contacts (recruiters, referrals) directly to applications, and schedule urgency-coded deadlines. The dashboard aggregates funnel metrics, stage conversion rates, weekly application trends, and resume-to-response-rate performance so the user can make data-driven decisions about where to focus next.

### Users — target audience

**Primary persona 1 — The Active Student Recruit**
- Undergraduate or graduate CS/STEM student, ages 19–26.
- Applying to 30–150+ internships or new-grad roles in a single recruiting season.
- Uses multiple resume versions (SWE, Full-Stack, ML, etc.) and needs to know which performs.
- Tech-savvy, expects modern web apps, comfortable on laptop.
- Pain point: loses track of where they applied and which resume went to which company.

**Primary persona 2 — The Career Switcher**
- Working professional (ages 25–40) transitioning careers, often from non-CS backgrounds.
- Smaller application volume (20–60) but deeper research per company.
- Relies heavily on referrals and networking — tracks recruiters and alumni introductions.
- Moderately tech-savvy; cares about clarity and feeling "in control."
- Pain point: relationship data scattered across LinkedIn DMs, email, and notes.

**Secondary persona — The Career-Services Coach**
- University career advisor (ages 30–55) guiding cohorts of students.
- Wants a consistent way for students to self-report status so advising sessions start faster.
- Less direct user, but shapes what features students are told to use.

### Data description

The application stores and displays, per authenticated user:

- **Applications** — company, role, job URL, application date, current stage, stage history (timestamped), linked resume, linked contacts, free-text notes.
- **Resumes** — version name, target role, tags (user-defined, auto-remembered), file (PDF/Word uploaded to Cloudinary), upload date, derived usage count.
- **Contacts** — name, company, role, LinkedIn URL, connection source (Cold email / Referral / Career fair / LinkedIn / Professor intro / Alumni network), last contact date, free-text notes.
- **Deadlines** — type (OA due date / Follow-up reminder / Interview prep / Offer decision / Thank you note), due date, linked application, completion state.
- **Users** — name, email, bcrypt-hashed password (or Google OAuth ID).
- **Sessions** — server-side, stored in MongoDB via connect-mongo.

Derived/aggregated data displayed:

- Stage funnel counts and per-stage-transition conversion rates.
- Weekly application trend (applications grouped by ISO week).
- Resume-to-response-rate (response = any app in OA / Interview / Offer stage).
- Per-company application rollups with stacked stage bar.

The database is seeded with **1,058 synthetic records** (650 applications, 220 contacts, 180 deadlines, 8 resumes) for a realistic testing environment.

### Main tasks — use cases

Each task is measurable (completes successfully or not, time taken, error count).

| Task | Description | Success criteria |
|---|---|---|
| **T1 — Log a new application end-to-end** | You just applied to Stripe for a Backend Engineer Intern role. Record the application, pick the best matching resume version, link a recruiter contact you already have saved, and set the OA deadline to one week from today. | A new row appears on the Applications page with stage "Applied", linked resume, at least one linked contact, and a new deadline appears on the Deadlines page under "Upcoming". |
| **T2 — Review progress with a specific company** | You're particularly interested in how your Microsoft applications are going. Find all Microsoft applications, open the one currently in the Interview stage, review its stage history and linked resume, then jump to the resume's preview from that detail view. | Participant reaches the Interview app's detail sidebar and opens the linked resume preview without asking for help. |
| **T3 — Compare resume performance by tag** | You want to know which of your "frontend"-tagged resumes converts applications to interviews best. Filter the Resumes page to only the "frontend" tag, identify which version has been used most, then return to the dashboard and locate that same version in the Resume Performance table. | Participant filters by tag on /resumes, names the most-used version, and finds it on the dashboard table. |

---

## Experiment

### Preparation

**Recording setup**
- macOS Screen Recording + built-in microphone (tested ≥ −12 dB input level).
- Webcam tile for facial expression capture.
- Zoom meeting (cloud-recorded, local MP4 backup) for remote participants.
- Screen zoom at 100%, browser at 1440×900, tour + seed data reset before each session (`npm run seed`).

**Pre-session checklist**
- [ ] Confirmed recording permission in writing.
- [ ] Reset database for a clean demo user state, or created a dedicated per-participant demo account.
- [ ] Disabled notifications on host machine.
- [ ] Shared screen control permission request prepared (Zoom).
- [ ] Timer ready (stopwatch per task).
- [ ] Note-taking doc open on a second monitor.

### Introduction script (read aloud at the start, ~2 min)

> Hi [name], thanks so much for taking 45 minutes to help us test HireTrail. Before we start a few quick things:
>
> 1. I'd like to record the screen, the audio, and the webcam for this session. The recording is only used by our team and our course instructor to analyze usability issues. It won't be posted publicly. **Is that OK with you?** *(wait for verbal yes)*
> 2. As you use the app, please **think out loud** — narrate what you're trying to do, what you expect to happen, and what feels surprising or confusing. There's no wrong thing to say.
> 3. You're **not being evaluated**. We are evaluating the app, not you. If something doesn't work, that's exactly the feedback we need.
> 4. You can **stop at any time**, skip any question, or take a break. Just let me know.
> 5. I'll ask you to imagine you're a job-hunting student tracking a recruiting season. Even if that's not you right now, please put yourself in that mindset.
>
> Any questions before we start?

### Demographics questions (optional — participant may skip any)

1. Age range — 18–24 / 25–34 / 35–44 / 45+ / prefer not to say
2. Current occupation — student / software engineer / other / prefer not to say
3. How many job or internship applications have you submitted in the last 12 months? — 0 / 1–10 / 11–50 / 50+ / prefer not to say
4. What tools do you currently use to track applications? — spreadsheet / notion / a tracker app / email inbox / nothing / other / prefer not to say
5. How comfortable are you with modern web dashboards on a 1–5 scale, where 5 is very comfortable? — *open scale* / prefer not to say

### Intuitiveness script (read before any task, ~3 min)

> I'm going to show you the app's home screen and let you **explore for 60 seconds** without any specific goal. As you look around, tell me: what do you think this app does? What can you do here? What would you click first if you wanted to start tracking a job application?
>
> *(After 60 s)* Now I'll give you three specific tasks.

### Task 1 script (~8 min)

> You just applied to **Stripe** for a **Backend Engineer Intern** role. Please record this application in HireTrail. While you're adding it, pick the **SWE Resume v3** version as the resume you used. If you already have a recruiter contact stored, link at least one contact to this application. Finally, add a **deadline** for the online assessment one week from today. Let me know when you feel the application is fully recorded.

*Observer collects:* completion (Y/N), time-to-complete, number of wrong clicks, any help requested.

### Task 2 script (~8 min)

> You're particularly interested in how your **Microsoft** applications are going. Please find all Microsoft applications. Then open the one currently in the **Interview** stage, review its stage history and which resume was linked. From that detail view, open a preview of the resume itself. Tell me which resume was used once you see it.

### Task 3 script (~8 min)

> You want to figure out which of your resumes tagged **"frontend"** performs best. On the Resumes page, filter to only **frontend**-tagged resumes. Tell me which version has been used on the most applications. Then navigate back to the dashboard and locate that same version in the **Resume Performance** table.

### Post-test questionnaire — Likert scales (5-point: 1 = very poor / very hard, 5 = excellent / very easy)

| Question | Score |
|---|---|
| How **effective** was the application for T1 (logging a new application)? | ⃞ |
| How **intuitive / easy to use** was the application for T1? | ⃞ |
| How **effective** was the application for T2 (reviewing Microsoft applications)? | ⃞ |
| How **intuitive / easy to use** was the application for T2? | ⃞ |
| How **effective** was the application for T3 (comparing resume performance by tag)? | ⃞ |
| How **intuitive / easy to use** was the application for T3? | ⃞ |
| How **effective** was the application **overall**? | ⃞ |
| How **intuitive / easy to use** was the application **overall**? | ⃞ |

**Open-ended questions**
- What was the single most frustrating moment, if any?
- What did you enjoy most?
- What one feature would you add if you had a developer for a day?
- Any final comments or suggestions for improvement?

### Session timing plan (total 45 min)

| Segment | Duration |
|---|---|
| Intro + consent | 3 min |
| Demographics | 3 min |
| Intuitiveness (free exploration) | 3 min |
| T1 | 8 min |
| T2 | 8 min |
| T3 | 8 min |
| Post-test questionnaire | 7 min |
| Thank-you + off-record chat | 5 min |
| **Total** | **45 min** |

---

## Experiment Notes

After each session: within 30 minutes, write raw impressions in the participant section below. **Then** re-watch the recording and annotate moments of hesitation (> 3 s of silence, visible confusion, wrong clicks, verbal frustration) with timestamps.

---

## Participant 1 — [Initials only, e.g. "J.K."] (Manav)

- **Session date:** YYYY-MM-DD
- **Session length:** __ min
- **Recording link:** [Google Drive — P1](https://drive.google.com/…) *(shared with john.guerra@gmail.com)*

### Demographics answers
- Age range: __
- Current occupation: __
- Applications in last 12 months: __
- Current tracking tool: __
- Web-dashboard comfort (1–5): __

### Detailed notes

**Notes for initial approach (intuitiveness)**
- Observations about what the participant thought the app was for.
- First element they hovered / clicked.
- Any labels they misinterpreted.

**Notes for T1 — Log a new application**
- Time to complete: __ (or DID NOT COMPLETE)
- Wrong clicks: __
- Hesitation points (timestamp → description):
  -
  -
- Quotes:
  -

**Notes for T2 — Review Microsoft applications**
- Time to complete: __
- Wrong clicks: __
- Hesitation points:
  -
- Quotes:
  -

**Notes for T3 — Compare resumes by tag**
- Time to complete: __
- Wrong clicks: __
- Hesitation points:
  -
- Quotes:
  -

### Post-test questionnaire results

| Question | Score (1–5) |
|---|---|
| Effective — T1 | __ |
| Intuitive — T1 | __ |
| Effective — T2 | __ |
| Intuitive — T2 | __ |
| Effective — T3 | __ |
| Intuitive — T3 | __ |
| Overall effective | __ |
| Overall intuitive | __ |

**Open-ended responses**
- Most frustrating: __
- Enjoyed most: __
- Feature wish: __
- Final comments: __

---

## Participant 2 — [Initials] (Manav)

*(Repeat the Participant 1 template verbatim.)*

---

## Participant 3 — [Initials] (Manav)

*(Repeat.)*

---

## Participant 4 — [Initials] (Tisha)

*(Repeat.)*

---

## Participant 5 — [Initials] (Tisha)

*(Repeat.)*

---

## Participant 6 — [Initials] (Tisha)

*(Repeat.)*

---

## Aggregate Likert Scores

Fill after all 6 sessions. Use averages rounded to 1 decimal.

| Question | P1 | P2 | P3 | P4 | P5 | P6 | **Mean** |
|---|---|---|---|---|---|---|---|
| Effective — T1 | | | | | | | |
| Intuitive — T1 | | | | | | | |
| Effective — T2 | | | | | | | |
| Intuitive — T2 | | | | | | | |
| Effective — T3 | | | | | | | |
| Intuitive — T3 | | | | | | | |
| Overall effective | | | | | | | |
| Overall intuitive | | | | | | | |

---

## Prioritized List of Issues & Changes

> After synthesizing notes across all 6 participants, extract the patterns (an issue that only 1 person hit is interesting; an issue 3+ people hit is a must-fix). Use **MoSCoW** priorities: **Must / Should / Could / Would**.

### Example issues we anticipate surfacing (replace with real findings)

---

**Issue 1 (placeholder — replace with observed)**
- **Issue:** 2 of 6 participants didn't realize the caret (▸) next to a company name in the Applications page was interactive, so they couldn't find individual Microsoft apps quickly (T2).
- **Change:** Add a faint "N apps — click to expand" hint on hover and animate the caret on first page load.
- **Priority:** Should
- **Was it implemented? How?** YES — added `aria-describedby` tooltip "Click to expand" on every group toggle, and the row background lightens on hover. Commit `abc1234`.

---

**Issue 2 (placeholder — replace with observed)**
- **Issue:** 3 of 6 participants couldn't find the resume file upload control — they tried to drag-drop a PDF onto the resume card, but the actual input was inside the "Edit resume" modal.
- **Change:** Add a drag-and-drop zone to the Resumes page that opens the new-resume modal pre-filled with the file. Label the file input clearly in the modal.
- **Priority:** Must
- **Was it implemented? How?** PARTIAL — added clearer label "Upload PDF or Word, up to 8 MB" next to the file input in the modal. Drag-and-drop on the card grid deferred — tracked as follow-up.

---

**Issue 3 (placeholder — replace with observed)**
- **Issue:** 1 of 6 participants missed the tag-filter chips at the top of the Resumes page because their eye went straight to the cards.
- **Change:** Add a subtle label "Filter:" before the tag chips on the Resumes page and increase vertical spacing.
- **Priority:** Could
- **Was it implemented? How?** YES — prefixed the tag filter row with a "Filter:" label. Commit `def5678`.

---

**Issue 4 — [your observation]**
- **Issue:**
- **Change:**
- **Priority:** Must / Should / Could / Would
- **Was it implemented? How?**

*(Add as many as your data supports — 4–7 issues is typical.)*

---

# Appendix — Notes for Manav & Tisha (things to NOT lose points on)

### Things the rubric grader will literally look for

1. **3 participants per team member** — 6 total. Single-submit anything under that drops the whole 30 pts.
2. **Document shared with `john.guerra@gmail.com`** — Editor access, not just view. Confirm before submitting.
3. **Recording evidence linked per participant** — not a single folder mention. Each participant section needs a link the grader can actually click and confirm they exist.
4. **Demographics + consent proof** — the audio of the participant saying "yes, I consent" is acceptable evidence; your intro script above requests it explicitly.
5. **Likert scores present AND numeric** — fill every cell. Blanks look like skipped work.
6. **"Was it implemented? How?"** — every issue needs this answer, even if the answer is "Not implemented — deferred because …". Don't leave it blank.
7. **MoSCoW priorities assigned** — Must / Should / Could / Would, not just "high/medium/low".
8. **Issues tied to observations** — "3 of 6 participants did X" is gold. Avoid "users might find this confusing" — that's a guess, not data.

### Process discipline

- **Record _before_ the intro starts**, ending _after_ the goodbye. Starts/stops mid-session look sloppy.
- Rotate between recruiting participants you don't know well — roommates and close friends can unconsciously soften feedback.
- **Don't help the participant during a task.** Even a "you might want to look up there" contaminates the data. Sit on your hands. If they're totally stuck for >2 minutes, say: "Let's move on. What were you expecting to happen?"
- **Write notes within 30 min of the session while short-term memory is warm.** Then re-watch the recording the next day with fresh eyes — that's when the real issues jump out.
- **Quote participants directly** in notes. "I don't know where to click" beats "user was confused."

### Content discipline

- Tasks must be **specific and measurable**. Every task in this doc has a defined success criterion — keep it that way. Don't drift into "have a look around and tell us what you think."
- Personas should sound **like real people**, not generic "the user." This doc's two primary personas describe concrete behavior, not just demographics. Keep that in your write-up.
- Data description lists **what's stored AND what's displayed**. Both matter.
- **Don't summarize what the grader can already see in the code.** The value of this report is the *observations*, not the feature list.

### Video for the final project (separate deliverable, but linked)

- Your narrated demo video (10 pts) should mention the usability study findings briefly — "we ran 6 sessions and found three issues, and here's what we shipped in response." That ties the final project's design-iteration story together.
- Make sure **both team members appear and speak** in the video. Solo presenters have lost points in prior semesters.

### Deploy + code freeze

- Usability sessions must run against **a working build**. If your Vercel deployment isn't stable 48h before class, run sessions locally but note that explicitly in the participant section ("session run on local dev build at commit `abc1234`"). Graders accept this if it's transparent.
- **Code freeze = 24h before class.** The usability report can be edited after freeze (it's a writeup, not code), but any issue you mark as "implemented" has to actually be in the code before freeze.

### Likert mechanical tips

- Use **the same Likert scale direction** throughout. This template uses 1 = bad, 5 = good. Don't flip halfway through.
- Average scores per task and per metric across participants — the grader wants to see a per-task story, not just overall.
- If every score is 4–5, either you have amazing UX or participants are being polite. Skewed high scores combined with a thin issues list is a red flag to a trained grader. Lean into the issues you find even if overall scores are great.

### Time budget suggestion

| Activity | Manav | Tisha |
|---|---|---|
| Recruit 3 participants + schedule | 1 hr | 1 hr |
| Run 3 sessions @ 45 min | 2.25 hr | 2.25 hr |
| Write raw notes right after | 1.5 hr | 1.5 hr |
| Re-watch recordings + timestamp | 2 hr | 2 hr |
| Cross-synthesize issues (together) | 2 hr (jointly) | |
| Implement/close out "Must" issues | 2–4 hr (jointly, if any) | |

Budget **~10 hours of combined team effort** for this deliverable. The re-watch step is the one people skip and lose points on — don't skip it.

---

*End of report template.*
