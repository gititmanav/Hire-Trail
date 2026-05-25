/**
 * Reusable seed logic — called by both CLI `npm run seed` and admin API route.
 * Creates demo user with applications, resumes, contacts, deadlines, and companies.
 */
import { User } from "../models/User.js";
import { Application, STAGES, Stage } from "../models/Application.js";
import { Resume } from "../models/Resume.js";
import { Contact } from "../models/Contact.js";
import { Deadline } from "../models/Deadline.js";
import { Company } from "../models/Company.js";
import { TailorSession } from "../models/TailorSession.js";

const COMPANIES: { name: string; domain: string; website: string }[] = [
  { name: "Google", domain: "google.com", website: "https://careers.google.com" },
  { name: "Meta", domain: "meta.com", website: "https://www.metacareers.com" },
  { name: "Amazon", domain: "amazon.com", website: "https://www.amazon.jobs" },
  { name: "Apple", domain: "apple.com", website: "https://jobs.apple.com" },
  { name: "Microsoft", domain: "microsoft.com", website: "https://careers.microsoft.com" },
  { name: "Netflix", domain: "netflix.com", website: "https://jobs.netflix.com" },
  { name: "Stripe", domain: "stripe.com", website: "https://stripe.com/jobs" },
  { name: "Airbnb", domain: "airbnb.com", website: "https://careers.airbnb.com" },
  { name: "Uber", domain: "uber.com", website: "https://www.uber.com/us/en/careers/" },
  { name: "Lyft", domain: "lyft.com", website: "https://www.lyft.com/careers" },
  { name: "Spotify", domain: "spotify.com", website: "https://www.lifeatspotify.com" },
  { name: "Slack", domain: "slack.com", website: "https://slack.com/careers" },
  { name: "Dropbox", domain: "dropbox.com", website: "https://www.dropbox.com/jobs" },
  { name: "Twilio", domain: "twilio.com", website: "https://www.twilio.com/company/jobs" },
  { name: "Snowflake", domain: "snowflake.com", website: "https://careers.snowflake.com" },
  { name: "Databricks", domain: "databricks.com", website: "https://www.databricks.com/company/careers" },
  { name: "Palantir", domain: "palantir.com", website: "https://www.palantir.com/careers/" },
  { name: "Coinbase", domain: "coinbase.com", website: "https://www.coinbase.com/careers" },
  { name: "Robinhood", domain: "robinhood.com", website: "https://robinhood.com/careers/" },
  { name: "Square", domain: "squareup.com", website: "https://squareup.com/careers" },
  { name: "Shopify", domain: "shopify.com", website: "https://www.shopify.com/careers" },
  { name: "Atlassian", domain: "atlassian.com", website: "https://www.atlassian.com/company/careers" },
  { name: "Salesforce", domain: "salesforce.com", website: "https://www.salesforce.com/company/careers/" },
  { name: "Adobe", domain: "adobe.com", website: "https://www.adobe.com/careers.html" },
  { name: "Oracle", domain: "oracle.com", website: "https://www.oracle.com/careers/" },
  { name: "IBM", domain: "ibm.com", website: "https://www.ibm.com/employment/" },
  { name: "Goldman Sachs", domain: "goldmansachs.com", website: "https://www.goldmansachs.com/careers/" },
  { name: "JPMorgan", domain: "jpmorgan.com", website: "https://careers.jpmorgan.com" },
  { name: "Morgan Stanley", domain: "morganstanley.com", website: "https://www.morganstanley.com/people" },
  { name: "Bloomberg", domain: "bloomberg.com", website: "https://www.bloomberg.com/careers" },
  { name: "Citadel", domain: "citadel.com", website: "https://www.citadel.com/careers/" },
  { name: "Two Sigma", domain: "twosigma.com", website: "https://www.twosigma.com/careers/" },
  { name: "Jane Street", domain: "janestreet.com", website: "https://www.janestreet.com/join-jane-street/" },
  { name: "HRT", domain: "hudsonrivertrading.com", website: "https://www.hudsonrivertrading.com/careers/" },
  { name: "DRW", domain: "drw.com", website: "https://drw.com/careers/" },
  { name: "Nvidia", domain: "nvidia.com", website: "https://www.nvidia.com/en-us/about-nvidia/careers/" },
  { name: "Intel", domain: "intel.com", website: "https://jobs.intel.com" },
  { name: "AMD", domain: "amd.com", website: "https://www.amd.com/en/corporate/careers" },
  { name: "Tesla", domain: "tesla.com", website: "https://www.tesla.com/careers" },
  { name: "SpaceX", domain: "spacex.com", website: "https://www.spacex.com/careers/" },
  { name: "Figma", domain: "figma.com", website: "https://www.figma.com/careers/" },
  { name: "Notion", domain: "notion.so", website: "https://www.notion.so/careers" },
  { name: "Linear", domain: "linear.app", website: "https://linear.app/careers" },
  { name: "Vercel", domain: "vercel.com", website: "https://vercel.com/careers" },
  { name: "Supabase", domain: "supabase.com", website: "https://supabase.com/careers" },
  { name: "Datadog", domain: "datadoghq.com", website: "https://www.datadoghq.com/careers/" },
  { name: "Cloudflare", domain: "cloudflare.com", website: "https://www.cloudflare.com/careers/" },
  { name: "Elastic", domain: "elastic.co", website: "https://www.elastic.co/careers" },
  { name: "MongoDB Inc", domain: "mongodb.com", website: "https://www.mongodb.com/careers" },
  { name: "Confluent", domain: "confluent.io", website: "https://www.confluent.io/careers/" },
];

const ROLES = [
  "Software Engineer Intern", "SWE Intern", "Backend Engineer Intern",
  "Frontend Engineer Intern", "Full Stack Intern", "Data Engineer Intern",
  "ML Engineer Intern", "Platform Engineer Intern", "DevOps Intern",
  "Infrastructure Intern", "SRE Intern", "Mobile Engineer Intern",
  "iOS Engineer Intern", "Android Engineer Intern",
  "Software Development Engineer Intern", "Cloud Engineer Intern",
];

const RESUME_NAMES = [
  "SWE Resume v1", "SWE Resume v2", "SWE Resume v3",
  "Data Engineering Resume", "ML Resume", "Full Stack Resume",
  "Backend Focus Resume", "Frontend Focus Resume",
];

const RESUME_ROLES = [
  "Software Engineering", "Data Engineering", "Machine Learning",
  "Full Stack", "Backend", "Frontend", "Platform", "DevOps",
];

const PROTECTED_DEMO_RESUME = {
  name: "Software Engineer Resume (Locked)",
  targetRole: "Software Engineering",
  fileName: "demo-resume-software-engineer.pdf",
  fileUrl: "/demo-resume-software-engineer.pdf",
  tags: ["Software Engineering", "Demo", "Locked"],
} as const;

const CONTACT_NAMES = [
  "Sarah Chen", "James Wilson", "Priya Patel", "Michael Brown",
  "Emily Rodriguez", "David Kim", "Amanda Foster", "Ryan Thompson",
  "Jessica Martinez", "Kevin O'Brien", "Rachel Lee", "Andrew Davis",
  "Samantha Wright", "Daniel Park", "Olivia Johnson", "Chris Anderson",
  "Megan Taylor", "Brandon Nguyen", "Lauren Scott", "Tyler Washington",
  "Hannah Garcia", "Nathan Miller", "Sophia Clark", "Justin Harris",
  "Ashley Robinson", "Mark Lewis", "Kayla Walker", "Sean Murphy",
  "Elizabeth Moore", "Patrick Sullivan",
];

const CONTACT_ROLES_LIST = [
  "Recruiter", "Senior Recruiter", "University Recruiter",
  "Hiring Manager", "Engineering Manager", "Tech Lead",
  "Staff Engineer", "HR Coordinator", "Talent Acquisition",
  "Campus Recruiter",
];

const CONNECTION_SOURCES = [
  "Cold email", "Referral", "Career fair", "LinkedIn",
  "Professor intro", "Alumni network", "Other",
];

const DEADLINE_TYPES = [
  "OA due date", "Follow-up reminder", "Interview prep",
  "Offer decision", "Thank you note", "Other",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function weightedStage(): Stage {
  const r = Math.random();
  if (r < 0.4) return "Applied";
  if (r < 0.55) return "Rejected";
  if (r < 0.72) return "OA";
  if (r < 0.88) return "Interview";
  return "Offer";
}

export interface SeedResult {
  users: number;
  resumes: number;
  applications: number;
  contacts: number;
  deadlines: number;
  companies: number;
  total: number;
}

/* ------------------------- Demo date window -------------------------
 *
 * The demo data is anchored to a fixed 2026 window so the seeded apps,
 * contacts, and deadlines look "live" for whoever is poking at the app.
 *
 *   - applicationDate / stage history / contact.lastContactDate / resume.uploadDate:
 *       Jan 1 2026 → "today" (capped at DEMO_WINDOW_END so a future re-seed
 *       doesn't push dates past July 31).
 *   - deadline.dueDate:
 *       Jan 1 2026 → Jul 31 2026 (so a mix of overdue + upcoming surfaces in
 *       the Deadlines page and Dashboard widgets).
 *
 * If the current date falls outside this window we clamp — the demo dataset
 * is meant to look healthy regardless of when an admin presses "Run seed". */
const DEMO_WINDOW_START = new Date("2026-01-01");
const DEMO_WINDOW_END   = new Date("2026-07-31T23:59:59.999Z");

function demoNow(): Date {
  const now = new Date();
  if (now < DEMO_WINDOW_START) return DEMO_WINDOW_START;
  if (now > DEMO_WINDOW_END)   return DEMO_WINDOW_END;
  return now;
}

/** Create demo user + synthetic data. Does NOT clear existing data first. */
export async function runSeed(): Promise<SeedResult> {
  // Create demo user
  const existing = await User.findOne({ email: "demo@hiretrail.com" }).setOptions({ includeDeleted: true });
  let demoUser;
  if (existing) {
    demoUser = existing;
  } else {
    demoUser = await User.create({
      name: "Demo User",
      email: "demo@hiretrail.com",
      password: "password123",
    });
  }
  const userId = demoUser._id;

  // Companies — upsert all companies, add demo user to each
  const companyMap = new Map<string, any>();
  for (const c of COMPANIES) {
    const company = await Company.findOneAndUpdate(
      { name: c.name },
      {
        $setOnInsert: { name: c.name, website: c.website, domain: c.domain, createdBy: userId },
        $addToSet: { users: userId },
      },
      { upsert: true, new: true, collation: { locale: "en", strength: 2 } }
    );
    companyMap.set(c.name, company._id);
  }

  // Resumes — uploaded across early 2026 so the "Added" date column looks recent.
  const resumeUploadEnd = new Date("2026-03-01");
  const resumeDocs = RESUME_NAMES.map((name, i) => ({
    userId,
    name,
    targetRole: RESUME_ROLES[i] || "General",
    fileName: `${name.toLowerCase().replace(/ /g, "_")}.pdf`,
    uploadDate: randomDate(DEMO_WINDOW_START, resumeUploadEnd),
  }));
  const resumes = await Resume.insertMany(resumeDocs);

  const protectedResume = await Resume.findOneAndUpdate(
    { userId, name: PROTECTED_DEMO_RESUME.name },
    {
      $set: {
        targetRole: PROTECTED_DEMO_RESUME.targetRole,
        fileName: PROTECTED_DEMO_RESUME.fileName,
        fileUrl: PROTECTED_DEMO_RESUME.fileUrl,
        tags: PROTECTED_DEMO_RESUME.tags,
        isProtected: true,
      },
      $setOnInsert: {
        userId,
        name: PROTECTED_DEMO_RESUME.name,
        uploadDate: randomDate(DEMO_WINDOW_START, resumeUploadEnd),
      },
    },
    { upsert: true, new: true }
  );
  const resumeIds = [...resumes.map((r) => r._id), protectedResume._id];

  // Applications — spread from Jan 1 to "today" so nothing is dated in the future.
  // Stage-progression timestamps below also clamp to "today" so an Offer that
  // was applied-for last week doesn't get a "stage Offer date" in July.
  const today = demoNow();
  const startDate = DEMO_WINDOW_START;
  const endDate = today;
  const clampStage = (d: Date): Date => (d > today ? today : d);
  const appDocs = [];
  for (let i = 0; i < 650; i++) {
    const stage = weightedStage();
    const companyData = randomItem(COMPANIES);
    const appDate = randomDate(startDate, endDate);
    const stageHistory: { stage: Stage; date: Date }[] = [{ stage: "Applied", date: appDate }];
    if (["OA", "Interview", "Offer"].includes(stage)) stageHistory.push({ stage: "OA", date: clampStage(new Date(appDate.getTime() + 7 * 86400000)) });
    if (["Interview", "Offer"].includes(stage)) stageHistory.push({ stage: "Interview", date: clampStage(new Date(appDate.getTime() + 21 * 86400000)) });
    if (stage === "Offer") stageHistory.push({ stage: "Offer", date: clampStage(new Date(appDate.getTime() + 35 * 86400000)) });
    if (stage === "Rejected") stageHistory.push({ stage: "Rejected", date: clampStage(new Date(appDate.getTime() + (Math.floor(Math.random() * 30) + 3) * 86400000)) });
    appDocs.push({
      userId,
      company: companyData.name,
      companyId: companyMap.get(companyData.name) || null,
      role: randomItem(ROLES),
      jobUrl: `${companyData.website || "https://careers.example.com"}/job/${100000 + i}`,
      applicationDate: appDate, stage, stageHistory,
      notes: Math.random() > 0.6 ? "Referred by alumni" : "",
      resumeId: randomItem(resumeIds),
    });
  }
  const insertedApps = await Application.insertMany(appDocs);

  // Synthetic TailorSessions for the demo user — gives the Applications page
  // realistic fit-score badges without burning real LLM quota on 650 jobs.
  const SKILL_BANK = [
    "Python", "TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Kubernetes",
    "GraphQL", "REST", "Docker", "Redis", "Kafka", "Go", "System Design",
    "Distributed Systems", "Microservices", "ML", "Data Pipelines", "Testing",
    "CI/CD", "Terraform", "GCP", "Security", "Performance Optimization",
  ];
  const GRADES = ["A", "B", "C", "D", "F"] as const;
  // Weighted distribution: skew toward B/C for realism (most apps are "good not great")
  const GRADE_WEIGHTS = [0.15, 0.40, 0.30, 0.10, 0.05];
  const GRADE_TO_SCORE = { A: 5, B: 4, C: 3, D: 2, F: 1 } as const;
  const SUGGESTION_STUBS = [
    { section: "experience" as const, kind: "rewrite" as const, suggested: "Lead the redesign of the API layer to cut p99 latency by 40%.", rationale: "Mirrors the JD's focus on platform performance work." },
    { section: "summary" as const, kind: "rewrite" as const, suggested: "Senior backend engineer with 5+ years scaling distributed systems.", rationale: "Reframes summary around scale + ownership emphasis." },
    { section: "skills" as const, kind: "add" as const, suggested: "Kubernetes, Helm, Argo CD", rationale: "JD lists modern container orchestration as a requirement." },
    { section: "project" as const, kind: "emphasize" as const, suggested: "Bring the OSS sidecar project forward — it demonstrates the systems thinking they're hiring for.", rationale: "Project alignment with the team's open-source culture." },
    { section: "experience" as const, kind: "add" as const, suggested: "Owned the on-call rotation for the payments microservice tier.", rationale: "JD calls out operational maturity explicitly." },
  ];
  function pickGrade(): typeof GRADES[number] {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < GRADES.length; i += 1) {
      acc += GRADE_WEIGHTS[i];
      if (r <= acc) return GRADES[i];
    }
    return "C";
  }
  function pickSkills(n: number): string[] {
    const shuffled = [...SKILL_BANK].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }
  const sessionDocs = insertedApps.map((a) => {
    const grade = pickGrade();
    return {
      userId,
      applicationId: a._id,
      jobTitle: a.role,
      company: a.company,
      jobUrl: a.jobUrl,
      jobDescription: "(seeded — synthetic JD)",
      status: "succeeded" as const,
      fitScore: GRADE_TO_SCORE[grade],
      fitGrade: grade,
      summary: `${grade === "A" || grade === "B" ? "Strong" : grade === "C" ? "Mixed" : "Weak"} match. The role aligns with your ${grade === "A" ? "primary strengths" : "secondary skill set"}.`,
      matchedSkills: pickSkills(grade === "A" ? 6 : grade === "B" ? 5 : grade === "C" ? 4 : 2),
      missingSkills: pickSkills(grade === "F" ? 5 : grade === "D" ? 4 : 2),
      suggestions: SUGGESTION_STUBS.slice(0, 3 + Math.floor(Math.random() * 2)).map((s) => ({ ...s, targetCompanyOrName: a.company, targetBullet: "", tags: [], decision: null })),
      provider: "demo-seed",
      modelId: "synthetic",
    };
  });
  const insertedSessions = await TailorSession.insertMany(sessionDocs);
  // Link sessions back onto their applications.
  await Promise.all(insertedSessions.map((s) =>
    Application.updateOne({ _id: s.applicationId }, { $set: { tailorSessionId: s._id } })
  ));

  // Contacts
  const contactDocs = [];
  for (let i = 0; i < 220; i++) {
    const companyData = randomItem(COMPANIES);
    contactDocs.push({
      userId,
      name: randomItem(CONTACT_NAMES),
      company: companyData.name,
      companyId: companyMap.get(companyData.name) || null,
      role: randomItem(CONTACT_ROLES_LIST),
      linkedinUrl: `https://linkedin.com/in/person-${1000 + i}`,
      connectionSource: randomItem(CONNECTION_SOURCES),
      lastContactDate: randomDate(DEMO_WINDOW_START, today),
      notes: Math.random() > 0.5 ? "Great conversation, will follow up next week" : "",
    });
  }
  await Contact.insertMany(contactDocs);

  // Deadlines
  const appIds = (await Application.find({ userId }).select("_id").lean()).map((a) => a._id);
  const deadlineDocs = [];
  for (let i = 0; i < 180; i++) {
    const dueDate = randomDate(DEMO_WINDOW_START, DEMO_WINDOW_END);
    // Past deadlines are more likely to be completed; future deadlines stay open.
    // Keeps the Deadlines page realistic: overdue items are mostly checked off,
    // and the user has a visible upcoming workload.
    const completed = dueDate < today ? Math.random() > 0.25 : Math.random() > 0.85;
    deadlineDocs.push({
      userId, applicationId: Math.random() > 0.3 ? randomItem(appIds) : null,
      type: randomItem(DEADLINE_TYPES), dueDate,
      completed,
      notes: Math.random() > 0.5 ? "Check email for details" : "",
    });
  }
  await Deadline.insertMany(deadlineDocs);

  return {
    users: 1,
    resumes: resumes.length + 1,
    applications: appDocs.length,
    contacts: contactDocs.length,
    deadlines: deadlineDocs.length,
    companies: COMPANIES.length,
    total: 1 + resumes.length + appDocs.length + contactDocs.length + deadlineDocs.length + COMPANIES.length,
  };
}

/** Clear all data for the demo user only (preserves real users). */
export async function clearSeedData(): Promise<{ cleared: boolean }> {
  const demoUser = await User.findOne({ email: "demo@hiretrail.com" }).setOptions({ includeDeleted: true });
  if (!demoUser) return { cleared: false };

  await Promise.all([
    Application.deleteMany({ userId: demoUser._id }),
    Resume.deleteMany({ userId: demoUser._id }),
    Contact.deleteMany({ userId: demoUser._id }),
    Deadline.deleteMany({ userId: demoUser._id }),
    TailorSession.deleteMany({ userId: demoUser._id }),
    // Remove demo user from company users arrays; delete companies only created by demo with no other users
    Company.updateMany({}, { $pull: { users: demoUser._id } }),
  ]);
  // Clean up companies with no users
  await Company.deleteMany({ users: { $size: 0 } });
  await User.deleteOne({ _id: demoUser._id });
  return { cleared: true };
}
