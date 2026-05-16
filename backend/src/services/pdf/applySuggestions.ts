/**
 * Apply the set of accepted tailor suggestions onto a deep-copy of the master profile.
 *
 * Match heuristic for "which existing entry does this target?":
 *   experience → fuzzy company name contains (case-insensitive)
 *   project    → fuzzy project name contains
 *   bullet     → starts-with prefix match (first 30 chars) on the target bullet text
 *
 * Returns the modified profile object; never mutates the input.
 */
import type { IMasterProfile, IExperience, IProject } from "../../models/MasterProfile.js";
import type { ITailorSuggestion } from "../../models/TailorSession.js";

type WritableProfile = {
  -readonly [K in keyof IMasterProfile]: IMasterProfile[K];
};

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function looseMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
}

function findExperience(p: IMasterProfile, name: string): IExperience | undefined {
  if (!name) return undefined;
  return p.experiences.find((e) => looseMatch(e.company, name));
}

function findProject(p: IMasterProfile, name: string): IProject | undefined {
  if (!name) return undefined;
  return p.projects.find((pr) => looseMatch(pr.name, name));
}

function bulletPrefixMatch(bullet: string, target: string): boolean {
  if (!bullet || !target) return false;
  const a = bullet.toLowerCase().slice(0, 40);
  const b = target.toLowerCase().slice(0, 40);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export function applyAcceptedSuggestions(
  profile: IMasterProfile,
  suggestions: ITailorSuggestion[]
): WritableProfile {
  const out = deepClone(profile) as WritableProfile;
  const accepted = suggestions.filter((s) => s.decision === "accepted");

  for (const s of accepted) {
    try {
      switch (s.section) {
        case "summary":
          if (s.kind === "rewrite" || s.kind === "add") {
            out.summary = s.suggested;
          }
          break;

        case "experience": {
          const exp = findExperience(out, s.targetCompanyOrName);
          if (!exp) {
            // Unmatched — no-op rather than fabricating.
            break;
          }
          if (s.kind === "rewrite" || s.kind === "emphasize") {
            const target = exp.bullets.find((b) => bulletPrefixMatch(b.text, s.targetBullet));
            if (target) {
              target.text = s.suggested;
              target.tags = Array.from(new Set([...(target.tags || []), ...s.tags]));
              if (s.kind === "emphasize") {
                const idx = exp.bullets.indexOf(target);
                if (idx > 0) {
                  exp.bullets.splice(idx, 1);
                  exp.bullets.unshift(target);
                }
              }
            } else if (s.kind === "rewrite") {
              // No matching bullet — fall back to add.
              exp.bullets.unshift({ text: s.suggested, tags: s.tags });
            }
          } else if (s.kind === "add") {
            exp.bullets.unshift({ text: s.suggested, tags: s.tags });
          } else if (s.kind === "reorder") {
            const idx = exp.bullets.findIndex((b) => bulletPrefixMatch(b.text, s.targetBullet));
            if (idx > 0) {
              const [item] = exp.bullets.splice(idx, 1);
              exp.bullets.unshift(item);
            }
          }
          break;
        }

        case "project": {
          const proj = findProject(out, s.targetCompanyOrName);
          if (!proj) break;
          if (s.kind === "rewrite" || s.kind === "emphasize") {
            const target = proj.bullets.find((b) => bulletPrefixMatch(b.text, s.targetBullet));
            if (target) {
              target.text = s.suggested;
              target.tags = Array.from(new Set([...(target.tags || []), ...s.tags]));
            } else if (s.kind === "rewrite") {
              proj.bullets.unshift({ text: s.suggested, tags: s.tags });
            }
          } else if (s.kind === "add") {
            proj.bullets.unshift({ text: s.suggested, tags: s.tags });
          } else if (s.kind === "reorder") {
            const idx = proj.bullets.findIndex((b) => bulletPrefixMatch(b.text, s.targetBullet));
            if (idx > 0) {
              const [item] = proj.bullets.splice(idx, 1);
              proj.bullets.unshift(item);
            }
          }
          break;
        }

        case "skills": {
          // The model returns suggested as a comma-separated list of skills to add.
          const items = s.suggested.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
          if (items.length === 0) break;
          // Prefer adding to a group whose category matches one of the tags, otherwise General/first.
          const tagLower = s.tags.map((t) => t.toLowerCase());
          const targetGroup =
            out.skills.find((g) => tagLower.includes(g.category.toLowerCase())) ||
            out.skills.find((g) => g.category.toLowerCase() === "general") ||
            out.skills[0];
          if (targetGroup) {
            const existing = new Set(targetGroup.items.map((x) => x.toLowerCase()));
            for (const item of items) if (!existing.has(item.toLowerCase())) targetGroup.items.push(item);
          } else {
            out.skills.push({ category: "General", items });
          }
          break;
        }
      }
    } catch {
      // Don't let a single bad suggestion blow up the whole render.
    }
  }

  return out;
}
