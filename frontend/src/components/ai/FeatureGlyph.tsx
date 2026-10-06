/** The icon on a feature's map node — named by the backend registry
 *  (services/ai/registry.ts `icon`), mapped here. A feature added without an
 *  entry falls back to the AI sparkle, which reads as "AI", not as broken. */
import { FileSearch, FileUp, GitMerge, Mail, Sparkles, Target, Wand2, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { FileSearch, Target, FileUp, GitMerge, Wand2, Mail };

export default function FeatureGlyph({ icon, size = 18, className = "" }: { icon: string; size?: number; className?: string }) {
  const Icon = ICONS[icon] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.8} aria-hidden className={className} />;
}
