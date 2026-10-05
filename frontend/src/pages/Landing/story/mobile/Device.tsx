/** The phone story's frame: a narrow browser window (360 × 500 design size,
 *  scaled by the scene) over five stacked screens, and a touch mark that
 *  shows each tap. Decorative: hidden from assistive tech and inert. */
import { forwardRef, useEffect, useRef } from "react";
import { MApply, MiniBar, MPersonalize, MStudio, MTrack } from "./screens.tsx";

export const DEVICE_W = 360;
export const DEVICE_H = 500;

export const M_SCREENS = ["studio", "apply", "track", "settings", "settingsPick"] as const;
export type MScreenName = (typeof M_SCREENS)[number];

export const M_SCREEN_URL: Record<MScreenName, string> = {
  studio: "hiretrail.manavkaneria.me/resume-studio",
  apply: "boards.greenhouse.io/stripe/jobs",
  track: "hiretrail.manavkaneria.me/applications",
  settings: "hiretrail.manavkaneria.me/settings",
  settingsPick: "hiretrail.manavkaneria.me/settings",
};

const MobileDevice = forwardRef<HTMLDivElement>(function MobileDevice(_, ref) {
  const inner = useRef<HTMLDivElement | null>(null);
  // React 18 has no `inert` prop — set the attribute so nothing inside is focusable.
  useEffect(() => {
    inner.current?.setAttribute("inert", "");
  }, []);
  return (
    <div
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className="lp-device"
      aria-hidden
    >
      <div data-lp="m-screen-studio" className="lp-screen theme-light is-live" style={{ opacity: 1 }}><MStudio /></div>
      <div data-lp="m-screen-apply" className="lp-screen theme-light"><MApply /></div>
      <div data-lp="m-screen-track" className="lp-screen theme-light"><MTrack /></div>
      <div data-lp="m-screen-settings" className="lp-screen theme-light"><MPersonalize selected="light" /></div>
      <div data-lp="m-screen-settingsPick" className="lp-screen theme-light"><MPersonalize selected="dark" /></div>
      <MiniBar url={M_SCREEN_URL.studio} />
      <span data-lp="m-touch" className="lp-touch" style={{ opacity: 0 }} />
    </div>
  );
});

export default MobileDevice;
