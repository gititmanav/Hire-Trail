/**
 * Public landing page — shown at "/" when the user is signed out.
 *
 * Orchestrator: assembles the chapters, owns the auth-modal state (open/close,
 * the ?auth= deep link, the demo login) and provides `LandingAuthCtx` so any
 * chapter can open the modal or sign in as the demo user.
 *
 * Chapters (colours alternate black · white · black · white · black):
 *   1. StoryScene — hero (beams) → Tailor · Apply · Track in one pinned
 *      product window → the dive into dark. Below 1024px, MobileStory tells
 *      the same story composed for a narrow screen (story/mobile/).
 *   2. ThemeScene — "Make it yours": the theme engine, live
 *   3. EverythingScene — the rest of the app, one lit word at a time
 *   4. FounderScene → Promises → Compare → FAQ — back on white
 *   5. Closing — back to black: the last ask, then the footer
 */
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import AuthModal, { type AuthMode } from "../../components/AuthModal/AuthModal.tsx";
import { UserContext, preloadAppShell } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";
import { DEMO_THEME_KEY } from "../../hooks/useTheme.tsx";
import { usePageEntryScroll } from "../../hooks/usePageEntryScroll.ts";
import { useCompactLanding } from "./engine/hooks.ts";
import { onTone } from "./engine/scroll.ts";
import { LandingAuthCtx, DEMO_EMAIL, DEMO_PASSWORD } from "./context";
import Nav from "./Nav";
import StoryScene from "./story/StoryScene.tsx";
import MobileStory from "./story/mobile/MobileStory.tsx";
import ThemeScene from "./theme/ThemeScene.tsx";
import EverythingScene from "./everything/EverythingScene.tsx";
import FounderScene from "./trust/FounderScene.tsx";
import Promises from "./trust/Promises.tsx";
import Compare from "./trust/Compare.tsx";
import FAQ from "./trust/FAQ.tsx";
import Closing from "./closing/Closing.tsx";
import "./Landing.css";

export default function LandingPage() {
  const { setUser } = useContext(UserContext);
  const [params, setParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const compact = useCompactLanding();
  usePageEntryScroll();

  // /login and /register both redirect here with ?auth=login|register so a
  // direct URL still pops the modal instead of dead-ending on the landing.
  useEffect(() => {
    const p = params.get("auth");
    if (p === "login" || p === "register") openAuth(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // While the landing is up, the page's overscroll matches its black ends and
  // the browser chrome follows the chapter under the header (black or white,
  // like the header itself); both are put back on the way out.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("lp-root");
    root.classList.remove("lp-boot"); // index.html's pre-paint, now covered by lp-root
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content") ?? null;
    const offTone = onTone((tone) => meta?.setAttribute("content", tone === "light" ? "#ffffff" : "#000000"));
    return () => {
      offTone();
      root.classList.remove("lp-root");
      if (meta && previous !== null) meta.setAttribute("content", previous);
    };
  }, []);

  // Showing intent to sign in starts fetching the app, so it's there when they are.
  const openAuth = (mode: AuthMode) => {
    preloadAppShell();
    setAuthMode(mode);
  };
  const closeAuth = () => {
    setAuthMode(null);
    if (params.has("auth")) {
      params.delete("auth");
      setParams(params, { replace: true });
    }
  };

  /** One-click sign-in as the demo user. The demo's theme lives on this device
   *  and resets per visit, so every visitor starts from the same look. */
  const loginDemo = async () => {
    if (demoLoading) return;
    preloadAppShell();
    setDemoLoading(true);
    try {
      const u = await authAPI.login(DEMO_EMAIL, DEMO_PASSWORD);
      try { localStorage.removeItem(DEMO_THEME_KEY); } catch { /* localStorage unavailable — fine */ }
      toast.success(`Welcome, ${u.name}!`);
      setUser(u);
    } catch {
      toast.error("Couldn't sign in as demo. Try again in a moment.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <LandingAuthCtx.Provider value={{ openAuth, loginDemo, demoLoading }}>
      <div className="lp min-h-screen">
        <Nav />
        <main>
          {compact ? <MobileStory /> : <StoryScene />}
          <ThemeScene />
          <EverythingScene />
          <FounderScene />
          <Promises />
          <Compare />
          <FAQ />
        </main>
        <Closing />
        <AuthModal
          open={authMode !== null}
          mode={authMode ?? "login"}
          onModeChange={(m) => setAuthMode(m)}
          onClose={closeAuth}
          onLogin={(u) => { setUser(u); closeAuth(); }}
        />
      </div>
    </LandingAuthCtx.Provider>
  );
}
