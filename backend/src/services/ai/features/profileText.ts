/**
 * The master profile as plain text for a prompt (fit check, tailoring, MCP).
 * One rendering, so every feature sees the same candidate.
 */
import type { IMasterProfile } from "../../../models/MasterProfile.js";

type ProfileLike = Pick<IMasterProfile, "summary" | "experiences" | "projects" | "skills" | "education"> &
  Partial<Pick<IMasterProfile, "certifications">>;

export function profileText(profile: ProfileLike): string {
  const parts: string[] = [];
  if (profile.summary?.trim()) parts.push(`SUMMARY: ${profile.summary.trim()}`);
  if (profile.experiences?.length) {
    parts.push("EXPERIENCE:");
    for (const exp of profile.experiences) {
      const dates = exp.current ? `${exp.startDate || "?"}–present` : [exp.startDate, exp.endDate].filter(Boolean).join("–");
      parts.push(`- ${exp.role} @ ${exp.company}${dates ? ` (${dates})` : ""}`);
      for (const b of exp.bullets ?? []) parts.push(`  • ${b.text}`);
    }
  }
  if (profile.projects?.length) {
    parts.push("PROJECTS:");
    for (const p of profile.projects) {
      const tech = p.technologies?.length ? ` — ${p.technologies.join(", ")}` : "";
      parts.push(`- ${p.name}${tech}`);
      if (p.description?.trim()) parts.push(`  ${p.description.trim()}`);
      for (const b of p.bullets ?? []) parts.push(`  • ${b.text}`);
    }
  }
  if (profile.skills?.length) {
    parts.push("SKILLS:");
    for (const g of profile.skills) if (g.items?.length) parts.push(`- ${g.category}: ${g.items.join(", ")}`);
  }
  if (profile.education?.length) {
    parts.push("EDUCATION:");
    for (const e of profile.education) {
      parts.push(`- ${[e.degree, e.field].filter(Boolean).join(" ")} @ ${e.school}${e.gpa ? ` (GPA ${e.gpa})` : ""}`);
    }
  }
  if (profile.certifications?.length) {
    parts.push("CERTIFICATIONS:");
    for (const c of profile.certifications) parts.push(`- ${c.name}${c.issuer ? ` — ${c.issuer}` : ""}`);
  }
  return parts.join("\n");
}

/** Has the profile anything a feature could work from? */
export function profileHasContent(p: Partial<ProfileLike> | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    p.summary?.trim() ||
      p.experiences?.length ||
      p.projects?.length ||
      p.education?.length ||
      p.skills?.some((g) => g.items?.length),
  );
}
