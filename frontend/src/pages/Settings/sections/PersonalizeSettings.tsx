/** Settings → Personalize: theme choice (System / Light / Dark). */
import { useContext } from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { ThemeContext } from "../../../App.tsx";
import { SettingsHeader } from "../ui.tsx";

interface ThemeOption {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Thumbnail body — a miniature "app window". */
  preview: React.ReactNode;
}

/** Miniature window: chrome strip + content lines, tinted for each scheme. */
function Mini({ dark, split }: { dark?: boolean; split?: boolean }) {
  const pane = (isDark: boolean, rounded: string) => (
    <div className={`flex-1 ${isDark ? "bg-zinc-900" : "bg-white"} ${rounded} p-2 flex flex-col gap-1.5`}>
      <div className={`h-1.5 w-8 rounded-full ${isDark ? "bg-zinc-700" : "bg-zinc-200"}`} />
      <div className={`h-1.5 w-12 rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`} />
      <div className="h-1.5 w-6 rounded-full bg-primary/70" />
    </div>
  );
  if (split) {
    return (
      <div className="flex h-full w-full">
        {pane(false, "rounded-l-md")}
        {pane(true, "rounded-r-md")}
      </div>
    );
  }
  return pane(!!dark, "rounded-md");
}

const OPTIONS: ThemeOption[] = [
  { id: "system", label: "System", Icon: Monitor, preview: <Mini split /> },
  { id: "default", label: "Light", Icon: Sun, preview: <Mini /> },
  { id: "dark", label: "Dark", Icon: Moon, preview: <Mini dark /> },
];

export default function PersonalizeSettings() {
  const { themeId, setTheme } = useContext(ThemeContext);

  return (
    <div>
      <SettingsHeader
        title="Personalize"
        description="Make HireTrail yours. Your theme is saved to this browser, per account."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl" role="radiogroup" aria-label="Theme">
        {OPTIONS.map((opt) => {
          const active = themeId === opt.id;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} theme`}
              onClick={() => setTheme(opt.id)}
              className={`relative rounded-xl border p-2 pb-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"
              }`}
            >
              {active && (
                <span className="absolute top-3 right-3 z-10 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <div className="h-24 rounded-md border border-border/60 overflow-hidden bg-muted/40">
                {opt.preview}
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 px-1">
                <Icon size={14} strokeWidth={1.8} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4 max-w-2xl leading-relaxed">
        System follows your operating system's appearance and switches automatically. The sun/moon
        button in the header always flips to an explicit Light or Dark choice.
      </p>
    </div>
  );
}
