/**
 * Local dev seed — a non-demo user + master profile + primary resume + a sample
 * application with a JD, so the AI features (Studio, fit analysis, the tailoring
 * drawer) are usable against a LOCAL database. Idempotent.
 *
 *   npm run db:seed            (from backend/, uses MONGO_URI from .env.local)
 *
 * Refuses to run against anything that isn't localhost — never touches Atlas.
 */
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";
import { MasterProfile } from "../src/models/MasterProfile.js";
import { Resume } from "../src/models/Resume.js";
import { Application } from "../src/models/Application.js";

const EMAIL = "dev@hiretrail.local";
const PASSWORD = "devpass123";

async function main() {
  if (!/127\.0\.0\.1|localhost/.test(env.MONGO_URI)) {
    throw new Error(`Refusing to seed: MONGO_URI is not local (${env.MONGO_URI}). Set backend/.env.local first.`);
  }
  await mongoose.connect(env.MONGO_URI);
  console.log("connected:", env.MONGO_URI);

  const prior = await User.findOne({ email: EMAIL }).setOptions({ includeDeleted: true });
  if (prior) {
    await MasterProfile.deleteOne({ userId: prior._id });
    await Resume.deleteMany({ userId: prior._id });
    await Application.deleteMany({ userId: prior._id });
    await User.deleteOne({ _id: prior._id });
  }

  const user = new User({ name: "Dev Tester", email: EMAIL, password: PASSWORD, role: "user" });
  await user.save();

  const resume = await Resume.create({
    userId: user._id, name: "Dev Tester — Base", targetRole: "Senior Backend Engineer", tags: [], fileName: "",
  });
  user.primaryResumeId = resume._id;
  await user.save();

  await MasterProfile.create({
    userId: user._id,
    contact: { fullName: "Dev Tester", email: EMAIL, phone: "(555) 010-2030", location: "Boston, MA", linkedin: "linkedin.com/in/devtester", github: "github.com/devtester", portfolio: "" },
    summary: "Backend-leaning full-stack engineer with 5 years building reliable, well-tested services. Owns features end to end, from API design to dashboards and on-call.",
    experiences: [
      { company: "Northstar Labs", role: "Software Engineer", location: "Boston, MA", startDate: "2022-08", endDate: "", current: true, bullets: [
        { text: "Built a notifications service handling 2M events/day, cutting delivery latency from 9s to under 1s.", tags: ["backend"] },
        { text: "Led migration of a monolith module to a typed REST service, reducing 5xx error rate by 40%.", tags: ["reliability"] },
      ] },
      { company: "Brightwave", role: "Junior Developer", location: "Remote", startDate: "2020-06", endDate: "2022-07", current: false, bullets: [
        { text: "Added end-to-end tests that raised checkout-flow coverage from 31% to 82%.", tags: ["testing"] },
      ] },
    ],
    projects: [{ name: "OpenSchedule", url: "github.com/devtester/openschedule", description: "Open-source scheduling tool with 600+ GitHub stars.", technologies: ["React", "Node", "Postgres"], bullets: [{ text: "Designed the conflict-resolution algorithm.", tags: [] }] }],
    education: [{ school: "University of Massachusetts", degree: "B.S.", field: "Computer Science", location: "Amherst, MA", startDate: "2016", endDate: "2020", gpa: "3.7", highlights: [] }],
    skills: [
      { category: "Languages", items: ["TypeScript", "Python", "Go", "SQL"] },
      { category: "Infra", items: ["Docker", "AWS", "Postgres", "Redis"] },
    ],
    certifications: [],
  });

  await Application.create({
    userId: user._id,
    company: "Acme Corp",
    role: "Senior Backend Engineer",
    stage: "Applied",
    jobDescription: "Senior Backend Engineer. Build event-driven backend services at scale. Requirements: TypeScript, GraphQL, Kubernetes, observability, Terraform, Postgres, strong testing and CI/CD, mentoring. 100+ applicants. Easy Apply.",
    applicationDate: new Date(),
  });

  console.log("\n=== local dev seed ready ===");
  console.log("login:", EMAIL, "/", PASSWORD);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
