/** Main-column sections of the application page. */
import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { tailorAPI } from "../../../utils/api.ts";
import Button from "../../../components/ui/Button.tsx";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ─── Job description ─── */

const COLLAPSED_PX = 280;

export function JobDescriptionSection({ text, loading, onAdd }: { text?: string; loading: boolean; onAdd: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) setOverflows(el.scrollHeight > COLLAPSED_PX + 40);
  }, [text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? "");
      setCopied(true);
      toast.success("Job description copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  if (loading) {
    return (
      <Section title="Job description">
        <div className="space-y-2" aria-hidden>
          {[92, 88, 95, 70, 84].map((w, i) => <div key={i} className="h-3.5 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />)}
        </div>
      </Section>
    );
  }

  if (!text?.trim()) {
    return (
      <Section title="Job description">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[13.5px] text-muted-foreground max-w-md">No description saved. Paste it in to unlock fit analysis and tailoring.</p>
          <Button size="sm" onClick={onAdd}>Add description</Button>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Job description"
      action={
        <button
          type="button"
          onClick={copy}
          aria-label="Copy job description"
          className="h-7 px-2 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check size={13} strokeWidth={2.2} className="text-emerald-600" aria-hidden /> : <Copy size={13} strokeWidth={1.8} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      }
    >
      <div className="relative">
        <div
          ref={bodyRef}
          style={!expanded && overflows ? { maxHeight: COLLAPSED_PX } : undefined}
          className="text-[14px] leading-[1.65] text-foreground/90 whitespace-pre-wrap break-words max-w-[72ch] overflow-hidden"
        >
          {text}
        </div>
        {!expanded && overflows && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" aria-hidden />
        )}
      </div>
      {overflows && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[12.5px] font-medium text-primary hover:underline underline-offset-2">
          {expanded ? "Show less" : "Show full description"}
        </button>
      )}
    </Section>
  );
}

/* ─── Notes ─── */

export function NotesSection({ notes, onEdit }: { notes: string; onEdit: () => void }) {
  return (
    <Section title="Notes" action={<button type="button" onClick={onEdit} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">Edit</button>}>
      {notes.trim()
        ? <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words max-w-[72ch]">{notes}</p>
        : <p className="text-[13.5px] text-muted-foreground">No notes yet — referrals, recruiter names, prep topics.</p>}
    </Section>
  );
}

/* ─── Tailoring history ─── */

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  succeeded: { label: "Done", cls: "text-emerald-700 dark:text-emerald-300" },
  processing: { label: "Analyzing", cls: "text-primary" },
  deferred: { label: "Waiting", cls: "text-amber-700 dark:text-amber-300" },
  failed: { label: "Failed", cls: "text-red-600 dark:text-red-400" },
};

export function TailoringHistorySection({ applicationId, onOpen }: { applicationId: string; onOpen: () => void }) {
  const { data: sessions, isPending, isError } = useQuery({
    queryKey: ["tailor-sessions", "application", applicationId],
    queryFn: () => tailorAPI.listForApplication(applicationId),
  });
  if (isPending || isError || !sessions || sessions.length === 0) return null;
  return (
    <Section title="Tailoring history">
      <ul className="divide-y divide-border">
        {sessions.map((s) => {
          const st = STATUS_LABEL[s.status] ?? { label: s.status, cls: "text-muted-foreground" };
          return (
            <li key={s._id}>
              <button type="button" onClick={onOpen} className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors">
                <span className="min-w-0">
                  <span className="text-[13px] text-foreground truncate block">{s.jobTitle || "Analysis"}</span>
                  {s.status === "failed" && s.errorMessage && <span className="text-[12px] text-muted-foreground truncate block">{s.errorMessage}</span>}
                </span>
                <span className="shrink-0 flex items-center gap-3 text-[12px] tabular-nums">
                  {s.fitGrade && <span className="font-semibold text-foreground">{s.fitGrade} · {s.fitScore}/5</span>}
                  <span className={st.cls}>{st.label}</span>
                  <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
