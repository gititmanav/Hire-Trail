/** Decodes the map's visual channels — only the ones actually on screen. */
import type { AiProviderId } from "../../utils/aiApi.ts";
import ProviderMark from "./ProviderMark.tsx";
import { providerColor } from "./providerStyle.ts";

export default function MapLegend({ providers, dashed, flowing, hint }: {
  providers: { id: AiProviderId; label: string }[];
  /** A still dash is on screen ("via your default key"). */
  dashed?: string | null;
  flowing?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
      {providers.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5">
          <ProviderMark provider={p.id} size={16} />
          <span className="h-0.5 w-4 rounded-full" style={{ background: providerColor(p.id) }} aria-hidden />
          {p.label}
        </span>
      ))}
      {dashed && (
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /></svg>
          {dashed}
        </span>
      )}
      {flowing && (
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden><line className="ai-edge-pulse" x1="1" y1="3" x2="21" y2="3" stroke="currentColor" strokeWidth="2" /></svg>
          used in the last day
        </span>
      )}
      <span>thicker = busier this week</span>
      {hint && <span className="text-muted-foreground/70">{hint}</span>}
    </div>
  );
}
