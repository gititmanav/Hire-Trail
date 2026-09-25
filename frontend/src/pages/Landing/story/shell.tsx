/** The product window's frames: a browser bar, and the app's two shells (the
 *  main app and the Settings area) rebuilt from the app's own tokens and nav
 *  parts, so the story looks exactly like HireTrail. Everything here is
 *  decorative — the window is `aria-hidden` and inert. */
import type { ReactNode } from "react";
import {
  ArrowLeft, ArrowLeftRight, Bell, Building2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock,
  FileText, Info, LayoutDashboard, Lock, Mail, Palette, PanelLeftClose, Puzzle, RotateCw, Search,
  Sparkles, User as UserIcon, Users, Wand2, type LucideIcon,
} from "lucide-react";
import { GroupLabel, ICON_ROW, navTone } from "../../../components/Sidebar/navParts.tsx";

/* ─── Browser bar ─── */

export function BrowserBar({ dark }: { dark?: boolean }) {
  return (
    <div
      data-lp="bar"
      className={`absolute inset-x-0 top-0 h-11 flex items-center gap-3 px-4 border-b ${
        dark ? "bg-[#1f1f1f] border-white/[0.06] text-white/45" : "bg-[#f3f3f3] border-black/[0.06] text-black/35"
      }`}
    >
      <div className="flex items-center gap-2 w-[88px]">
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} className="w-3 h-3 rounded-full" style={{ background: c, opacity: 0.9 }} />
        ))}
      </div>
      <div className="flex items-center gap-2.5">
        <ChevronLeft size={17} strokeWidth={1.8} />
        <ChevronRight size={17} strokeWidth={1.8} className="opacity-50" />
      </div>
      <div className="flex-1 flex justify-center">
        <div className={`flex items-center gap-2 h-7 min-w-[420px] max-w-[520px] px-3 rounded-lg text-[12.5px] ${dark ? "bg-white/[0.07] text-white/70" : "bg-black/[0.045] text-black/60"}`}>
          <Lock size={11} strokeWidth={2.2} className="shrink-0 opacity-60" />
          <span data-lp="url" className="flex-1 text-center truncate tracking-[-0.01em]">hiretrail.manavkaneria.me/resume-studio</span>
          <RotateCw size={11} strokeWidth={2.2} className="shrink-0 opacity-50" />
        </div>
      </div>
      <div className="w-[88px] flex justify-end">
        <Puzzle size={15} strokeWidth={1.8} />
      </div>
    </div>
  );
}

/* ─── The app shell (Layout + Sidebar + Header) ─── */

type NavRow = { label: string; Icon: LucideIcon; badge?: string };
const APP_NAV: { label: string; items: NavRow[] }[] = [
  { label: "Overview", items: [{ label: "Dashboard", Icon: LayoutDashboard }, { label: "Notifications", Icon: Bell }] },
  { label: "Track", items: [{ label: "Applications", Icon: ClipboardList }, { label: "Deadlines", Icon: Clock }] },
  { label: "Network", items: [{ label: "Contacts", Icon: Users }, { label: "Companies", Icon: Building2 }] },
  {
    label: "Tools",
    items: [
      { label: "Resumes", Icon: FileText },
      { label: "Resume Studio", Icon: Wand2, badge: "New" },
      { label: "Import / Export", Icon: ArrowLeftRight },
    ],
  },
];

function Wordmark() {
  return (
    <span className="text-[18px] font-bold whitespace-nowrap select-none ml-1">
      <span className="text-[19px] text-primary">H</span>
      <span className="text-sidebar-foreground">ire</span>
      <span className="text-[19px] text-primary">T</span>
      <span className="text-sidebar-foreground">rail</span>
    </span>
  );
}

export function AppShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex bg-sidebar text-foreground">
      <aside className="w-60 shrink-0 flex flex-col">
        <div className="flex items-center min-h-[60px] px-4">
          <span className="flex-1 min-w-0"><Wordmark /></span>
          <span className="p-1.5 text-muted-foreground"><PanelLeftClose size={18} strokeWidth={1.5} /></span>
        </div>
        <nav className="flex-1 flex flex-col px-2">
          {APP_NAV.map((group, g) => (
            <div key={group.label} className={g === 0 ? "" : "mt-4"}>
              <GroupLabel label={group.label} collapsed={false} first={g === 0} />
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <div key={item.label} className={`${ICON_ROW} ${navTone(item.label === active)}`}>
                    <item.Icon size={18} strokeWidth={1.6} className="shrink-0" />
                    <span className="flex-1 min-w-0 inline-flex items-center justify-between">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{item.badge}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[60px] shrink-0 flex items-center justify-between pl-1 pr-3">
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground">
              <Puzzle size={16} strokeWidth={1.8} /> Add to Chrome
            </span>
            <span className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground">
              <Info size={13} strokeWidth={2} /> Where it works
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 h-9 w-56 px-3 rounded-lg border border-border bg-background text-[13px] text-muted-foreground">
              <Search size={14} strokeWidth={2} />
              <span className="flex-1">Search…</span>
              <kbd className="text-[10.5px] font-mono text-muted-foreground/70">⌘K</kbd>
            </span>
            <span className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground"><Bell size={18} strokeWidth={1.7} /></span>
            <span className="flex items-center gap-2.5 px-2 py-1.5">
              <span className="w-7 h-7 rounded-full bg-control text-foreground text-[11px] font-semibold flex items-center justify-center">AR</span>
              <span className="text-[13px] font-medium text-foreground">Alex Rivera</span>
              <ChevronDown size={14} strokeWidth={2} className="text-muted-foreground" />
            </span>
          </div>
        </header>
        <main className="relative flex-1 min-h-0 mr-2 mb-2 bg-background border border-border rounded-xl shadow-panel overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ─── The Settings shell (SettingsLayout) ─── */

const SETTINGS_NAV: { label: string; items: NavRow[] }[] = [
  { label: "Account", items: [{ label: "Profile", Icon: UserIcon }, { label: "Personalize", Icon: Palette }, { label: "Clipboard", Icon: ClipboardList }] },
  { label: "Integrations", items: [{ label: "Mailboxes", Icon: Mail }, { label: "AI & Models", Icon: Sparkles }] },
];

export function SettingsShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-sidebar flex flex-col">
        <div className="px-2 pt-3">
          <span className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground">
            <ArrowLeft size={16} strokeWidth={1.8} /> Back to HireTrail
          </span>
        </div>
        <div className="px-3 pt-3">
          <span className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-background text-[13px] text-muted-foreground/70">
            <Search size={13} strokeWidth={2} /> Search settings…
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 px-2 py-3">
          {SETTINGS_NAV.map((group, g) => (
            <div key={group.label} className={`flex flex-col gap-0.5 ${g === 0 ? "mt-1" : "mt-4"}`}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.label}</div>
              {group.items.map((item) => (
                <div key={item.label} className={`${ICON_ROW} ${navTone(item.label === active)}`}>
                  <item.Icon size={18} strokeWidth={1.6} className="shrink-0" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="relative flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
