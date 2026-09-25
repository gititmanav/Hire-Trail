/** The one product window the story follows, drawn at a fixed design size
 *  (1200 × 760) and scaled by the scene: a browser bar over five stacked
 *  screens (Studio, a job posting, the Board, Settings light and dark) and a
 *  pointer that clicks through them. Decorative: hidden from assistive tech
 *  and inert (the page's real content is the copy beside it). */
import { forwardRef, useEffect, useRef } from "react";
import { BrowserBar } from "./shell.tsx";
import StudioScreen from "./StudioScreen.tsx";
import PostingScreen from "./PostingScreen.tsx";
import BoardScreen from "./BoardScreen.tsx";
import SettingsScreen from "./SettingsScreen.tsx";

export const WINDOW_W = 1200;
export const WINDOW_H = 760;

export const SCREENS = ["studio", "posting", "board", "settings", "settingsDark"] as const;
export type ScreenName = (typeof SCREENS)[number];

export const SCREEN_URL: Record<ScreenName, string> = {
  studio: "hiretrail.manavkaneria.me/resume-studio",
  posting: "boards.greenhouse.io/stripe/jobs/senior-frontend-engineer",
  board: "hiretrail.manavkaneria.me/applications/board",
  settings: "hiretrail.manavkaneria.me/settings/personalize",
  settingsDark: "hiretrail.manavkaneria.me/settings/personalize",
};

function Pointer() {
  return (
    <div data-lp="cursor" className="absolute left-0 top-0 z-30 pointer-events-none" style={{ opacity: 0 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
        <path d="M4 2.5 19.5 12l-6.6 1.4 3.7 7.1-2.6 1.4-3.7-7.2L5.6 19.2Z" fill="#fff" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const ProductWindow = forwardRef<HTMLDivElement>(function ProductWindow(_, ref) {
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
      className="lp-window"
      aria-hidden
    >
      <div data-lp="screen-studio" className="lp-screen theme-light is-live" style={{ opacity: 1 }}><StudioScreen /></div>
      <div data-lp="screen-posting" className="lp-screen theme-light"><PostingScreen /></div>
      <div data-lp="screen-board" className="lp-screen theme-light"><BoardScreen /></div>
      <div data-lp="screen-settings" className="lp-screen theme-light"><SettingsScreen selected="light" /></div>
      <div data-lp="screen-settingsDark" className="lp-screen theme-dark dark"><SettingsScreen selected="dark" /></div>
      <div className="theme-light"><BrowserBar /></div>
      <div data-lp="bar-dark" className="absolute inset-x-0 top-0" style={{ opacity: 0 }}><BrowserBar dark /></div>
      <Pointer />
    </div>
  );
});

export default ProductWindow;
