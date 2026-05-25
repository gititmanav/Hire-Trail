/**
 * Company logo with graceful fallback. Renders an <img> when `logoUrl` is set,
 * otherwise the deterministic colored monogram tile. On <img> load failure
 * (404, blocked, etc.) it transparently falls back to the monogram so no
 * broken-image icon ever flashes.
 */
import { useState, memo } from "react";

interface Props {
  /** Display name — also used to derive monogram + tile background. */
  name: string;
  /** Cached CDN URL (Cloudinary). When empty, the monogram fallback renders. */
  logoUrl?: string;
  /** Visual size. md = 40px, sm = 32px. */
  size?: "md" | "sm";
  className?: string;
}

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** logo.clearbit.com is no longer reliably reachable since the HubSpot
 *  acquisition — DNS resolution intermittently fails, which floods consoles
 *  with ERR_NAME_NOT_RESOLVED for any legacy data still pointing at it.
 *  Treat any such URL as a known-bad source and render the monogram instead. */
function isUnreachableLogoUrl(url: string): boolean {
  return /^https?:\/\/(logo\.)?clearbit\.com\//i.test(url);
}

function CompanyLogoImpl({ name, logoUrl, size = "md", className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "md" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  const usableLogo = logoUrl && !failed && !isUnreachableLogoUrl(logoUrl);

  if (usableLogo) {
    return (
      <div className={`${sizeClass} rounded-lg overflow-hidden bg-white dark:bg-slate-100 border border-border shrink-0 ${className}`}>
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain p-0.5"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>
    );
  }

  const hue = hueFromString(name);
  return (
    <div
      className={`${sizeClass} rounded-lg flex items-center justify-center font-semibold text-white shrink-0 select-none ${className}`}
      style={{ background: `hsl(${hue} 55% 45%)` }}
      aria-hidden
    >
      {monogram(name)}
    </div>
  );
}

export default memo(CompanyLogoImpl);
