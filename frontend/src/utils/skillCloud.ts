/**
 * Pure tally of skill frequency across resume experiences. Each bullet on
 * each experience carries a `tags` array of skill keywords (populated by the
 * AI parser when the user uploads a resume). The Profile page's "Skill cloud"
 * visualises these tallies as variable-sized chips, and clicking one
 * surfaces which experiences contain that skill.
 *
 * Kept separate from the page so the logic is testable + reusable.
 */

export interface BulletLike { text: string; tags: string[] }
export interface ExperienceLike { company: string; role: string; bullets: BulletLike[] }

export interface SkillTally {
  /** Canonical skill label (first-seen casing wins so "React" stays "React"
   *  even if a later bullet writes "react"). */
  skill: string;
  /** How many bullets reference this skill across all experiences. */
  count: number;
  /** Which experiences (by index into the input array) contain at least one
   *  bullet mentioning this skill. Used to highlight matching roles when
   *  the cloud chip is clicked. */
  experienceIndexes: number[];
}

/** Normalise a tag so different casings/whitespaces collapse to one bucket. */
function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Tally skill frequency across experiences. Returns the list sorted by
 *  count desc, breaking ties alphabetically so the cloud is deterministic. */
export function tallySkills(experiences: ExperienceLike[]): SkillTally[] {
  const map = new Map<string, { display: string; count: number; expSet: Set<number> }>();
  experiences.forEach((exp, expIdx) => {
    for (const bullet of exp.bullets || []) {
      for (const rawTag of bullet.tags || []) {
        const key = normalize(rawTag);
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.expSet.add(expIdx);
        } else {
          map.set(key, { display: rawTag.trim(), count: 1, expSet: new Set([expIdx]) });
        }
      }
    }
  });
  return Array.from(map.values())
    .map((v) => ({ skill: v.display, count: v.count, experienceIndexes: Array.from(v.expSet).sort((a, b) => a - b) }))
    .sort((a, b) => (b.count - a.count) || a.skill.localeCompare(b.skill));
}

/** Map a tally count to a font-size in rem, scaling logarithmically so a
 *  skill that appears 20 times doesn't dwarf one that appears 3. min/max
 *  bound the range; below min the chip stays at the floor size. */
export function chipSize(count: number, maxCount: number): number {
  const MIN = 0.75;
  const MAX = 1.25;
  if (maxCount <= 1) return MIN;
  // log1p keeps single-mentions at the floor and tops out gracefully.
  const t = Math.log1p(count - 1) / Math.log1p(maxCount - 1);
  return MIN + (MAX - MIN) * Math.max(0, Math.min(1, t));
}

/** True when this experience uses the selected skill — used by the Profile
 *  page to ring-highlight matching roles when a cloud chip is selected. */
export function experienceUsesSkill(exp: ExperienceLike, skill: string | null): boolean {
  if (!skill) return false;
  const target = normalize(skill);
  return (exp.bullets || []).some((b) => (b.tags || []).some((t) => normalize(t) === target));
}

/** True when this individual bullet contains the skill. Used by the Profile
 *  Experience renderer to highlight just the matching bullet lines, not the
 *  entire role card. */
export function bulletUsesSkill(bullet: BulletLike, skill: string | null): boolean {
  if (!skill) return false;
  const target = normalize(skill);
  return (bullet.tags || []).some((t) => normalize(t) === target);
}
