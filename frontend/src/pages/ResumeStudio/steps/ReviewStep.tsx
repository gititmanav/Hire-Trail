/** Step 3 — "Review". Three tabs (AI Rewrite · Editor · Style) all operate on
 *  ONE shared ResumeDocument; the live preview on the right reflects every edit
 *  immediately and is the exact print template Download serializes. */
import { useState } from "react";
import { FileEdit, Palette, Sparkles } from "lucide-react";
import ResumeDocumentPreview from "../preview/ResumeDocumentPreview.tsx";
import AIRewriteTab from "../review/AIRewriteTab.tsx";
import EditorTab from "../review/EditorTab.tsx";
import StyleTab from "../review/StyleTab.tsx";
import type { StudioController } from "../useStudioDocument.ts";
import type { RewriteScope } from "../../../utils/resumeDocument.ts";

type Tab = "ai" | "editor" | "style";

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "ai", label: "AI Rewrite", icon: Sparkles },
  { id: "editor", label: "Editor", icon: FileEdit },
  { id: "style", label: "Style", icon: Palette },
];

export default function ReviewStep({
  studio, previewRef, seedInstruction,
}: {
  studio: StudioController;
  previewRef: React.Ref<HTMLDivElement>;
  seedInstruction: string;
}) {
  const [tab, setTab] = useState<Tab>("ai");

  const onSelectTarget = (scope: RewriteScope, label: string) => {
    studio.setTarget(scope, label);
    setTab("ai"); // jump to the AI tab so the instruction box is in view
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-5 items-start">
      {/* Left: controls */}
      <div className="min-w-0">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 mb-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon size={14} strokeWidth={2} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "ai" && <AIRewriteTab studio={studio} seedInstruction={seedInstruction} />}
        {tab === "editor" && <EditorTab studio={studio} />}
        {tab === "style" && <StyleTab studio={studio} />}
      </div>

      {/* Right: live preview = print template */}
      <div className="lg:sticky lg:top-4 min-w-0">
        <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-5 overflow-auto" style={{ maxHeight: "calc(100vh - 7rem)" }}>
          <div className="mx-auto bg-white shadow-sm" style={{ width: 720, maxWidth: "100%" }}>
            {studio.doc && (
              <ResumeDocumentPreview
                ref={previewRef}
                doc={studio.doc}
                density={studio.density}
                changedPaths={studio.changedPaths}
                activeTargetKey={studio.activeTargetKey}
                onSelectTarget={onSelectTarget}
              />
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          This is exactly what your downloaded PDF will look like. Hover any section to edit it with AI.
        </p>
      </div>
    </div>
  );
}
