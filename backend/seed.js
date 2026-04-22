import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Seed data pools
const COMPANIES = [
  "Google",
  "Meta",
  "Amazon",
  "Apple",
  "Microsoft",
  "Netflix",
  "Stripe",
  "Airbnb",
  "Uber",
  "Lyft",
  "Spotify",
  "Slack",
  "Dropbox",
  "Twilio",
  "Snowflake",
  "Databricks",
  "Palantir",
  "Coinbase",
  "Robinhood",
  "Square",
  "Shopify",
  "Atlassian",
  "Salesforce",
  "Adobe",
  "Oracle",
  "IBM",
  "Goldman Sachs",
  "JPMorgan",
  "Morgan Stanley",
  "Bloomberg",
  "Citadel",
  "Two Sigma",
  "Jane Street",
  "HRT",
  "DRW",
  "Nvidia",
  "Intel",
  "AMD",
  "Tesla",
  "SpaceX",
  "Figma",
  "Notion",
  "Linear",
  "Vercel",
  "Supabase",
  "Datadog",
  "Cloudflare",
  "Elastic",
  "MongoDB Inc",
  "Confluent",
];

const ROLES = [
  "Software Engineer Intern",
  "SWE Intern",
  "Backend Engineer Intern",
  "Frontend Engineer Intern",
  "Full Stack Intern",
  "Data Engineer Intern",
  "ML Engineer Intern",
  "Platform Engineer Intern",
  "DevOps Intern",
  "Infrastructure Intern",
  "SRE Intern",
  "Mobile Engineer Intern",
  "iOS Engineer Intern",
  "Android Engineer Intern",
  "Software Development Engineer Intern",
  "Cloud Engineer Intern",
];

const STAGES = ["Applied", "OA", "Interview", "Offer", "Rejected"];

const RESUME_NAMES = [
  "SWE Resume v1",
  "SWE Resume v2",
  "SWE Resume v3",
  "Data Engineering Resume",
  "ML Resume",
  "Full Stack Resume",
  "Backend Focus Resume",
  "Frontend Focus Resume",
];

const RESUME_ROLES = [
  "Software Engineering",
  "Data Engineering",
  "Machine Learning",
  "Full Stack",
  "Backend",
  "Frontend",
  "Platform",
  "DevOps",
];

const RESUME_TAGS = [
  ["swe", "generalist"],
  ["swe", "senior"],
  ["swe", "startup"],
  ["data", "pipelines"],
  ["ml", "research"],
  ["full-stack", "startup"],
  ["backend", "infra"],
  ["frontend", "react"],
];

const CONTACT_NAMES = [
  "Sarah Chen",
  "James Wilson",
  "Priya Patel",
  "Michael Brown",
  "Emily Rodriguez",
  "David Kim",
  "Amanda Foster",
  "Ryan Thompson",
  "Jessica Martinez",
  "Kevin O'Brien",
  "Rachel Lee",
  "Andrew Davis",
  "Samantha Wright",
  "Daniel Park",
  "Olivia Johnson",
  "Chris Anderson",
  "Megan Taylor",
  "Brandon Nguyen",
  "Lauren Scott",
  "Tyler Washington",
  "Hannah Garcia",
  "Nathan Miller",
  "Sophia Clark",
  "Justin Harris",
  "Ashley Robinson",
  "Mark Lewis",
  "Kayla Walker",
  "Sean Murphy",
  "Elizabeth Moore",
  "Patrick Sullivan",
];

const CONTACT_ROLES_LIST = [
  "Recruiter",
  "Senior Recruiter",
  "University Recruiter",
  "Hiring Manager",
  "Engineering Manager",
  "Tech Lead",
  "Staff Engineer",
  "HR Coordinator",
  "Talent Acquisition",
  "Campus Recruiter",
];

const CONNECTION_SOURCES = [
  "Cold email",
  "Referral",
  "Career fair",
  "LinkedIn",
  "Professor intro",
  "Alumni network",
  "Other",
];

const DEADLINE_TYPES = [
  "OA due date",
  "Follow-up reminder",
  "Interview prep",
  "Offer decision",
  "Thank you note",
  "Other",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function weightedStage() {
  const r = Math.random();
  if (r < 0.4) return "Applied";
  if (r < 0.55) return "Rejected";
  if (r < 0.72) return "OA";
  if (r < 0.88) return "Interview";
  return "Offer";
}

async function seed() {
  try {
    await client.connect();
    const db = client.db("HireTrail");

    console.log("Clearing existing data...");
    await db.collection("users").deleteMany({});
    await db.collection("applications").deleteMany({});
    await db.collection("resumes").deleteMany({});
    await db.collection("contacts").deleteMany({});
    await db.collection("deadlines").deleteMany({});

    // Create demo user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const demoUser = {
      name: "Demo User",
      email: "demo@hiretrail.com",
      password: hashedPassword,
      googleId: null,
      createdAt: new Date(),
    };
    const userResult = await db.collection("users").insertOne(demoUser);
    const userId = userResult.insertedId.toString();
    console.log(`Created demo user: demo@hiretrail.com / password123`);

    // Create resumes (8)
    const resumeDocs = [];
    for (let i = 0; i < RESUME_NAMES.length; i++) {
      const now = randomDate(new Date("2025-01-01"), new Date("2025-06-01"));
      resumeDocs.push({
        userId,
        name: RESUME_NAMES[i],
        targetRole: RESUME_ROLES[i] || "General",
        tags: RESUME_TAGS[i] || [],
        fileName: "",
        fileType: "",
        fileSize: 0,
        cloudinaryUrl: "",
        cloudinaryPublicId: "",
        uploadDate: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    const resumeResult = await db.collection("resumes").insertMany(resumeDocs);
    const resumeIds = Object.values(resumeResult.insertedIds).map((id) =>
      id.toString(),
    );
    console.log(`Created ${resumeIds.length} resumes`);

    const startDate = new Date("2025-01-15");
    const endDate = new Date("2025-10-15");

    // Create contacts (200+) BEFORE applications so we can link them
    const contactDocs = [];
    for (let i = 0; i < 220; i++) {
      const contactDate = randomDate(startDate, endDate);
      contactDocs.push({
        userId,
        name: randomItem(CONTACT_NAMES),
        company: randomItem(COMPANIES),
        role: randomItem(CONTACT_ROLES_LIST),
        type: "person",
        linkedinUrl: `https://linkedin.com/in/person-${1000 + i}`,
        connectionSource: randomItem(CONNECTION_SOURCES),
        lastContactDate: contactDate,
        notes:
          Math.random() > 0.5
            ? "Great conversation, will follow up next week"
            : "",
        createdAt: contactDate,
        updatedAt: contactDate,
      });
    }
    const contactsResult = await db
      .collection("contacts")
      .insertMany(contactDocs);
    const contactIdsAll = Object.values(contactsResult.insertedIds).map((id) =>
      id.toString(),
    );
    // Index contacts by company for linking
    const contactsByCompany = {};
    contactDocs.forEach((c, idx) => {
      if (!contactsByCompany[c.company]) contactsByCompany[c.company] = [];
      contactsByCompany[c.company].push(contactIdsAll[idx]);
    });
    console.log(`Created ${contactDocs.length} contacts`);

    // Create applications (600+)
    const appDocs = [];

    for (let i = 0; i < 650; i++) {
      const stage = weightedStage();
      const appDate = randomDate(startDate, endDate);
      const stageHistory = [{ stage: "Applied", date: appDate }];

      if (stage === "OA" || stage === "Interview" || stage === "Offer") {
        stageHistory.push({
          stage: "OA",
          date: new Date(appDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        });
      }
      if (stage === "Interview" || stage === "Offer") {
        stageHistory.push({
          stage: "Interview",
          date: new Date(appDate.getTime() + 21 * 24 * 60 * 60 * 1000),
        });
      }
      if (stage === "Offer") {
        stageHistory.push({
          stage: "Offer",
          date: new Date(appDate.getTime() + 35 * 24 * 60 * 60 * 1000),
        });
      }
      if (stage === "Rejected") {
        const rejectAfter = Math.floor(Math.random() * 30) + 3;
        stageHistory.push({
          stage: "Rejected",
          date: new Date(appDate.getTime() + rejectAfter * 24 * 60 * 60 * 1000),
        });
      }

      const company = randomItem(COMPANIES);
      // Link 0-2 contacts — prefer contacts from the same company, with a
      // fallback to random contacts so linkage isn't too sparse.
      const linkedContacts = [];
      if (Math.random() > 0.35) {
        const sameCompany = contactsByCompany[company] || [];
        if (sameCompany.length > 0) {
          linkedContacts.push(randomItem(sameCompany));
        } else {
          linkedContacts.push(randomItem(contactIdsAll));
        }
        if (Math.random() > 0.7) {
          linkedContacts.push(randomItem(contactIdsAll));
        }
      }

      appDocs.push({
        userId,
        company,
        role: randomItem(ROLES),
        jobUrl: `https://careers.example.com/job/${100000 + i}`,
        applicationDate: appDate,
        stage,
        stageHistory,
        notes: Math.random() > 0.6 ? "Referred by alumni" : "",
        resumeId: randomItem(resumeIds),
        contactIds: [...new Set(linkedContacts)],
        createdAt: appDate,
        updatedAt: new Date(
          appDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000,
        ),
      });
    }
    await db.collection("applications").insertMany(appDocs);
    console.log(`Created ${appDocs.length} applications`);

    // Create deadlines (150+)
    const deadlineDocs = [];
    const realAppIds = (
      await db
        .collection("applications")
        .find({ userId })
        .project({ _id: 1 })
        .toArray()
    ).map((a) => a._id.toString());

    for (let i = 0; i < 180; i++) {
      const dueDate = randomDate(
        new Date("2025-03-01"),
        new Date("2025-12-31"),
      );
      const completed = Math.random() > 0.6;
      deadlineDocs.push({
        userId,
        applicationId: Math.random() > 0.3 ? randomItem(realAppIds) : null,
        type: randomItem(DEADLINE_TYPES),
        dueDate,
        completed,
        notes: Math.random() > 0.5 ? "Check email for details" : "",
        createdAt: new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: dueDate,
      });
    }
    await db.collection("deadlines").insertMany(deadlineDocs);
    console.log(`Created ${deadlineDocs.length} deadlines`);

    const totalRecords =
      1 +
      resumeDocs.length +
      appDocs.length +
      contactDocs.length +
      deadlineDocs.length;
    console.log(`\nTotal records seeded: ${totalRecords}`);
    console.log("Seeding complete!");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await client.close();
  }
}

seed();
