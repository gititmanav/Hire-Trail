/**
 * Reusable seed logic — called by both CLI `npm run seed` and admin API route.
 */
import { User } from "../models/User.js";
import { Application, STAGES, Stage } from "../models/Application.js";
import { Resume } from "../models/Resume.js";
import { Contact } from "../models/Contact.js";
import { Deadline } from "../models/Deadline.js";

const COMPANIES = [
  "Google", "Meta", "Amazon", "Apple", "Microsoft", "Netflix", "Stripe",
  "Airbnb", "Uber", "Lyft", "Spotify", "Slack", "Dropbox", "Twilio",
  "Snowflake", "Databricks", "Palantir", "Coinbase", "Robinhood", "Square",
  "Shopify", "Atlassian", "Salesforce", "Adobe", "Oracle", "IBM",
  "Goldman Sachs", "JPMorgan", "Morgan Stanley", "Bloomberg", "Citadel",
  "Two Sigma", "Jane Street", "HRT", "DRW", "Nvidia", "Intel", "AMD",
  "Tesla", "SpaceX", "Figma", "Notion", "Linear", "Vercel", "Supabase",
  "Datadog", "Cloudflare", "Elastic", "MongoDB Inc", "Confluent",
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
  total: number;
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

  // Resumes
  const resumeDocs = RESUME_NAMES.map((name, i) => ({
    userId,
    name,
    targetRole: RESUME_ROLES[i] || "General",
    fileName: `${name.toLowerCase().replace(/ /g, "_")}.pdf`,
    uploadDate: randomDate(new Date("2025-01-01"), new Date("2025-06-01")),
  }));
  const resumes = await Resume.insertMany(resumeDocs);
  const resumeIds = resumes.map((r) => r._id);

  // Applications
  const startDate = new Date("2025-01-15");
  const endDate = new Date("2025-10-15");
  const appDocs = [];
  for (let i = 0; i < 650; i++) {
    const stage = weightedStage();
    const appDate = randomDate(startDate, endDate);
    const stageHistory: { stage: Stage; date: Date }[] = [{ stage: "Applied", date: appDate }];
    if (["OA", "Interview", "Offer"].includes(stage)) stageHistory.push({ stage: "OA", date: new Date(appDate.getTime() + 7 * 86400000) });
    if (["Interview", "Offer"].includes(stage)) stageHistory.push({ stage: "Interview", date: new Date(appDate.getTime() + 21 * 86400000) });
    if (stage === "Offer") stageHistory.push({ stage: "Offer", date: new Date(appDate.getTime() + 35 * 86400000) });
    if (stage === "Rejected") stageHistory.push({ stage: "Rejected", date: new Date(appDate.getTime() + (Math.floor(Math.random() * 30) + 3) * 86400000) });
    appDocs.push({
      userId, company: randomItem(COMPANIES), role: randomItem(ROLES),
      jobUrl: `https://careers.example.com/job/${100000 + i}`,
      applicationDate: appDate, stage, stageHistory,
      notes: Math.random() > 0.6 ? "Referred by alumni" : "",
      resumeId: randomItem(resumeIds),
    });
  }
  await Application.insertMany(appDocs);

  // Contacts
  const contactDocs = [];
  for (let i = 0; i < 220; i++) {
    contactDocs.push({
      userId, name: randomItem(CONTACT_NAMES), company: randomItem(COMPANIES),
      role: randomItem(CONTACT_ROLES_LIST), linkedinUrl: `https://linkedin.com/in/person-${1000 + i}`,
      connectionSource: randomItem(CONNECTION_SOURCES),
      lastContactDate: randomDate(startDate, endDate),
      notes: Math.random() > 0.5 ? "Great conversation, will follow up next week" : "",
    });
  }
  await Contact.insertMany(contactDocs);

  // Deadlines
  const appIds = (await Application.find({ userId }).select("_id").lean()).map((a) => a._id);
  const deadlineDocs = [];
  for (let i = 0; i < 180; i++) {
    const dueDate = randomDate(new Date("2025-03-01"), new Date("2025-12-31"));
    deadlineDocs.push({
      userId, applicationId: Math.random() > 0.3 ? randomItem(appIds) : null,
      type: randomItem(DEADLINE_TYPES), dueDate,
      completed: Math.random() > 0.6,
      notes: Math.random() > 0.5 ? "Check email for details" : "",
    });
  }
  await Deadline.insertMany(deadlineDocs);

  return {
    users: 1,
    resumes: resumes.length,
    applications: appDocs.length,
    contacts: contactDocs.length,
    deadlines: deadlineDocs.length,
    total: 1 + resumes.length + appDocs.length + contactDocs.length + deadlineDocs.length,
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
  ]);
  await User.deleteOne({ _id: demoUser._id });
  return { cleared: true };
}
