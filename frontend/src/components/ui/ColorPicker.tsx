/** Shared colour picker — any colour, not a preset list. A swatch button
 *  opens a Popover with a saturation/brightness square, a hue slider, a hex
 *  field, the system eyedropper (where the browser has one) and optional
 *  swatches. Replaces the native `<input type="color">`, whose popup is OS
 *  chrome and can't be themed.
 *
 *  `onChange` reports every move of a drag (paint a preview with it);
 *  `onCommit` reports the colour the user settled on (save that). HSV is the
 *  picker's own state while it's open, so the thumbs never jump on hex
 *  rounding. Keyboard: the square moves with the arrows (Shift = ×10), the
 *  hue slider like any slider. */
import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import Popover from "./Popover.tsx";
import Slider from "./Slider.tsx";
import { controlCls } from "./Field.tsx";

/* ─── hex ⇄ HSV ─── */

type Hsv = { h: number; s: number; v: number };

/** "#abc", "abc", "#aabbcc", "aabbcc" → "#aabbcc"; anything else → null. */
export function normalizeHex(raw: string): string | null {
  let h = raw.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((u) => Math.round((u + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Hue ramp for the slider track — colour-space data, not theme colours. */
const HUE_TRACK = "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperCtor | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

/** "#rrggbb" or "rgb(r, g, b)" (some browsers) → "#rrggbb". */
function fromEyeDropper(v: string): string | null {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
  return m ? `#${m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, "0")).join("")}` : normalizeHex(v);
}

interface Props {
  /** "#rrggbb". */
  value: string;
  onChange: (hex: string) => void;
  onCommit: (hex: string) => void;
  /** Names the trigger and the panel ("Accent colour"). */
  label: string;
  swatches?: readonly string[];
  align?: "start" | "end";
  /** Extra classes on the panel — e.g. a theme scope when the picker sits on
   *  a surface themed differently from the page (the panel portals to <body>). */
  popoverClassName?: string;
}

export default function ColorPicker({ value, onChange, onCommit, label, swatches, align = "end", popoverClassName = "" }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value.slice(1).toUpperCase());
  const dragging = useRef(false);
  const hex = hsvToHex(hsv);
  // Ahead of state: drags and fast key presses build on the latest colour.
  const latest = useRef(hex);
  const latestHsv = useRef(hsv);

  // Follow outside changes, but not our own echo (rounding would move the thumbs).
  useEffect(() => {
    if (value.toLowerCase() !== hsvToHex(latestHsv.current)) {
      latestHsv.current = hexToHsv(value);
      latest.current = value.toLowerCase();
      setHsv(latestHsv.current);
    }
    setHexText(value.slice(1).toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const move = (next: Hsv, commit: boolean) => {
    latestHsv.current = next;
    setHsv(next);
    const out = hsvToHex(next);
    latest.current = out;
    setHexText(out.slice(1).toUpperCase());
    onChange(out);
    if (commit) onCommit(out);
  };
  const choose = (h: string) => move(hexToHsv(h), true);

  /* Saturation × brightness square */
  const fromPointer = (e: PointerEvent<HTMLDivElement>): Hsv => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return { h: latestHsv.current.h, s, v };
  };
  const onSquareDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    move(fromPointer(e), false);
  };
  const onSquareMove = (e: PointerEvent<HTMLDivElement>) => { if (dragging.current) move(fromPointer(e), false); };
  const onSquareUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit(latest.current);
  };
  const onSquareKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = (e.shiftKey ? 10 : 1) / 100;
    const hsv = latestHsv.current;
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    const next =
      e.key === "ArrowRight" ? { ...hsv, s: clamp(hsv.s + d) }
      : e.key === "ArrowLeft" ? { ...hsv, s: clamp(hsv.s - d) }
      : e.key === "ArrowUp" ? { ...hsv, v: clamp(hsv.v + d) }
      : e.key === "ArrowDown" ? { ...hsv, v: clamp(hsv.v - d) }
      : null;
    if (!next) return;
    e.preventDefault();
    move(next, true);
  };

  const commitHexText = () => {
    const h = normalizeHex(hexText);
    if (h) { if (h !== hex) choose(h); else setHexText(h.slice(1).toUpperCase()); }
    else setHexText(hex.slice(1).toUpperCase());
  };

  const EyeDropper = eyeDropper();
  const pickFromScreen = async () => {
    if (!EyeDropper) return;
    try {
      const h = fromEyeDropper((await new EyeDropper().open()).sRGBHex);
      if (h) choose(h);
    } catch { /* dismissed with Escape */ }
  };

  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label}: ${value.toUpperCase()}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-8 h-8 shrink-0 rounded-lg border border-border shadow-sm transition-transform duration-150 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ background: value }}
      />
      <Popover open={open} onOpenChange={setOpen} anchorRef={triggerRef} align={align} width={248} ariaLabel={label} initialFocusRef={squareRef} className={`p-3 ${popoverClassName}`}>
        <div
          ref={squareRef}
          role="slider"
          tabIndex={0}
          aria-label={`${label}: saturation and brightness`}
          aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
          onPointerDown={onSquareDown}
          onPointerMove={onSquareMove}
          onPointerUp={onSquareUp}
          onPointerCancel={onSquareUp}
          onKeyDown={onSquareKey}
          className="relative h-36 w-full rounded-lg cursor-crosshair touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
          style={{ background: `linear-gradient(to top, hsl(var(--scrim)), transparent), linear-gradient(to right, hsl(var(--paper)), transparent), ${hueHex}` }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper shadow-[0_0_0_1px_hsl(var(--scrim)/0.35)]"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
          />
        </div>

        <Slider
          className="mt-3"
          value={Math.round(hsv.h)}
          min={0}
          max={359}
          label={`${label}: hue`}
          valueText={`${Math.round(hsv.h)}°`}
          trackStyle={{ background: HUE_TRACK, height: 10 }}
          thumbColor={hueHex}
          onChange={(h) => move({ ...latestHsv.current, h }, false)}
          onCommit={(h) => onCommit(hsvToHex({ ...latestHsv.current, h }))}
        />

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>#</span>
            <input
              value={hexText}
              onChange={(e) => setHexText(e.target.value.replace(/[^0-9a-f#]/gi, "").slice(0, 7).toUpperCase())}
              onBlur={commitHexText}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitHexText(); } }}
              spellCheck={false}
              aria-label={`${label}: hex value`}
              className={`${controlCls} h-8 pl-6 font-mono text-xs tracking-wide`}
            />
          </div>
          {EyeDropper && (
            <button
              type="button"
              onClick={pickFromScreen}
              aria-label="Pick a colour from the screen"
              title="Pick from the screen"
              className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-control transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pipette size={14} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {swatches && swatches.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5" role="group" aria-label={`${label}: suggestions`}>
            {swatches.map((s) => {
              const selected = s.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => choose(s)}
                  aria-label={s.toUpperCase()}
                  aria-pressed={selected}
                  className={`w-6 h-6 rounded-full border border-border transition-transform duration-150 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover ${
                    selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : ""
                  }`}
                  style={{ background: s }}
                />
              );
            })}
          </div>
        )}
      </Popover>
    </>
  );
}
