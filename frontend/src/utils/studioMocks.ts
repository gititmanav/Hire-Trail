/**
 * Mock data for the AI + Resume Studio surfaces.
 *
 * The backend for the new endpoints (ai status/usage, resume document CRUD,
 * ai-rewrite, render-pdf, revert, tailor→document) is being built in PARALLEL.
 * Until it lands, `studioApi` delegates here so the UI is fully demonstrable.
 * Flip STUDIO_USE_MOCKS off (or let the real endpoints start answering) to use
 * the live API — nothing else changes. See frontend/INTEGRATION.md.
 */
import {
  DEFAULT_STYLE, newId, cloneDoc, normalizeOrders, bulletPath, sectionTitlePath,
  type ResumeDocument, type AIRewriteRequest, type AIRewriteResult, type AIChange,
  type GapAnalysis, type RewriteScope,
} from "./resumeDocument.ts";

/* ---------- AI status + usage (Task A) ---------- */

export interface AIStatus {
  /** "byok" → user-supplied key active; "default" → falling back to the shared
   *  platform provider; "none" → no provider available, AI features blocked. */
  mode: "byok" | "default" | "none";
  provider: string | null;
  model: string | null;
  ok: boolean;
  message: string;
}

export interface AIUsage {
  mode: "byok" | "default";
  /** BYOK accounting. */
  tokens?: { input: number; output: number; total: number };
  estimatedCostUsd?: number;
  /** Default (shared) quota accounting. */
  used?: number;
  limit?: number;
  /** ISO date the default quota resets. */
  resetsAt?: string | null;
  /** Window label, e.g. "this month". */
  period?: string;
}

export interface ProviderInfo {
  provider: "anthropic" | "openai" | "google" | "openrouter";
  byok: boolean;
  freeTier: boolean;
  freeTierNote: string;
  getKeyUrl: string;
}

export function mockStatus(hasActiveKey: boolean): AIStatus {
  if (hasActiveKey) {
    return { mode: "byok", provider: "google", model: "gemini-2.0-flash", ok: true, message: "Using your Gemini key." };
  }
  return { mode: "default", provider: "hiretrail", model: "shared-fast", ok: true, message: "Using the shared HireTrail provider (limited)." };
}

export function mockUsage(hasActiveKey: boolean): AIUsage {
  if (hasActiveKey) {
    const input = 184_320;
    const output = 39_870;
    return {
      mode: "byok",
      tokens: { input, output, total: input + output },
      estimatedCostUsd: 0.42,
      period: "this month",
    };
  }
  const resets = new Date();
  resets.setMonth(resets.getMonth() + 1, 1);
  resets.setHours(0, 0, 0, 0);
  return { mode: "default", used: 37, limit: 100, resetsAt: resets.toISOString(), period: "this month" };
}

/* ---------- ResumeDocument (Task C) ---------- */

export function mockDocument(): ResumeDocument {
  const expA = "exp_a", expB = "exp_b", edu = "edu_a", proj = "proj_a";
  return normalizeOrders({
    meta: {
      name: "Jordan Rivera",
      contact: {
        email: "jordan.rivera@email.com",
        phone: "(555) 214-7788",
        location: "Boston, MA",
        links: [
          { label: "LinkedIn", url: "linkedin.com/in/jordanrivera" },
          { label: "GitHub", url: "github.com/jrivera" },
        ],
      },
    },
    sections: [
      {
        id: "sec_summary", type: "summary", title: "Summary", order: 0,
        entries: [{
          id: "sum_e", org: "", title: "", location: "", startDate: "", endDate: "", current: false, order: 0,
          bullets: [{ id: "sum_b1", order: 0, text: "Backend-leaning full-stack engineer with 4 years building reliable, well-tested services. Comfortable owning a feature end to end, from API design to dashboards." }],
        }],
      },
      {
        id: "sec_exp", type: "experience", title: "Experience", order: 1,
        entries: [
          {
            id: expA, org: "Northstar Labs", title: "Software Engineer", location: "Boston, MA",
            startDate: "2022-08", endDate: "", current: true, order: 0, bullets: [
              { id: "b1", order: 0, text: "Built and shipped a notifications service handling 2M events/day, cutting delivery latency from 9s to under 1s." },
              { id: "b2", order: 1, text: "Led migration of a monolith module to a typed REST service, reducing 5xx error rate by 40%." },
              { id: "b3", order: 2, text: "Mentored two junior engineers through their first on-call rotations." },
            ],
          },
          {
            id: expB, org: "Brightwave", title: "Junior Developer", location: "Remote",
            startDate: "2020-06", endDate: "2022-07", current: false, order: 1, bullets: [
              { id: "b4", order: 0, text: "Implemented a billing reconciliation job that recovered ~$120k/yr in missed charges." },
              { id: "b5", order: 1, text: "Added end-to-end tests that raised coverage on the checkout flow from 31% to 82%." },
            ],
          },
        ],
      },
      {
        id: "sec_proj", type: "projects", title: "Projects", order: 2,
        entries: [{
          id: proj, org: "", title: "OpenSchedule", location: "", startDate: "2023", endDate: "", current: false, order: 0,
          extra: "React, Node, Postgres",
          bullets: [
            { id: "p1", order: 0, text: "Open-source scheduling tool with 600+ GitHub stars; designed the conflict-resolution algorithm." },
          ],
        }],
      },
      {
        id: "sec_edu", type: "education", title: "Education", order: 3,
        entries: [{
          id: edu, org: "University of Massachusetts", title: "B.S. Computer Science", location: "Amherst, MA",
          startDate: "2016", endDate: "2020", current: false, order: 0, extra: "GPA 3.7",
          bullets: [],
        }],
      },
      {
        id: "sec_skills", type: "skills", title: "Skills", order: 4,
        entries: [{
          id: "skills_e", org: "", title: "", location: "", startDate: "", endDate: "", current: false, order: 0,
          bullets: [
            { id: "sk1", order: 0, text: "Languages: TypeScript, Python, Go, SQL" },
            { id: "sk2", order: 1, text: "Infra: Docker, AWS, Postgres, Redis" },
            { id: "sk3", order: 2, text: "Practices: TDD, CI/CD, code review" },
          ],
        }],
      },
    ],
    style: { ...DEFAULT_STYLE },
    score: 6.4,
    suggestions: [
      { id: "sg1", label: "Add metrics to bullets", instruction: "Strengthen each bullet with a concrete metric or measurable outcome where one is implied.", scope: "all" },
      { id: "sg2", label: "Mirror the JD's keywords", instruction: "Weave in the missing keywords from the job description naturally, without keyword-stuffing.", scope: "all" },
      { id: "sg3", label: "Tighten the summary", instruction: "Rewrite the summary to be two crisp sentences targeted at this role.", scope: { sectionId: "sec_summary" } },
      { id: "sg4", label: "Punch up Experience verbs", instruction: "Lead each Experience bullet with a strong, varied action verb.", scope: { sectionId: "sec_exp" } },
    ],
    version: 1,
  });
}

export function mockGap(): GapAnalysis {
  return {
    coverage: 64,
    matched: ["TypeScript", "REST APIs", "Postgres", "CI/CD", "testing", "AWS", "mentoring"],
    missing: ["Kubernetes", "GraphQL", "event-driven", "observability", "Terraform"],
    sectionFlags: [
      { sectionId: "sec_summary", title: "Summary", severity: "warn", note: "Generic — doesn't name the role or its core stack." },
      { sectionId: "sec_exp", title: "Experience", severity: "good", note: "Strong, metric-driven bullets that map to the JD." },
      { sectionId: "sec_proj", title: "Projects", severity: "warn", note: "Relevant, but missing the JD's event-driven / observability themes." },
      { sectionId: "sec_skills", title: "Skills", severity: "gap", note: "Missing Kubernetes, GraphQL, and Terraform from the requirements." },
    ],
  };
}

/* ---------- ai-rewrite (the key flow) ---------- */

/** Resolve which bullets a scope touches. Returns [sectionId, entryId, bullet] tuples. */
function bulletsInScope(doc: ResumeDocument, scope: RewriteScope) {
  const out: { sid: string; eid: string; bid: string; text: string }[] = [];
  for (const s of doc.sections) {
    if (scope !== "all" && scope.sectionId && scope.sectionId !== s.id) continue;
    for (const e of s.entries) {
      if (scope !== "all" && scope.entryId && scope.entryId !== e.id) continue;
      for (const b of e.bullets) out.push({ sid: s.id, eid: e.id, bid: b.id, text: b.text });
    }
  }
  return out;
}

const STRONG_VERBS = ["Spearheaded", "Architected", "Drove", "Delivered", "Scaled", "Engineered", "Owned"];

/** Synthesize a believable rewrite: rewrites up to 3 in-scope bullets, returns
 *  the changelog + changed paths + a bumped score. Mirrors the real ai-rewrite
 *  response shape so the UI code is identical at integration. */
export function mockRewrite(doc: ResumeDocument, req: AIRewriteRequest): AIRewriteResult {
  const next = cloneDoc(doc);
  const before = typeof doc.score === "number" ? doc.score : 6;
  const targets = bulletsInScope(next, req.scope).slice(0, 3);
  const changes: AIChange[] = [];
  const changedPaths: string[] = [];

  if (targets.length === 0) {
    // Scope had no bullets (e.g. an empty section) — touch the section title as a no-op-ish change.
    const s = next.sections.find((x) => req.scope !== "all" && req.scope.sectionId === x.id) || next.sections[0];
    const beforeTitle = s.title;
    s.title = beforeTitle; // unchanged, but report it so the changelog isn't empty
    changes.push({ path: sectionTitlePath(s.id), summary: `Reviewed “${s.title}” — no edits needed.`, before: beforeTitle, after: s.title });
  }

  targets.forEach((t, i) => {
    const verb = STRONG_VERBS[i % STRONG_VERBS.length];
    for (const s of next.sections) {
      const e = s.entries.find((x) => x.id === t.eid);
      if (!e) continue;
      const b = e.bullets.find((x) => x.id === t.bid);
      if (!b) continue;
      const beforeText = b.text;
      // Prepend a strong verb if the bullet doesn't already start with one, and
      // tack on a JD keyword when the instruction asks for keyword coverage.
      let after = beforeText.replace(/^(Built|Led|Implemented|Added|Mentored|Designed|Open-source)/, verb);
      if (after === beforeText) after = `${verb} ${beforeText.charAt(0).toLowerCase()}${beforeText.slice(1)}`;
      if ((req.preset || req.instruction || "").toLowerCase().includes("keyword") || (req.instruction || "").toLowerCase().includes("jd")) {
        after = after.replace(/\.$/, "") + ", instrumented with observability dashboards.";
      }
      b.text = after;
      const path = bulletPath(s.id, e.id, b.id);
      changedPaths.push(path);
      changes.push({ path, summary: `Strengthened opening verb${after.includes("observability") ? " + added a JD keyword" : ""}.`, before: beforeText, after });
      break;
    }
  });

  const after = Math.min(10, Math.round((before + 0.9 + targets.length * 0.3) * 10) / 10);
  next.score = after;
  next.version = (doc.version ?? 1) + 1;
  return { document: next, changes, changedPaths, score: { before, after } };
}
