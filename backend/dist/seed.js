/**
 * Development/demo dataset: demo user plus synthetic applications, resumes, contacts, deadlines.
 * Run: `npm run seed` from `backend/`.
 */
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { User } from "./models/User.js";
import { Application } from "./models/Application.js";
import { Resume } from "./models/Resume.js";
import { Contact } from "./models/Contact.js";
import { Deadline } from "./models/Deadline.js";
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
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function weightedStage() {
    const r = Math.random();
    if (r < 0.4)
        return "Applied";
    if (r < 0.55)
        return "Rejected";
    if (r < 0.72)
        return "OA";
    if (r < 0.88)
        return "Interview";
    return "Offer";
}
async function seed() {
    try {
        await mongoose.connect(env.MONGO_URI);
        console.log("Connected to MongoDB");
        console.log("Clearing existing data...");
        await Promise.all([
            User.deleteMany({}),
            Application.deleteMany({}),
            Resume.deleteMany({}),
            Contact.deleteMany({}),
            Deadline.deleteMany({}),
        ]);
        // Create demo user (password hashing handled by pre-save hook)
        const demoUser = await User.create({
            name: "Demo User",
            email: "demo@hiretrail.com",
            password: "password123",
        });
        const userId = demoUser._id;
        console.log("Created demo user: demo@hiretrail.com / password123");
        // Create resumes
        const resumeDocs = RESUME_NAMES.map((name, i) => ({
            userId,
            name,
            targetRole: RESUME_ROLES[i] || "General",
            fileName: `${name.toLowerCase().replace(/ /g, "_")}.pdf`,
            uploadDate: randomDate(new Date("2025-01-01"), new Date("2025-06-01")),
        }));
        const resumes = await Resume.insertMany(resumeDocs);
        const resumeIds = resumes.map((r) => r._id);
        console.log(`Created ${resumes.length} resumes`);
        // Create applications
        const startDate = new Date("2025-01-15");
        const endDate = new Date("2025-10-15");
        const appDocs = [];
        for (let i = 0; i < 650; i++) {
            const stage = weightedStage();
            const appDate = randomDate(startDate, endDate);
            const stageHistory = [
                { stage: "Applied", date: appDate },
            ];
            if (["OA", "Interview", "Offer"].includes(stage)) {
                stageHistory.push({
                    stage: "OA",
                    date: new Date(appDate.getTime() + 7 * 86400000),
                });
            }
            if (["Interview", "Offer"].includes(stage)) {
                stageHistory.push({
                    stage: "Interview",
                    date: new Date(appDate.getTime() + 21 * 86400000),
                });
            }
            if (stage === "Offer") {
                stageHistory.push({
                    stage: "Offer",
                    date: new Date(appDate.getTime() + 35 * 86400000),
                });
            }
            if (stage === "Rejected") {
                const days = Math.floor(Math.random() * 30) + 3;
                stageHistory.push({
                    stage: "Rejected",
                    date: new Date(appDate.getTime() + days * 86400000),
                });
            }
            appDocs.push({
                userId,
                company: randomItem(COMPANIES),
                role: randomItem(ROLES),
                jobUrl: `https://careers.example.com/job/${100000 + i}`,
                applicationDate: appDate,
                stage,
                stageHistory,
                notes: Math.random() > 0.6 ? "Referred by alumni" : "",
                resumeId: randomItem(resumeIds),
            });
        }
        await Application.insertMany(appDocs);
        console.log(`Created ${appDocs.length} applications`);
        // Create contacts
        const contactDocs = [];
        for (let i = 0; i < 220; i++) {
            contactDocs.push({
                userId,
                name: randomItem(CONTACT_NAMES),
                company: randomItem(COMPANIES),
                role: randomItem(CONTACT_ROLES_LIST),
                linkedinUrl: `https://linkedin.com/in/person-${1000 + i}`,
                connectionSource: randomItem(CONNECTION_SOURCES),
                lastContactDate: randomDate(startDate, endDate),
                notes: Math.random() > 0.5
                    ? "Great conversation, will follow up next week"
                    : "",
            });
        }
        await Contact.insertMany(contactDocs);
        console.log(`Created ${contactDocs.length} contacts`);
        // Create deadlines
        const appIds = (await Application.find({ userId }).select("_id").lean()).map((a) => a._id);
        const deadlineDocs = [];
        for (let i = 0; i < 180; i++) {
            const dueDate = randomDate(new Date("2025-03-01"), new Date("2025-12-31"));
            deadlineDocs.push({
                userId,
                applicationId: Math.random() > 0.3 ? randomItem(appIds) : null,
                type: randomItem(DEADLINE_TYPES),
                dueDate,
                completed: Math.random() > 0.6,
                notes: Math.random() > 0.5 ? "Check email for details" : "",
            });
        }
        await Deadline.insertMany(deadlineDocs);
        console.log(`Created ${deadlineDocs.length} deadlines`);
        const total = 1 + resumes.length + appDocs.length + contactDocs.length + deadlineDocs.length;
        console.log(`\nTotal records seeded: ${total}`);
        console.log("Seeding complete!");
    }
    catch (err) {
        console.error("Seed error:", err);
    }
    finally {
        await mongoose.disconnect();
    }
}
seed();
//# sourceMappingURL=seed.js.map