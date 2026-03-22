/**
 * Centralized Tailwind classes for `public/logo.svg` (tight crop).
 * Sidebar uses a white tile + padding; auth screens place the mark on the page background.
 */

export const SIDEBAR_LOGO_TILE_CLASS =
  "h-12 w-12 shrink-0 rounded-lg bg-white overflow-hidden flex items-center justify-center p-0.5";

export const SIDEBAR_LOGO_IMG_CLASS =
  "h-[100%] w-[100%] max-w-none object-contain object-center";

/** Login/register split layout: large mark beside wordmark (desktop). */
export const AUTH_BRAND_LOGO_CLASS =
  "m-0 h-44 w-44 sm:h-[5rem] sm:w-[5rem] max-w-[13rem] sm:max-w-[15rem] object-contain object-center shrink-0";

/** Narrow column on small screens before the form. */
export const AUTH_BRAND_LOGO_MOBILE_CLASS = "h-36 w-36 object-contain object-center";

export function SidebarLogoTile() {
  return (
    <div className={SIDEBAR_LOGO_TILE_CLASS}>
      <img src="/logo.svg" alt="HireTrail" className={SIDEBAR_LOGO_IMG_CLASS} />
    </div>
  );
}
