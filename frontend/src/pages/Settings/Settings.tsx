/** Settings — single-card scroll-spy layout for Account / Password / Email / AI. */
import { useCallback, useEffect, useMemo, useRef, useState, FormEvent, lazy, Suspense } from "react";
import toast from "react-hot-toast";
import { api, applicationsAPI, emailAPI, aiAPI } from "../../utils/api.ts";
import type { EmailStatusResponse } from "../../utils/api.ts";
import type { User } from "../../types";
import { AISettingsCard } from "./AISettingsCard.tsx";
import { useFeatureFlags } from "../../hooks/useFeatureFlags.tsx";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";

/** Lazy-loaded so the feedback modal's bundle doesn't ship to users who never
 *  hit a "request access" or "report rejection" CTA. */
const FeedbackModal = lazy(() => import("../../components/FeedbackWidget/FeedbackModal.tsx"));

/* ---------- shared field styles ---------- */
const inputCls =
  "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-shadow";

const DEFAULT_EMAIL_STATUS: EmailStatusResponse = {
  gmail: { connected: false, email: null, lastSyncAt: null },
  outlook: { connected: false, email: null, lastSyncAt: null, configured: false },
};

type SectionKey = "account" | "password" | "email" | "ai" | "profileSync";
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "password", label: "Password" },
  { key: "email", label: "Email" },
  { key: "ai", label: "AI Providers" },
  { key: "profileSync", label: "Profile Sync" },
];

/** Searchable index of every labeled field on this page. Aliases let the
 *  search box find a field by intent (e.g. "api key" → AI Providers) even
 *  when the visible label doesn't contain that word. Anything new added to
 *  the page should also be added here so the search stays comprehensive. */
const SEARCH_INDEX: { key: string; section: SectionKey; aliases?: string[] }[] = [
  { key: "Full name", section: "account" },
  { key: "Email", section: "account", aliases: ["account email"] },
  { key: "Current password", section: "password" },
  { key: "New password", section: "password" },
  { key: "Email Integration", section: "email", aliases: ["inbox", "mailbox"] },
  { key: "Gmail", section: "email", aliases: ["google"] },
  { key: "Outlook", section: "email", aliases: ["microsoft"] },
  { key: "Scan now", section: "email", aliases: ["scan inbox"] },
  { key: "Report a rejection", section: "email", aliases: ["rejected"] },
  { key: "AI Providers", section: "ai", aliases: ["openai", "anthropic", "api key", "gpt", "claude", "model"] },
  { key: "AI-assisted merge", section: "profileSync", aliases: ["merge", "resume sync"] },
];

function matchesEntry(entry: { key: string; aliases?: string[] }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (entry.key.toLowerCase().includes(q)) return true;
  return (entry.aliases || []).some((a) => a.toLowerCase().includes(q));
}

/** Wraps a label string so any portion matching `query` is rendered inside a
 *  <mark> with the find-in-page yellow tint. Empty query renders the plain
 *  string. Case-insensitive; only highlights the first match per label. */
function MatchLabel({ children, query }: { children: string; query: string }) {
  if (!query.trim()) return <>{children}</>;
  const idx = children.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{children}</>;
  return (
    <>
      {children.slice(0, idx)}
      <mark className="bg-yellow-200/80 dark:bg-yellow-500/30 text-foreground rounded px-0.5">
        {children.slice(idx, idx + query.length)}
      </mark>
      {children.slice(idx + query.length)}
    </>
  );
}

/* ---------- helpers ---------- */

function ReportRejectionModal({ onClose }: { onClose: () => void }) {
  const [company, setCompany] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await applicationsAPI.getAll({ search: company, limit: 100 });
      const match = res.data.find(
        (a) => a.company.toLowerCase() === company.toLowerCase() && a.stage !== "Rejected"
      );
      if (!match) {
        toast.error("No matching active application found for that company.");
        setSubmitting(false);
        return;
      }
      await applicationsAPI.update(match._id, { stage: "Rejected", archivedReason: "rejected" });
      toast.success("Application rejected. It will be auto-archived in 7 days.");
      onClose();
    } catch {
      toast.error("Failed to report rejection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-[440px] animate-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Report a rejection</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Company name *</label>
            <input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date received *</label>
            <input type="date" className={inputCls} value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">{submitting ? "Submitting..." : "Submit"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MailboxRow({
  provider, state, loading, configured, comingSoon, onConnect, onDisconnect, onRequestAccess, searchQuery = "",
}: {
  provider: "Gmail" | "Outlook";
  state: { connected: boolean; email: string | null; lastSyncAt: string | null };
  loading: boolean;
  configured: boolean;
  /** When true, replaces the Connect CTA with a disabled "Coming soon" pill. */
  comingSoon?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Optional "Request access" affordance — surfaced when the provider is
   *  configured but the OAuth app is still in test mode (Google's case). */
  onRequestAccess?: () => void;
  /** When a parent search box has a query, the provider name is wrapped in
   *  MatchLabel so the same find-in-page highlight applies in the mailbox row. */
  searchQuery?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          {provider === "Gmail" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
              <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
              <rect x="2" y="6" width="14" height="12" rx="1.5" />
              <rect x="16" y="3" width="6" height="18" rx="1.5" />
              <line x1="2" y1="11" x2="16" y2="11" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground"><MatchLabel query={searchQuery}>{provider}</MatchLabel></span>
            {state.connected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
              </span>
            ) : !configured ? (
              <span className="text-[11px] font-medium text-muted-foreground">Not configured on this server</span>
            ) : (
              <span className="text-[11px] font-medium text-muted-foreground">Not connected</span>
            )}
          </div>
          {state.connected && state.email && (
            <p className="text-xs text-muted-foreground truncate">{state.email}{state.lastSyncAt ? ` · last scanned ${new Date(state.lastSyncAt).toLocaleDateString()}` : ""}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {state.connected ? (
          <button
            disabled={loading}
            onClick={onDisconnect}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-50"
          >
            {loading ? "Working…" : "Disconnect"}
          </button>
        ) : comingSoon ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted text-muted-foreground" aria-disabled="true">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            Coming soon
          </span>
        ) : (
          <>
            <button
              disabled={loading || !configured}
              onClick={onConnect}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={configured ? "" : `${provider} integration is not configured on this server`}
            >
              {loading ? "Connecting…" : `Connect ${provider}`}
            </button>
            {onRequestAccess && (
              <button
                type="button"
                onClick={onRequestAccess}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 whitespace-nowrap"
                title="HireTrail's Gmail integration is in Google's test mode. Request to be added as a test user."
              >
                Request access
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================== */
/* Page                                                           */
/* ============================================================== */

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectionModal, setRejectionModal] = useState(false);
  /** When the user clicks "Request access" on Gmail (because Google's OAuth
   *  app is in test mode), open the feedback modal pre-filled with their
   *  email so the admin can add them to the test users list. */
  const [requestAccessModal, setRequestAccessModal] = useState(false);
  /** Feature flag — when feature_outlook_integration flips true, we restore
   *  the real Connect button. Default off → "Coming soon" state.  */
  const { isEnabled } = useFeatureFlags();
  const outlookEnabled = isEnabled("feature_outlook_integration");
  const { requireRealAccount } = useDemoGate();
  const [mailbox, setMailbox] = useState<EmailStatusResponse>(DEFAULT_EMAIL_STATUS);
  const [mailboxLoading, setMailboxLoading] = useState<null | "gmail" | "outlook" | "scan">(null);
  const [aiProviderCount, setAiProviderCount] = useState(0);
  const [active, setActive] = useState<SectionKey>("account");
  const [search, setSearch] = useState("");

  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [mergeSaving, setMergeSaving] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<SectionKey, HTMLElement | null>>({
    account: null, password: null, email: null, ai: null, profileSync: null,
  });

  useEffect(() => {
    Promise.all([
      api.get<User>("/auth/me").then((r) => {
        setUser(r.data);
        setName(r.data.name);
        setEmail(r.data.email);
        setMergeEnabled(r.data.mergeResumesEnabled !== false);
      }),
      emailAPI.status().then(setMailbox).catch(() => {}),
      aiAPI.listKeys().then((keys) => setAiProviderCount(new Set(keys.filter((k) => k.isActive).map((k) => k.provider)).size)).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));

    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get("gmail");
    const outlookResult = params.get("outlook");
    if (gmailResult === "success") toast.success("Gmail connected successfully!");
    else if (gmailResult === "error") toast.error("Failed to connect Gmail");
    if (outlookResult === "success") toast.success("Outlook connected successfully!");
    else if (outlookResult === "error") toast.error("Failed to connect Outlook");
    if (gmailResult || outlookResult) {
      emailAPI.status().then(setMailbox).catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Scroll-spy.
  useEffect(() => {
    if (loading) return;
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const key = (visible[0].target as HTMLElement).dataset.section as SectionKey | undefined;
          if (key) setActive(key);
        }
      },
      { root, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    SECTIONS.forEach(({ key }) => {
      const node = sectionRefs.current[key];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [loading]);

  const scrollTo = (key: SectionKey) => {
    const node = sectionRefs.current[key];
    if (!node) return;
    setActive(key);
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Memoised search hits. matchedFields is the visible-label set we use to
   *  decide which rows to dim; matchCount feeds the "X matches" indicator;
   *  firstSection is what we auto-scroll into view on each query change. */
  const searchHits = useMemo(() => {
    const q = search.trim();
    if (!q) return { matchedFields: new Set<string>(), matchedSections: new Set<SectionKey>(), matchCount: 0, firstSection: null as SectionKey | null };
    const matchedFields = new Set<string>();
    const matchedSections = new Set<SectionKey>();
    let firstSection: SectionKey | null = null;
    for (const entry of SEARCH_INDEX) {
      if (matchesEntry(entry, q)) {
        matchedFields.add(entry.key);
        matchedSections.add(entry.section);
        if (!firstSection) firstSection = entry.section;
      }
    }
    return { matchedFields, matchedSections, matchCount: matchedFields.size, firstSection };
  }, [search]);

  /** Auto-scroll to the first matching section as the user types. Skips while
   *  the page is still loading or when the query is empty. Debounce isn't
   *  needed — setState batches each keystroke and the scroller is cheap. */
  useEffect(() => {
    if (loading) return;
    if (!search.trim()) return;
    const target = searchHits.firstSection;
    if (target) scrollTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, loading]);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put<User>("/auth/profile", { name, email });
      setUser(res.data);
      toast.success("Profile updated");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      toast.success("Password changed");
      setCurrentPassword(""); setNewPassword("");
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || "Password change failed");
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }, [user]);

  if (loading) {
    // Skeleton mirrors the 2-column layout users see post-load so the page
    // doesn't jolt when content arrives. Left card simulates section header +
    // a couple of form rows; right rail simulates the profile + integration
    // summary cards.
    return (
      <div className="settings-page max-w-7xl fade-up">
        <div className="mb-5">
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="border-b border-border px-5 py-3 flex gap-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5 w-16" />)}
            </div>
            <div className="px-7 py-6 space-y-6">
              <div className="space-y-2 max-w-xl">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-24 mt-3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <Skeleton className="h-12 w-12 !rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-1">Manage your account, mailbox integrations, and AI providers.</p>
        </div>
        {/* Search jumps to the first matching section and highlights matched
         *  field labels (find-in-page style). Aliases map "api key" → AI etc.
         *  Index lives in SEARCH_INDEX above. */}
        <div className="relative w-full sm:w-72">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings…"
            aria-label="Search settings"
            className={`${inputCls} pl-9 pr-10 h-9`}
          />
          {search && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
              {searchHits.matchCount} {searchHits.matchCount === 1 ? "match" : "matches"}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* ===== Main card ===== */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Underline tabs */}
          <div className="sticky top-0 z-10 bg-card border-b border-border">
            <nav className="flex gap-1 px-5 overflow-x-auto" role="tablist">
              {SECTIONS.map((s) => {
                const isHit = !!search.trim() && searchHits.matchedSections.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="tab"
                    aria-selected={active === s.key}
                    onClick={() => scrollTo(s.key)}
                    className={`relative px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                      active === s.key ? "text-foreground" : isHit ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {/* Tab label highlight matches the same yellow tint we use
                     *  inside the section so the user can spot which tabs hold
                     *  matches without scrolling. */}
                    <MatchLabel query={search}>{s.label}</MatchLabel>
                    {isHit && active !== s.key && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400" aria-hidden />
                    )}
                    <span
                      className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-opacity ${
                        active === s.key ? "bg-primary opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sections */}
          <div ref={scrollerRef} className="max-h-[calc(100dvh-220px)] overflow-y-auto px-7 py-6 space-y-10">
            {/* Account */}
            <section
              ref={(el) => { sectionRefs.current.account = el; }}
              data-section="account"
              className={`scroll-mt-2 transition-opacity ${search && !searchHits.matchedSections.has("account") ? "opacity-40" : ""}`}
            >
              <h2 className="text-base font-semibold text-foreground mb-1">Account</h2>
              <p className="text-xs text-muted-foreground mb-4">Your name and the email associated with your HireTrail account.</p>
              <form onSubmit={handleProfile} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5"><MatchLabel query={search}>Full name</MatchLabel></label>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5"><MatchLabel query={search}>Email</MatchLabel></label>
                  <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>

            {/* Password */}
            <section
              ref={(el) => { sectionRefs.current.password = el; }}
              data-section="password"
              className={`scroll-mt-2 transition-opacity ${search && !searchHits.matchedSections.has("password") ? "opacity-40" : ""}`}
            >
              <h2 className="text-base font-semibold text-foreground mb-1">Password</h2>
              <p className="text-xs text-muted-foreground mb-4">Use at least 6 characters. If you sign in with Google, you can set a password to enable email login.</p>
              <form onSubmit={handlePassword} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5"><MatchLabel query={search}>Current password</MatchLabel></label>
                  <input type="password" className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5"><MatchLabel query={search}>New password</MatchLabel></label>
                  <input type="password" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50">
                    Change password
                  </button>
                </div>
              </form>
            </section>

            {/* Email */}
            <section
              ref={(el) => { sectionRefs.current.email = el; }}
              data-section="email"
              className={`scroll-mt-2 transition-opacity ${search && !searchHits.matchedSections.has("email") ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-foreground"><MatchLabel query={search}>Email Integration</MatchLabel></h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary uppercase tracking-wider">Beta</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                HireTrail scans your inbox for interview invites, offers, and rejections — and updates your applications automatically. Connect one or both providers.
              </p>

              <div className="rounded-lg border border-border divide-y divide-border px-4">
                <MailboxRow
                  provider="Gmail"
                  searchQuery={search}
                  state={mailbox.gmail}
                  loading={mailboxLoading === "gmail"}
                  configured={true}
                  onConnect={async () => {
                    if (!requireRealAccount("Email integration")) return;
                    setMailboxLoading("gmail");
                    try {
                      const { url } = await emailAPI.connectGmail();
                      window.location.href = url;
                    } catch { toast.error("Failed to start Gmail connection"); setMailboxLoading(null); }
                  }}
                  onDisconnect={async () => {
                    setMailboxLoading("gmail");
                    try {
                      await emailAPI.disconnectGmail();
                      setMailbox((m) => ({ ...m, gmail: { connected: false, email: null, lastSyncAt: null } }));
                      toast.success("Gmail disconnected");
                    } catch { toast.error("Failed to disconnect"); }
                    finally { setMailboxLoading(null); }
                  }}
                  onRequestAccess={() => setRequestAccessModal(true)}
                />
                {/* Outlook: gated behind feature_outlook_integration. When the
                 *  flag is off (default) we show the "Coming soon" pill. Flip the
                 *  flag in admin settings to surface the real Connect flow once
                 *  the Outlook OAuth app is wired up. */}
                {outlookEnabled ? (
                  <MailboxRow
                    provider="Outlook"
                    searchQuery={search}
                    state={mailbox.outlook}
                    loading={mailboxLoading === "outlook"}
                    configured={mailbox.outlook.configured}
                    onConnect={async () => {
                      if (!requireRealAccount("Email integration")) return;
                      setMailboxLoading("outlook");
                      try {
                        const { url } = await emailAPI.connectOutlook();
                        window.location.href = url;
                      } catch (err) {
                        const e = err as { response?: { data?: { error?: string } } };
                        toast.error(e.response?.data?.error || "Failed to start Outlook connection");
                        setMailboxLoading(null);
                      }
                    }}
                    onDisconnect={async () => {
                      setMailboxLoading("outlook");
                      try {
                        await emailAPI.disconnectOutlook();
                        setMailbox((m) => ({ ...m, outlook: { ...m.outlook, connected: false, email: null, lastSyncAt: null } }));
                        toast.success("Outlook disconnected");
                      } catch { toast.error("Failed to disconnect"); }
                      finally { setMailboxLoading(null); }
                    }}
                  />
                ) : (
                  <MailboxRow
                    provider="Outlook"
                    searchQuery={search}
                    state={mailbox.outlook}
                    loading={false}
                    configured={false}
                    comingSoon
                    onConnect={() => undefined}
                    onDisconnect={() => undefined}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {(mailbox.gmail.connected || mailbox.outlook.connected) && (
                  <button
                    disabled={mailboxLoading === "scan"}
                    onClick={async () => {
                      if (!requireRealAccount("Email inbox scan")) return;
                      setMailboxLoading("scan");
                      try {
                        const result = await emailAPI.scan();
                        toast.success(result.message);
                        if (result.errors?.length) toast.error(result.errors.join(" · "));
                        const fresh = await emailAPI.status();
                        setMailbox(fresh);
                      } catch { toast.error("Scan failed"); }
                      finally { setMailboxLoading(null); }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
                  >
                    {mailboxLoading === "scan" ? "Scanning…" : "Scan now"}
                  </button>
                )}
                <button onClick={() => setRejectionModal(true)} className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted">
                  Report a rejection manually
                </button>
              </div>
            </section>

            {/* AI providers */}
            <section
              ref={(el) => { sectionRefs.current.ai = el; }}
              data-section="ai"
              className={`scroll-mt-2 transition-opacity ${search && !searchHits.matchedSections.has("ai") ? "opacity-40" : ""}`}
            >
              <h2 className="text-base font-semibold text-foreground mb-1"><MatchLabel query={search}>AI Providers</MatchLabel></h2>
              <p className="text-xs text-muted-foreground mb-4">
                Bring your own keys to use specific models for resume parsing, classification, and tailoring. Without keys, HireTrail falls back to the default provider.
              </p>
              <AISettingsCard />
            </section>

            {/* Profile Sync */}
            <section
              ref={(el) => { sectionRefs.current.profileSync = el; }}
              data-section="profileSync"
              className={`scroll-mt-2 transition-opacity ${search && !searchHits.matchedSections.has("profileSync") ? "opacity-40" : ""}`}
            >
              <h2 className="text-base font-semibold text-foreground mb-1"><MatchLabel query={search}>Profile Sync</MatchLabel></h2>
              <p className="text-xs text-muted-foreground mb-4">
                Control how re-parsing a resume updates your master profile.
              </p>
              <div className="rounded-lg border border-border bg-background p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground"><MatchLabel query={search}>AI-assisted merge</MatchLabel></p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    When enabled, re-parsing a resume sends both your existing master profile and the newly parsed one to your AI provider, which combines them — deduping experiences, unioning skills, and preserving content from both. When disabled, re-parsing <strong>overwrites</strong> the master profile.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={mergeEnabled}
                    disabled={mergeSaving}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      if (!requireRealAccount("Profile Sync")) {
                        // Roll the checkbox back to its prior state — demo user can't toggle.
                        e.target.checked = !next;
                        return;
                      }
                      setMergeEnabled(next);
                      setMergeSaving(true);
                      try {
                        await api.put<User>("/auth/profile", { mergeResumesEnabled: next });
                        toast.success(next ? "Merge enabled" : "Merge disabled");
                      } catch {
                        setMergeEnabled(!next);
                        toast.error("Could not update setting");
                      } finally {
                        setMergeSaving(false);
                      }
                    }}
                  />
                  <span className="w-11 h-6 bg-muted border border-border rounded-full peer-checked:bg-primary peer-disabled:opacity-50 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"></span>
                </label>
              </div>
            </section>
          </div>
        </div>

        {/* ===== Right sidebar ===== */}
        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-semibold shadow-sm">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Integrations</h3>
            <ul className="space-y-2 text-sm">
              <IntegrationRow
                label="Gmail"
                connected={mailbox.gmail.connected}
                explicit={mailbox.gmail.connected && mailbox.gmail.lastSyncAt
                  ? `last sync ${new Date(mailbox.gmail.lastSyncAt).toLocaleDateString()}`
                  : undefined}
              />
              <IntegrationRow
                label="Outlook"
                connected={outlookEnabled ? mailbox.outlook.connected : false}
                muted={!outlookEnabled || !mailbox.outlook.configured}
                mutedLabel={outlookEnabled ? "Not configured" : "Coming soon"}
              />
              <IntegrationRow
                label="AI providers"
                connected={aiProviderCount > 0}
                explicit={aiProviderCount > 0 ? `${aiProviderCount} key${aiProviderCount === 1 ? "" : "s"}` : undefined}
              />
            </ul>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              HireTrail v4.0 · Your data is encrypted at rest. Keys are AES-GCM. Sessions are HttpOnly cookies.
            </p>
          </div>
        </aside>
      </div>

      {rejectionModal && <ReportRejectionModal onClose={() => setRejectionModal(false)} />}
      {requestAccessModal && (
        <Suspense fallback={null}>
          <FeedbackModal
            onClose={() => setRequestAccessModal(false)}
            initial={{
              type: "other",
              title: "Request Gmail integration access",
              message: `Hi! Please add my Google account (${user?.email ?? ""}) to the HireTrail Gmail OAuth test-user list so I can connect my inbox.\n\nThanks!`,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function IntegrationRow({
  label, connected, explicit, muted, mutedLabel,
}: {
  label: string; connected: boolean; explicit?: string; muted?: boolean; mutedLabel?: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      {connected ? (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {explicit ?? "Connected"}
        </span>
      ) : muted ? (
        <span className="text-[11px] text-muted-foreground">{mutedLabel ?? "—"}</span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
          Not connected
        </span>
      )}
    </li>
  );
}
