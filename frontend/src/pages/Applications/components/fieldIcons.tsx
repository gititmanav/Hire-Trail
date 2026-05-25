/**
 * Shared icon vocabulary for the Applications row + detail sidebar. Keeping
 * these in one file means the row and sidebar render *identical* glyphs next
 * to identical labels — the visual rhythm the user asked for.
 */
import type { SVGProps } from "react";

const baseProps: SVGProps<SVGSVGElement> = {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const Icons = {
  location: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
  ),
  salary: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" /></svg>
  ),
  jobType: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>
  ),
  resume: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" /><path d="M13 2v7h7" /></svg>
  ),
  contact: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  deadline: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>
  ),
  notes: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></svg>
  ),
  jd: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg>
  ),
  company: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /></svg>
  ),
  calendar: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
  ),
  source: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...baseProps} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
  ),
} as const;

export type IconKey = keyof typeof Icons;
