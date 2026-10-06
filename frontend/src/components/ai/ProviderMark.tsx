/** A provider's real mark on a neutral tile — the one place a provider is
 *  drawn, so every surface (the maps, keys, Admin) shows the same logo. */
import BrandTile from "../BrandLogo/BrandLogo.tsx";
import type { AiProviderId } from "../../utils/aiApi.ts";

export default function ProviderMark({ provider, size = 28, className = "" }: {
  provider: AiProviderId;
  /** Tile edge in px. */
  size?: number;
  className?: string;
}) {
  return <BrandTile brand={provider} size={size} className={className} />;
}
