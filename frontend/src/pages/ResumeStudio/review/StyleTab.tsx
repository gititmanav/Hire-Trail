/**
 * Style tab — formatting controls over the shared document's `style`. Every
 * change re-renders the live preview (and therefore the PDF) instantly.
 *
 * Includes the OPTIONAL "fit to one page" density toggle: it scales spacing +
 * font sizes down via a multiplier and NEVER deletes content.
 */
import { Check, ChevronDown } from "lucide-react";
import ActionDropdown from "../../../components/ActionDropdown/ActionDropdown.tsx";
import type { StudioController } from "../useStudioDocument.ts";
import type {
  ResumeStyle, TemplateId, HeaderAlignment, EducationOrder, SkillsLayout,
} from "../../../utils/resumeDocument.ts";

const FONTS = [
  { label: "Inter (sans)", value: "Inter, system-ui, sans-serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Helvetica (sans)", value: "Helvetica, Arial, sans-serif" },
  { label: "Source Serif", value: "'Source Serif 4', Georgia, serif" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', system-ui, sans-serif" },
];
const DATE_FORMATS = [
  { label: "Jan 2023", value: "MMM yyyy" },
  { label: "January 2023", value: "MMMM yyyy" },
  { label: "01/2023", value: "MM/yyyy" },
  { label: "2023", value: "yyyy" },
];
const BULLET_ICONS = ["•", "–", "‣", "▸", "◦", "—", "·"];
const ACCENT_SWATCHES = ["#2563eb", "#0f766e", "#7c3aed", "#b91c1c", "#c2410c", "#0891b2", "#1e293b"];

export default function StyleTab({ studio }: { studio: StudioController }) {
  const { doc, patchStyle, density, setDensity } = studio;
  if (!doc) return null;
  const st = doc.style;
  const set = <K extends keyof ResumeStyle>(k: K, v: ResumeStyle[K]) => patchStyle((s) => { s[k] = v; });

  return (
    <div className="space-y-4">
      {/* Template */}
      <Panel title="Template">
        <Segmented<TemplateId>
          value={st.template}
          options={[{ v: "standard", l: "Standard" }, { v: "compact", l: "Compact" }, { v: "centered", l: "Centered" }]}
          onChange={(v) => set("template", v)}
        />
      </Panel>

      {/* Accent + font */}
      <Panel title="Brand">
        <Row label="Accent color">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => set("accentColor", c)}
                  className={`w-6 h-6 rounded-full border-2 ${st.accentColor.toLowerCase() === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                  aria-label={`Accent ${c}`}
                />
              ))}
            </div>
            <input type="color" value={st.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="w-8 h-8 rounded-md border border-border bg-transparent cursor-pointer" aria-label="Custom accent color" />
          </div>
        </Row>
        <Row label="Font family">
          <Dropdown
            value={FONTS.find((f) => f.value === st.fontFamily)?.label ?? "Custom"}
            options={FONTS.map((f) => ({ label: f.label, active: f.value === st.fontFamily, onClick: () => set("fontFamily", f.value) }))}
          />
        </Row>
      </Panel>

      {/* Font sizes */}
      <Panel title="Font sizes">
        <Slider label="Name" min={16} max={36} step={0.5} value={st.fontSizes.name} suffix="pt" onChange={(v) => patchStyle((s) => { s.fontSizes.name = v; })} />
        <Slider label="Section header" min={9} max={18} step={0.5} value={st.fontSizes.sectionHeader} suffix="pt" onChange={(v) => patchStyle((s) => { s.fontSizes.sectionHeader = v; })} />
        <Slider label="Subheader" min={9} max={16} step={0.5} value={st.fontSizes.subHeader} suffix="pt" onChange={(v) => patchStyle((s) => { s.fontSizes.subHeader = v; })} />
        <Slider label="Body" min={8} max={13} step={0.25} value={st.fontSizes.body} suffix="pt" onChange={(v) => patchStyle((s) => { s.fontSizes.body = v; })} />
      </Panel>

      {/* Spacing */}
      <Panel title="Spacing">
        <Slider label="Between sections" min={6} max={32} step={1} value={st.spacing.section} suffix="px" onChange={(v) => patchStyle((s) => { s.spacing.section = v; })} />
        <Slider label="Between entries" min={4} max={24} step={1} value={st.spacing.entry} suffix="px" onChange={(v) => patchStyle((s) => { s.spacing.entry = v; })} />
        <Slider label="Line height" min={1} max={2} step={0.05} value={st.spacing.line} suffix="" onChange={(v) => patchStyle((s) => { s.spacing.line = v; })} />
      </Panel>

      {/* Margins */}
      <Panel title="Margins">
        <Slider label="Top / bottom" min={16} max={72} step={2} value={st.margins.topBottom} suffix="px" onChange={(v) => patchStyle((s) => { s.margins.topBottom = v; })} />
        <Slider label="Sides" min={16} max={80} step={2} value={st.margins.sides} suffix="px" onChange={(v) => patchStyle((s) => { s.margins.sides = v; })} />
      </Panel>

      {/* Layout */}
      <Panel title="Layout">
        <Row label="Header alignment">
          <Segmented<HeaderAlignment>
            value={st.headerAlignment}
            options={[{ v: "left", l: "Left" }, { v: "center", l: "Center" }, { v: "right", l: "Right" }]}
            onChange={(v) => set("headerAlignment", v)}
          />
        </Row>
        <Row label="Date format">
          <Dropdown
            value={DATE_FORMATS.find((f) => f.value === st.dateFormat)?.label ?? st.dateFormat}
            options={DATE_FORMATS.map((f) => ({ label: f.label, active: f.value === st.dateFormat, onClick: () => set("dateFormat", f.value) }))}
          />
        </Row>
        <Row label="Bullet icon">
          <div className="flex items-center gap-1.5">
            {BULLET_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => set("bulletIcon", ic)}
                className={`w-8 h-8 rounded-md border text-base ${st.bulletIcon === ic ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted"}`}
                aria-label={`Bullet ${ic}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Education order">
          <Segmented<EducationOrder>
            value={st.educationOrder}
            options={[{ v: "degree", l: "Degree first" }, { v: "institution", l: "Institution first" }]}
            onChange={(v) => set("educationOrder", v)}
          />
        </Row>
        <Row label="Skills layout">
          <Segmented<SkillsLayout>
            value={st.skillsLayout}
            options={[{ v: "inline", l: "Inline" }, { v: "grouped", l: "Grouped" }, { v: "columns", l: "Columns" }]}
            onChange={(v) => set("skillsLayout", v)}
          />
        </Row>
        <Row label="Justify body text">
          <Toggle checked={st.justifyText} onChange={(v) => set("justifyText", v)} />
        </Row>
      </Panel>

      {/* Fit to one page (preview-only density, never deletes content) */}
      <Panel title="Density">
        <Row label="Fit to one page">
          <Toggle checked={density < 1} onChange={(v) => setDensity(v ? 0.88 : 1)} />
        </Row>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Tightens spacing and font sizes to help everything fit — content is never removed.
        </p>
      </Panel>
    </div>
  );
}

/* ---------- small controls ---------- */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, min, max, step, value, suffix, onChange }: { label: string; min: number; max: number; step: number; value: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}

function Dropdown({ value, options }: { value: string; options: { label: string; active: boolean; onClick: () => void }[] }) {
  return (
    <ActionDropdown
      align="right"
      menuWidth="w-48"
      trigger={
        <button className="inline-flex items-center justify-between gap-2 min-w-[150px] rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground hover:border-muted-foreground/40">
          <span className="truncate">{value}</span>
          <ChevronDown size={15} className="text-muted-foreground shrink-0" />
        </button>
      }
      items={options.map((o) => ({
        label: o.label,
        icon: <Check size={14} className={o.active ? "text-primary" : "opacity-0"} />,
        onClick: o.onClick,
      }))}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="w-11 h-6 bg-muted border border-border rounded-full peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}
