/**
 * TEMP verification helper (safe to delete) — seeds the AI content-hash cache
 * with a correctly-shaped JD analysis for one fixed test JD, so the Studio's
 * Step 1 "Analyze gap" completes through the REAL backend path (persistence,
 * TailorSession, deterministic coverage, suggestion chips) without a working
 * provider key. Refuses to run against anything that isn't localhost.
 *
 *   npx tsx scripts/seedAiCacheForTest.ts
 */
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";
import { MasterProfile } from "../src/models/MasterProfile.js";
import type { IMasterProfile } from "../src/models/MasterProfile.js";
import { Resume } from "../src/models/Resume.js";
import { hashInput, setCached } from "../src/services/ai/cache.js";
import { loadOrBuildDocument } from "../src/services/resume/store.js";
import { keywordCoverage, extractDocText } from "../src/services/resume/keywords.js";

const EMAIL = "dev@hiretrail.local";
const MODEL_ID = "google/gemini-2.5-flash"; // resolver: env google key + "smart"

export const TEST_JD = `Software Engineer II - Backend Platform
San Francisco, CA (Hybrid) - Reposted 2 weeks ago - Over 100 applicants
Easy Apply - Full-time - Mid-Senior level

About the job
We are looking for a backend engineer to join our payments platform team. You will design and build scalable microservices in Go and TypeScript, own PostgreSQL schema design, and operate services on AWS. Experience with Kafka event streaming, Redis caching, and CI/CD pipelines is a big plus. You'll partner with product and collaborate in an agile team.

Requirements:
- 3+ years building backend services in Go, TypeScript, or Java
- Strong SQL and data modeling (PostgreSQL preferred)
- Experience with AWS and infrastructure-as-code (Terraform)
- Automated testing and CI/CD

Benefits: 401k, equity, unlimited PTO. See how you compare to over 100 other applicants. Try Premium for free.`;

/** Mirror of tailor.ts buildProfileContext — keep in sync (one-off test helper). */
function buildProfileContext(profile: IMasterProfile): string {
  const parts: string[] = [];
  if (profile.summary) parts.push(`SUMMARY: ${profile.summary}`);
  if (profile.experiences.length) {
    parts.push("EXPERIENCE:");
    for (const exp of profile.experiences) {
      const dates = exp.current ? `${exp.startDate}–present` : `${exp.startDate}–${exp.endDate}`;
      parts.push(`- ${exp.role} @ ${exp.company} (${dates})`);
      for (const b of exp.bullets) parts.push(`  • ${b.text}${b.tags.length ? ` [${b.tags.join(", ")}]` : ""}`);
    }
  }
  if (profile.projects.length) {
    parts.push("PROJECTS:");
    for (const p of profile.projects) {
      parts.push(`- ${p.name}${p.url ? ` (${p.url})` : ""}${p.technologies.length ? ` — ${p.technologies.join(", ")}` : ""}`);
      if (p.description) parts.push(`  ${p.description}`);
      for (const b of p.bullets) parts.push(`  • ${b.text}`);
    }
  }
  if (profile.skills.length) {
    parts.push("SKILLS:");
    for (const g of profile.skills) parts.push(`- ${g.category}: ${g.items.join(", ")}`);
  }
  if (profile.education.length) {
    parts.push("EDUCATION:");
    for (const e of profile.education) {
      parts.push(`- ${[e.degree, e.field].filter(Boolean).join(" ")} @ ${e.school}${e.gpa ? ` (GPA ${e.gpa})` : ""}`);
    }
  }
  return parts.join("\n");
}

async function main() {
  if (!/127\.0\.0\.1|localhost/.test(env.MONGO_URI)) {
    throw new Error("Refusing: MONGO_URI is not localhost.");
  }
  await mongoose.connect(env.MONGO_URI);

  const user = await User.findOne({ email: EMAIL });
  if (!user) throw new Error("dev user not found — run npm run db:seed first");
  const profile = await MasterProfile.findOne({ userId: user._id });
  if (!profile) throw new Error("dev master profile not found");

  // The studio resume: same pick order the UI uses (any resume of the user).
  const resumes = await Resume.find({ userId: user._id }).sort({ createdAt: 1 });
  console.log("resumes:", resumes.map((r) => ({ id: r._id.toString(), title: r.title, targetRole: r.targetRole })));

  for (const resume of resumes) {
    const jd = TEST_JD.trim();
    const meta = [resume.targetRole ? `Title: ${resume.targetRole}` : ""].filter(Boolean).join("\n");
    const prompt = ["=== JOB ===", meta, "", jd.slice(0, 12_000), "", "=== CANDIDATE PROFILE ===", buildProfileContext(profile)].join("\n");

    // Pick jdKeywords so the deterministic coverage lands mid-range: ~8 present
    // in the doc text + ~6 genuinely missing.
    const docModel = await loadOrBuildDocument(user._id.toString(), resume);
    const docText = extractDocText(docModel.document);
    const candidates = ["typescript", "go", "postgresql", "aws", "kafka", "redis", "terraform", "ci/cd", "microservices", "sql", "react", "node.js", "docker", "agile", "data modeling", "automated testing"];
    const present = candidates.filter((k) => keywordCoverage([k], docText).coverageCount === 1);
    const missing = candidates.filter((k) => !present.includes(k));
    const jdKeywords = [...present.slice(0, 8), ...missing.slice(0, 6)];
    console.log(`resume ${resume._id}: present=${present.join(",")} | missing=${missing.slice(0, 6).join(",")}`);

    const analysis = {
      fitScore: 3,
      fitGrade: "C",
      summary: "Solid full-stack foundation with TypeScript and cloud exposure, but the posting's Go, Kafka, and Terraform depth is not yet evidenced. Emphasize backend services, data modeling, and any pipeline work.",
      jdKeywords,
      matchedSkills: present.slice(0, 8),
      missingSkills: missing.slice(0, 6),
      sectionFlags: [
        { section: "summary", severity: "warn", note: "Generic — aim it at backend platform work for this role." },
        { section: "experience", severity: "warn", note: "Bullets underplay backend services, databases, and scale." },
        { section: "projects", severity: "good", note: "Projects show initiative relevant to platform engineering." },
        { section: "skills", severity: "gap", note: "Missing Go, Kafka, Terraform — the role's core stack." },
        { section: "education", severity: "good", note: "Degree requirement satisfied." },
      ],
      suggestions: [
        { section: "experience", kind: "rewrite", targetCompanyOrName: "", targetBullet: "", suggested: "Lead with the backend service you built, the data store behind it, and the measurable outcome.", rationale: "Mirrors the JD's backend-services emphasis.", tags: ["backend", "postgresql"] },
        { section: "skills", kind: "emphasize", targetCompanyOrName: "", targetBullet: "", suggested: "TypeScript, PostgreSQL, AWS, CI/CD", rationale: "Bring the role's matched stack to the front.", tags: ["typescript", "aws"] },
        { section: "summary", kind: "rewrite", targetCompanyOrName: "", targetBullet: "", suggested: "Backend-leaning engineer shipping TypeScript services on AWS with strong SQL fundamentals.", rationale: "Aims the summary at this posting.", tags: ["backend"] },
      ],
    };

    const hash = hashInput("jd_analysis", MODEL_ID, prompt);
    await setCached(hash, "jd_analysis", MODEL_ID, analysis);
    console.log(`seeded cache ${hash.slice(0, 12)}… for resume ${resume._id}`);
  }

  await mongoose.disconnect();
  console.log("done");
}

main().catch((err) => { console.error(err); process.exit(1); });
