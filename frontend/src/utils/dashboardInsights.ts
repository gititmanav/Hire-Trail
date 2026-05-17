import type { AnalyticsData, Application, Stage } from "../types";

export type StageFilter = Stage | "All";

export interface DashboardFilters {
  company: string;
  stage: StageFilter;
}

/** Funnel stages — Drafting is intentionally excluded; it's a pre-submission stage that
 *  shouldn't move the conversion-rate needle until the user actually applies. */
const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];

function emptyAnalytics(): AnalyticsData {
  return {
    funnel: {
      Drafting: 0,
      Applied: 0,
      OA: 0,
      Interview: 0,
      Offer: 0,
      Rejected: 0,
    },
    total: 0,
    resumePerformance: [],
    weeklyTrend: [],
  };
}

export function getDashboardCompanies(apps: Application[]): string[] {
  return [...new Set(apps.map((app) => app.company.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterDashboardApplications(apps: Application[], filters: DashboardFilters): Application[] {
  const { company, stage } = filters;
  return apps.filter((app) => {
    if (company !== "All" && app.company !== company) return false;
    if (stage !== "All" && app.stage !== stage) return false;
    return true;
  });
}

export function buildAnalyticsFromApplications(apps: Application[]): AnalyticsData {
  if (!apps.length) return emptyAnalytics();

  // funnel covers every stage (including Drafting) for type completeness, but Drafting
  // apps are skipped below so the count stays 0 — analytics should reflect submitted apps.
  const funnel: Record<Stage, number> = { Drafting: 0, Applied: 0, OA: 0, Interview: 0, Offer: 0, Rejected: 0 };
  const resumeMap = new Map<string, { _id: string; total: number; responses: number }>();
  const weekMap = new Map<string, { _id: { year: number; week: number }; count: number; firstDate: string }>();

  let submittedTotal = 0;
  for (const app of apps) {
    // Drafting apps are pre-submission; they don't count toward funnel/resume/trend metrics.
    if (app.stage === "Drafting") continue;
    funnel[app.stage] += 1;
    submittedTotal += 1;

    if (app.resumeId) {
      const prev = resumeMap.get(app.resumeId) ?? { _id: app.resumeId, total: 0, responses: 0 };
      prev.total += 1;
      if (app.stage === "OA" || app.stage === "Interview" || app.stage === "Offer") prev.responses += 1;
      resumeMap.set(app.resumeId, prev);
    }

    const date = new Date(app.applicationDate);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const key = `${year}-${week}`;
    const prev = weekMap.get(key);
    if (prev) {
      prev.count += 1;
      if (new Date(app.applicationDate).getTime() < new Date(prev.firstDate).getTime()) prev.firstDate = app.applicationDate;
    } else {
      weekMap.set(key, { _id: { year, week }, count: 1, firstDate: app.applicationDate });
    }
  }

  const weeklyTrend = [...weekMap.values()].sort((a, b) => {
    if (a._id.year !== b._id.year) return a._id.year - b._id.year;
    return a._id.week - b._id.week;
  });

  return {
    funnel,
    total: submittedTotal,
    resumePerformance: [...resumeMap.values()],
    weeklyTrend,
  };
}

export function getRecentApplications(apps: Application[], limit = 8): Application[] {
  return [...apps]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function getStageCounts(apps: Application[], company: string): Record<Stage, number> {
  const scoped = company === "All" ? apps : apps.filter((app) => app.company === company);
  const acc: Record<Stage, number> = { Drafting: 0, Applied: 0, OA: 0, Interview: 0, Offer: 0, Rejected: 0 };
  for (const app of scoped) acc[app.stage] += 1;
  return acc;
}

function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}
