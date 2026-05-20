import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/* ─────────────────────────── brand + CTAs ─────────────────────────── */

export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="flex-shrink-0">
      <defs>
        <linearGradient id="ht-brand-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#ht-brand-grad)" />
      <path d="M10 8h3v6h6V8h3v16h-3v-7h-6v7h-3V8z" fill="#FFFFFF" />
    </svg>
  );
}

/** Primary CTA — renders as a <button> when `onClick` is provided, else <Link to={to}>. */
export function PrimaryCTA({ to, onClick, children, size = "lg", shape = "rounded", className = "" }: { to?: string; onClick?: () => void; children: ReactNode; size?: "lg" | "md"; shape?: "rounded" | "pill"; className?: string }) {
  const sizes = { lg: "px-7 py-3.5 text-base", md: "px-5 py-2.5 text-sm" };
  const shapeCls = shape === "pill" ? "rounded-full" : "rounded-lg";
  const cls = `group relative inline-flex items-center justify-center gap-2 font-semibold ${shapeCls} text-white bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] shadow-[0_10px_30px_-10px_rgba(59,130,246,0.6)] hover:shadow-[0_14px_36px_-10px_rgba(59,130,246,0.75)] hover:-translate-y-px active:translate-y-0 transition-[box-shadow,transform,border-radius] duration-300 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 ${sizes[size]} ${className}`;
  const inner = (
    <>
      <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
      <span className="relative">{children}</span>
      <svg className="relative transition-transform group-hover:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <Link to={to!} className={cls}>{inner}</Link>;
}

export function SecondaryCTA({ to, onClick, children, size = "lg" }: { to?: string; onClick?: () => void; children: ReactNode; size?: "lg" | "md" }) {
  const sizes = { lg: "px-7 py-3.5 text-base", md: "px-5 py-2.5 text-sm" };
  const cls = `inline-flex items-center justify-center font-medium rounded-lg text-gray-900 bg-white/90 border border-gray-200 hover:bg-white hover:border-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2 ${sizes[size]}`;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{children}</button>;
  return <Link to={to!} className={cls}>{children}</Link>;
}

/* ─────────────────────────── chips ─────────────────────────── */

export const STAGE_CHIP: Record<string, string> = {
  Drafting: "bg-slate-100 text-slate-700 ring-slate-200",
  Applied: "bg-blue-100 text-blue-700 ring-blue-200",
  OA: "bg-amber-100 text-amber-700 ring-amber-200",
  Interview: "bg-purple-100 text-purple-700 ring-purple-200",
  Offer: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  Rejected: "bg-red-100 text-red-700 ring-red-200",
};

export function StageChip({ stage, className = "" }: { stage: keyof typeof STAGE_CHIP; className?: string }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ring-1 ring-inset ${STAGE_CHIP[stage]} ${className}`}>
      {stage}
    </span>
  );
}
