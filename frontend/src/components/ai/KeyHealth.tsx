/** A key's health in one line: its last problem in the provider's words, or
 *  when it was last seen working. */
import { AlertTriangle } from "lucide-react";
import type { AiKey } from "../../utils/aiApi.ts";
import { sinceLabel } from "./format.ts";

export default function KeyHealth({ k, className = "" }: { k: Pick<AiKey, "lastError" | "lastCheckedAt">; className?: string }) {
  if (k.lastError) {
    return (
      <p className={`flex items-start gap-1.5 text-[12px] leading-snug text-red-600 dark:text-red-400 ${className}`}>
        <AlertTriangle size={12} strokeWidth={2} className="mt-[2px] shrink-0" aria-hidden />
        {k.lastError}
      </p>
    );
  }
  const when = sinceLabel(k.lastCheckedAt);
  return (
    <p className={`text-[12px] text-muted-foreground ${className}`}>
      {when ? `Working · checked ${when}` : "Not checked yet — it's checked on first use."}
    </p>
  );
}
