/**
 * Public landing page — shown at "/" when the user is signed out.
 *
 * Orchestrator: assembles the section components, owns the auth-modal
 * state (open/close + ?auth= deep link + demo login), and provides the
 * `LandingAuthCtx` so nested sections can open the modal or sign in as
 * the demo user without prop drilling.
 *
 * Section order:
 *   1. Nav (sticky, glass-on-scroll)
 *   2. HeroBand (Hero + BoardStrip + FounderBar on shared blue gradient)
 *   3. FeatureShowcase (4 alternating Kanban / Tailor / Gmail / Extension)
 *   4. Comparison ("why visitors switch")
 *   5. Bento (DARK, mouse-tracked glow on cards)
 *   6. PowerUserGrid (⌘K, PDFs, BYOK)
 *   7. StatsStrip (gradient bg + animated counters)
 *   8. FAQ (2-column with sidecar)
 *   9. BigCTA (gradient)
 *  10. Footer (continues CTA gradient into navy)
 */
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import AuthModal, { type AuthMode } from "../../components/AuthModal/AuthModal.tsx";
import { UserContext } from "../../App.tsx";
import { authAPI } from "../../utils/api.ts";
import { LandingAuthCtx, DEMO_EMAIL, DEMO_PASSWORD } from "./context";
import Nav from "./Nav";
import HeroBand from "./HeroBand";
import FeatureShowcase from "./FeatureShowcase";
import Comparison from "./Comparison";
import Bento from "./Bento";
import PowerUserGrid from "./PowerUserGrid";
import StatsStrip from "./StatsStrip";
import FAQ from "./FAQ";
import BigCTA from "./BigCTA";
import Footer from "./Footer";

export default function LandingPage() {
  const { setUser } = useContext(UserContext);
  const [params, setParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // /login and /register both redirect here with ?auth=login|register so a
  // direct URL still pops the modal instead of dead-ending on the landing.
  useEffect(() => {
    const p = params.get("auth");
    if (p === "login" || p === "register") setAuthMode(p);
  }, [params]);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);
  const closeAuth = () => {
    setAuthMode(null);
    if (params.has("auth")) {
      params.delete("auth");
      setParams(params, { replace: true });
    }
  };

  /** One-click sign-in as the demo user. Forces light theme so the demo always
   *  presents the same look — even if the demo account previously toggled dark. */
  const loginDemo = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const u = await authAPI.login(DEMO_EMAIL, DEMO_PASSWORD);
      try {
        localStorage.setItem(`hiretrail-theme-id:${u._id}`, "modern-minimal");
        localStorage.setItem("hiretrail-theme-id", "modern-minimal");
      } catch { /* localStorage unavailable — fine */ }
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
      <div className="bg-white text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900 min-h-screen">
        <style>{`
          @keyframes ht-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes ht-drift {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -20px) scale(1.05); }
          }
          @keyframes ht-shimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
        `}</style>
        <Nav />
        <main>
          <HeroBand />
          <div id="features" />
          <FeatureShowcase />
          <Comparison />
          <Bento />
          <PowerUserGrid />
          <StatsStrip />
          <FAQ />
          <BigCTA />
        </main>
        <Footer />
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
