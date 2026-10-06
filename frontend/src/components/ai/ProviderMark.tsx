/** A provider's mark in a tile — the one place a provider is drawn, so the
 *  official SVG marks can replace the monograms here without touching any
 *  caller. Marks identify the service (the ordinary use every integrations
 *  page makes of them); they're never recoloured or combined with ours. */
import type { AiProviderId } from "../../utils/aiApi.ts";
import { providerColor, providerMonogram } from "./providerStyle.ts";

export default function ProviderMark({ provider, size = 28, className = "" }: {
  provider: AiProviderId;
  /** Tile edge in px. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center shrink-0 font-semibold leading-none select-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: providerColor(provider, 0.12),
        color: providerColor(provider),
        boxShadow: `inset 0 0 0 1px ${providerColor(provider, 0.22)}`,
        fontSize: Math.round(size * 0.46),
      }}
    >
      {providerMonogram(provider)}
    </span>
  );
}
