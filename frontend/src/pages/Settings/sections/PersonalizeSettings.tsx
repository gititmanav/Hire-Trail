/** Settings → Personalize: how HireTrail looks (System / Light / Dark / a
 *  Custom theme built from three inputs) and how the Applications list reads
 *  (Classic | Table). */
import { CSSProperties, KeyboardEvent, ReactNode, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Check, ClipboardPaste, Copy, Monitor, Moon, Palette, RotateCcw, Sun, type LucideIcon } from "lucide-react";
import { ThemeContext, ThemeControlsContext } from "../../../hooks/useTheme.tsx";
import { useListDesign } from "../../../hooks/useListDesign.ts";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import type { CustomTheme, ListDesign, ThemeMode } from "../../../utils/preferences.ts";
import { hexToLch, lchToHex, seedCustomTheme, themeFromClipboard, themeToClipboard } from "../../../utils/theme.ts";
import { generated } from "../../../utils/themeDom.ts";
import { toastWithUndo } from "../../../utils/undoToast.tsx";
import ColorPicker, { normalizeHex } from "../../../components/ui/ColorPicker.tsx";
import Slider from "../../../components/ui/Slider.tsx";
import Button from "../../../components/ui/Button.tsx";
import { Input, Textarea } from "../../../components/ui/Field.tsx";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../../components/ui/Modal.tsx";
import { SettingsCard, SettingsHeader, SettingsRow, SettingsSection } from "../ui.tsx";
import { ACCENT_SWATCHES, BACKGROUND_SWATCHES } from "../../../utils/themeSwatches.ts";

/* ─── A radio group of cards (arrow keys move the choice, like native radios) ─── */

function ChoiceGroup<T extends string>({ label, value, options, onChange, className, children }: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  className: string;
  children: (option: T, selected: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(options.indexOf(value) + step + options.length) % options.length];
    onChange(next);
    ref.current?.querySelector<HTMLElement>(`[data-choice="${next}"]`)?.focus();
  };
  return (
    <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={className}>
      {options.map((o) => children(o, o === value))}
    </div>
  );
}

function ChoiceCard({ value, selected, onSelect, label, children }: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-choice={value}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`relative rounded-xl border bg-card p-3 text-left shadow-panel transition-[border-color,box-shadow] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40"
      }`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center" aria-hidden>
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

/* ─── Theme ─── */

/** A miniature of the shell — backdrop, the main card, an accent dot. Presets
 *  paint with their real tokens (App.css `.theme-light/.theme-dark`); Custom
 *  with its generated ones. */
function ShellPreview({ scope, style }: { scope?: "theme-light" | "theme-dark"; style?: CSSProperties }) {
  return (
    <div className={`${scope ?? ""} flex-1 flex bg-sidebar`} style={style}>
      <div className="w-[26%]" />
      <div className="relative flex-1 my-1.5 mr-1.5 rounded-md bg-background border border-border">
        <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
      </div>
    </div>
  );
}

function customPreviewStyle(custom: CustomTheme): CSSProperties {
  const t = generated(custom).tokens;
  return Object.fromEntries(["--sidebar", "--background", "--border", "--primary"].map((k) => [k, t[k]])) as CSSProperties;
}

const THEME_OPTIONS: readonly ThemeMode[] = ["system", "light", "dark", "custom"];
const THEME_META: Record<ThemeMode, { label: string; Icon: LucideIcon }> = {
  system: { label: "System", Icon: Monitor },
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  custom: { label: "Custom", Icon: Palette },
};

/** Hex text beside a picker — commits on Enter or blur, reverts if invalid. */
function HexField({ value, onCommit, label }: { value: string; onCommit: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value.toUpperCase());
  useEffect(() => setText(value.toUpperCase()), [value]);
  const commit = () => {
    const hex = normalizeHex(text);
    if (hex && hex !== value.toLowerCase()) onCommit(hex);
    else setText(value.toUpperCase());
  };
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value.toUpperCase())}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      spellCheck={false}
      maxLength={7}
      aria-label={label}
      className="!h-8 !w-[6.5rem] font-mono text-xs tracking-wide"
    />
  );
}

/** The three inputs. Dragging paints a live preview on the whole app (without
 *  re-rendering it); letting go keeps the value. `draft` mirrors the live
 *  value on this page. */
function CustomControls({ custom, onPreview, onCommit, onReset }: {
  custom: CustomTheme;
  onPreview: (c: CustomTheme) => void;
  onCommit: (c: CustomTheme) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(custom);
  useEffect(() => setDraft(custom), [custom]);
  const live = (c: CustomTheme) => { setDraft(c); onPreview(c); };
  const keep = (c: CustomTheme) => { setDraft(c); onCommit(c); };

  const accentHex = lchToHex(draft.accent);
  const baseHex = lchToHex(draft.base);
  const { fullContrast } = generated(draft);

  return (
    <SettingsCard>
      <SettingsRow title="Accent" description="Buttons, links, focus rings and the active page in the sidebar.">
        <div className="flex items-center gap-2">
          <HexField value={accentHex} label="Accent colour, hex" onCommit={(h) => keep({ ...draft, accent: hexToLch(h) })} />
          <ColorPicker
            label="Accent colour"
            value={accentHex}
            swatches={ACCENT_SWATCHES}
            onChange={(h) => live({ ...draft, accent: hexToLch(h) })}
            onCommit={(h) => keep({ ...draft, accent: hexToLch(h) })}
          />
        </div>
      </SettingsRow>
      <SettingsRow
        title="Background"
        description={fullContrast
          ? "Becomes every surface. A light background gets dark text, a dark one light text."
          : "A mid-tone: text stays readable but can't reach full contrast here, so the layers sit flatter. A lighter or darker shade brings both back."}
      >
        <div className="flex items-center gap-2">
          <HexField value={baseHex} label="Background colour, hex" onCommit={(h) => keep({ ...draft, base: hexToLch(h) })} />
          <ColorPicker
            label="Background colour"
            value={baseHex}
            swatches={BACKGROUND_SWATCHES}
            onChange={(h) => live({ ...draft, base: hexToLch(h) })}
            onCommit={(h) => keep({ ...draft, base: hexToLch(h) })}
          />
        </div>
      </SettingsRow>
      <SettingsRow title="Contrast" description="How far surfaces and text separate.">
        <div className="flex items-center gap-3 w-full sm:w-56">
          <Slider
            className="flex-1"
            label="Contrast"
            value={Math.round(draft.contrast)}
            onChange={(n) => live({ ...draft, contrast: n })}
            onCommit={(n) => keep({ ...draft, contrast: n })}
          />
          <span className="w-7 text-right text-sm tabular-nums text-muted-foreground">{Math.round(draft.contrast)}</span>
        </div>
      </SettingsRow>
      <SettingsRow title="Start over" description="Back to HireTrail's own colours, on the same light or dark side.">
        <Button size="sm" onClick={onReset}><RotateCcw size={14} strokeWidth={1.8} aria-hidden />Reset</Button>
      </SettingsRow>
    </SettingsCard>
  );
}

function ImportThemeModal({ onClose, onApply }: { onClose: () => void; onApply: (c: CustomTheme) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const apply = () => {
    const parsed = themeFromClipboard(text);
    if (!parsed) { setError(true); return; }
    onApply(parsed);
    onClose();
  };
  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Import a theme" description="Paste a theme someone shared — what Copy theme produces (Linear's format works too)." onClose={onClose} />
      <ModalBody>
        <Textarea
          data-autofocus
          rows={3}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) apply(); }}
          placeholder='{"base":[97,4,85],"accent":[52,62,268],"contrast":30}'
          aria-invalid={error}
          aria-label="Theme"
          className={`font-mono text-xs ${error ? "!border-destructive" : ""}`}
        />
        {error && <p className="text-xs text-destructive mt-1.5">That isn't a theme — it needs a base, an accent and a contrast.</p>}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!text.trim()} onClick={apply}>Apply theme</Button>
      </ModalFooter>
    </Modal>
  );
}

/* ─── Applications list ─── */

function ClassicPreview() {
  return (
    <div className="h-full flex flex-col gap-1.5 p-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex-1 flex items-center gap-1.5 px-2 rounded-md bg-card border border-border">
          <span className="w-3 h-3 rounded bg-muted-foreground/25 shrink-0" />
          <span className="h-1.5 rounded-full bg-muted-foreground/30" style={{ width: `${38 - i * 6}%` }} />
          <span className="ml-auto h-2.5 w-7 rounded-full bg-primary/20" />
        </div>
      ))}
    </div>
  );
}

function TablePreview() {
  return (
    <div className="h-full flex flex-col p-2.5">
      <div className="h-3.5 rounded-sm bg-sidebar border-y border-border/60 flex items-center gap-1 px-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="h-1 w-8 rounded-full bg-muted-foreground/40" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex-1 flex items-center gap-2 px-1.5">
          <span className="h-1.5 rounded-full bg-muted-foreground/30" style={{ width: `${30 - (i % 2) * 6}%` }} />
          <span className="h-2 w-6 rounded-full bg-primary/20" />
          <span className="h-1.5 w-5 rounded-full bg-muted-foreground/20" />
          <span className="ml-auto h-1.5 w-8 rounded-full bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

const LIST_OPTIONS: readonly ListDesign[] = ["classic", "table"];
const LIST_META: Record<ListDesign, { label: string; description: string; preview: ReactNode }> = {
  classic: { label: "Classic", description: "Roomy cards with every detail at a glance, a page at a time.", preview: <ClassicPreview /> },
  table: { label: "Table", description: "One row per application, grouped by stage — columns fill your screen.", preview: <TablePreview /> },
};

/* ─── Page ─── */

export default function PersonalizeSettings() {
  const controls = useContext(ThemeControlsContext);
  const { dark } = useContext(ThemeContext);
  const [listDesign, setListDesign] = useListDesign();
  const { isDemo } = useDemoGate();
  const [importing, setImporting] = useState(false);

  // An uncommitted preview never outlives the page.
  const cancelPreview = controls?.cancelPreview;
  useEffect(() => () => cancelPreview?.(), [cancelPreview]);

  if (!controls) return null;
  const { prefs, setMode, preview, setCustom } = controls;
  const custom = prefs.custom ?? seedCustomTheme(dark);
  const savedWhere = isDemo ? "Saved on this device." : "Saved to your account, so it follows you to every device.";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(themeToClipboard(custom));
      toast.success("Theme copied");
    } catch {
      toast.error("Couldn't reach the clipboard");
    }
  };
  const reset = () => {
    const before = custom;
    setCustom(seedCustomTheme(generated(custom).isDark));
    toastWithUndo("Theme reset", () => setCustom(before));
  };
  const imported = (c: CustomTheme) => {
    const before = prefs;
    setCustom(c);
    toastWithUndo("Theme applied", () => (before.mode === "custom" && before.custom ? setCustom(before.custom) : setMode(before.mode)));
  };

  return (
    <div>
      <SettingsHeader title="Personalize" description="Make HireTrail yours — how it looks and how your applications read." />

      <SettingsSection
        title="Theme"
        description={`System follows your operating system. Custom builds a theme from three colors, with every text color checked for contrast. ${savedWhere}`}
      >
        <ChoiceGroup label="Theme" value={prefs.mode} options={THEME_OPTIONS} onChange={setMode} className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          {(option, selected) => {
            const meta = THEME_META[option];
            return (
              <ChoiceCard key={option} value={option} selected={selected} onSelect={() => setMode(option)} label={`${meta.label} theme`}>
                <div className="h-16 flex rounded-lg overflow-hidden ring-1 ring-inset ring-border">
                  {option === "system" && <><ShellPreview scope="theme-light" /><ShellPreview scope="theme-dark" /></>}
                  {option === "light" && <ShellPreview scope="theme-light" />}
                  {option === "dark" && <ShellPreview scope="theme-dark" />}
                  {option === "custom" && <ShellPreview style={customPreviewStyle(custom)} />}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2.5">
                  <meta.Icon size={14} strokeWidth={1.8} className="text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium text-foreground">{meta.label}</span>
                </div>
              </ChoiceCard>
            );
          }}
        </ChoiceGroup>
      </SettingsSection>

      {prefs.mode === "custom" && (
        <SettingsSection title="Custom theme" description="Drag to try colors on the whole app; letting go keeps them.">
          <div className="max-w-3xl space-y-3">
            <CustomControls custom={custom} onPreview={preview} onCommit={setCustom} onReset={reset} />
            <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Share</p>
                <p className="text-xs text-muted-foreground mt-1">Copy your theme, or paste one someone shared.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setImporting(true)}><ClipboardPaste size={14} strokeWidth={1.8} aria-hidden />Import</Button>
                <Button size="sm" onClick={copy}><Copy size={14} strokeWidth={1.8} aria-hidden />Copy theme</Button>
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        title="Applications list"
        description={`How the List view shows your applications. ${savedWhere}`}
      >
        <ChoiceGroup label="Applications list style" value={listDesign} options={LIST_OPTIONS} onChange={setListDesign} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          {(option, selected) => {
            const meta = LIST_META[option];
            return (
              <ChoiceCard key={option} value={option} selected={selected} onSelect={() => setListDesign(option)} label={`${meta.label} list`}>
                <div className="h-24 rounded-lg bg-background ring-1 ring-inset ring-border overflow-hidden">{meta.preview}</div>
                <p className="text-sm font-medium text-foreground mt-3">{meta.label}</p>
                <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed pr-6">{meta.description}</p>
              </ChoiceCard>
            );
          }}
        </ChoiceGroup>
      </SettingsSection>

      {importing && <ImportThemeModal onClose={() => setImporting(false)} onApply={imported} />}
    </div>
  );
}
