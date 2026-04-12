/**
 * Reusable seed logic — called by both CLI `npm run seed` and admin API route.
 * Creates demo user with applications, resumes, contacts, deadlines, and companies.
 */
import { User } from "../models/User.js";
import { Application } from "../models/Application.js";
import { Resume } from "../models/Resume.js";
import { Contact } from "../models/Contact.js";
import { Deadline } from "../models/Deadline.js";
import { Company } from "../models/Company.js";
const COMPANIES = [
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
/** Create demo user + synthetic data. Does NOT clear existing data first. */
export async function runSeed() {
    // Create demo user
    const existing = await User.findOne({ email: "demo@hiretrail.com" }).setOptions({ includeDeleted: true });
    let demoUser;
    if (existing) {
        demoUser = existing;
    }
    else {
        demoUser = await User.create({
            name: "Demo User",
            email: "demo@hiretrail.com",
            password: "password123",
        });
    }
    const userId = demoUser._id;
    // Companies — upsert all companies, add demo user to each
    const companyMap = new Map();
    for (const c of COMPANIES) {
        const company = await Company.findOneAndUpdate({ name: c.name }, {
            $setOnInsert: { name: c.name, website: c.website, domain: c.domain, createdBy: userId },
            $addToSet: { users: userId },
        }, { upsert: true, new: true, collation: { locale: "en", strength: 2 } });
        companyMap.set(c.name, company._id);
    }
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
        const companyData = randomItem(COMPANIES);
        const appDate = randomDate(startDate, endDate);
        const stageHistory = [{ stage: "Applied", date: appDate }];
        if (["OA", "Interview", "Offer"].includes(stage))
            stageHistory.push({ stage: "OA", date: new Date(appDate.getTime() + 7 * 86400000) });
        if (["Interview", "Offer"].includes(stage))
            stageHistory.push({ stage: "Interview", date: new Date(appDate.getTime() + 21 * 86400000) });
        if (stage === "Offer")
            stageHistory.push({ stage: "Offer", date: new Date(appDate.getTime() + 35 * 86400000) });
        if (stage === "Rejected")
            stageHistory.push({ stage: "Rejected", date: new Date(appDate.getTime() + (Math.floor(Math.random() * 30) + 3) * 86400000) });
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
    await Application.insertMany(appDocs);
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
        companies: COMPANIES.length,
        total: 1 + resumes.length + appDocs.length + contactDocs.length + deadlineDocs.length + COMPANIES.length,
    };
}
/** Clear all data for the demo user only (preserves real users). */
export async function clearSeedData() {
    const demoUser = await User.findOne({ email: "demo@hiretrail.com" }).setOptions({ includeDeleted: true });
    if (!demoUser)
        return { cleared: false };
    await Promise.all([
        Application.deleteMany({ userId: demoUser._id }),
        Resume.deleteMany({ userId: demoUser._id }),
        Contact.deleteMany({ userId: demoUser._id }),
        Deadline.deleteMany({ userId: demoUser._id }),
        // Remove demo user from company users arrays; delete companies only created by demo with no other users
        Company.updateMany({}, { $pull: { users: demoUser._id } }),
    ]);
    // Clean up companies with no users
    await Company.deleteMany({ users: { $size: 0 } });
    await User.deleteOne({ _id: demoUser._id });
    return { cleared: true };
}
//# sourceMappingURL=seedData.js.map