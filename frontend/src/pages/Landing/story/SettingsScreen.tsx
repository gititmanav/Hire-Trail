/** The bridge out of the story: Settings → Personalize with its four theme
 *  cards (PersonalizeSettings' ChoiceCard + ShellPreview). The story selects
 *  Dark, the window turns dark, and the camera dives into the Dark card. */
import type { CSSProperties } from "react";
import { Check, Monitor, Moon, Palette, Sun, type LucideIcon } from "lucide-react";
import { SettingsShell } from "./shell.tsx";
import { generateTheme, hexToLch } from "../../../utils/theme.ts";

type Mode = "system" | "light" | "dark" | "custom";
const MODES: { mode: Mode; label: string; Icon: LucideIcon }[] = [
  { mode: "system", label: "System", Icon: Monitor },
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "custom", label: "Custom", Icon: Palette },
];

/** A Custom theme for the fourth card: warm paper with an orange accent. */
const CUSTOM_PREVIEW: CSSProperties = (() => {
  const t = generateTheme({ base: hexToLch("#f7f3ea"), accent: hexToLch("#f97316"), contrast: 30 }).tokens;
  return Object.fromEntries(["--sidebar", "--background", "--border", "--primary"].map((k) => [k, t[k]])) as CSSProperties;
})();

function ShellPreview({ scope, style, lp }: { scope?: string; style?: CSSProperties; lp?: string }) {
  return (
    <div data-lp={lp} className={`${scope ?? ""} flex-1 flex bg-sidebar`} style={style}>
      <div className="w-[26%]" />
      <div className="relative flex-1 my-1.5 mr-1.5 rounded-md bg-background border border-border">
        <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
      </div>
    </div>
  );
}

export default function SettingsScreen({ selected }: { selected: "light" | "dark" }) {
  return (
    <SettingsShell active="Personalize">
      <div className="px-10 py-10 max-w-[760px]">
        <h3 className="text-2xl font-semibold text-foreground">Personalize</h3>
        <p className="text-sm text-muted-foreground mt-1">How HireTrail looks, and how your lists read. Saved to your account.</p>

        <p className="mt-9 text-sm font-semibold text-foreground">Theme</p>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {MODES.map(({ mode, label, Icon }) => {
            const on = mode === selected;
            return (
              <div
                key={mode}
                className={`relative rounded-xl border bg-card p-3 shadow-panel ${on ? "border-primary ring-1 ring-primary" : "border-border"}`}
              >
                {on && (
                  <span className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <div className="h-[74px] rounded-lg overflow-hidden border border-border flex">
                  {mode === "system" ? (
                    <>
                      <ShellPreview scope="theme-light" />
                      <ShellPreview scope="theme-dark" />
                    </>
                  ) : mode === "custom" ? (
                    <ShellPreview style={CUSTOM_PREVIEW} />
                  ) : (
                    <ShellPreview scope={mode === "light" ? "theme-light" : "theme-dark"} lp={mode === "dark" && selected === "dark" ? "zoom-target" : undefined} />
                  )}
                </div>
                <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <Icon size={14} strokeWidth={1.8} className="text-muted-foreground" /> {label}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-9 text-sm font-semibold text-foreground">Applications list</p>
        <div className="mt-3 grid grid-cols-2 gap-3 max-w-[420px]">
          {["Classic", "Table"].map((name, i) => (
            <div key={name} className={`rounded-xl border bg-card p-3 shadow-panel ${i === 0 ? "border-primary ring-1 ring-primary" : "border-border"}`}>
              <div className="h-[58px] rounded-lg border border-border bg-background p-2 space-y-1.5">
                {[0, 1, 2].map((r) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-control" />
                    <span className="h-1.5 rounded-full bg-control" style={{ width: i === 0 ? `${62 - r * 12}%` : "30%" }} />
                    {i === 1 && <span className="h-1.5 rounded-full bg-control w-[22%] ml-auto" />}
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[13px] font-medium text-foreground">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </SettingsShell>
  );
}
