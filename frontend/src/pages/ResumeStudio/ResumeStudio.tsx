/**
 * Resume Studio — the full-page shell for MANUAL tailoring (route /resume-studio):
 * pick a resume (?resume= or your primary) and paste a JD. The 3-step flow itself
 * lives in <StudioWizard> (shared with the Applications tailoring drawer).
 *
 * Application-driven tailoring happens in the drawer over the Applications page,
 * not here — this page is the manual entry point.
 */
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AlertCircle, ArrowRight, FileText, Sparkles } from "lucide-react";
import "./ResumeStudio.css";
import { useStudioDocument } from "./useStudioDocument.ts";
import StudioWizard from "./StudioWizard.tsx";
import { authAPI } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";
import PageHeader from "../../components/ui/PageHeader.tsx";

export default function ResumeStudio() {
  const [params] = useSearchParams();
  const queryResume = params.get("resume");
  // JD comes from the launch context (?jd= via a job/extension) or the user
  // pastes one — never a fake sample, so nobody analyzes against filler text.
  const initialJd = params.get("jd") || "";
  const { isDemo } = useDemoGate();

  // Resolve a REAL resume id: ?resume= → the user's primary resume → none.
  // (undefined = still resolving, null = the user has no resume to tailor yet.)
  const [resolvedId, setResolvedId] = useState<string | null | undefined>(queryResume || undefined);
  useEffect(() => {
    if (queryResume) { setResolvedId(queryResume); return; }
    let cancelled = false;
    authAPI.getMe()
      .then((me) => { if (!cancelled) setResolvedId(me.primaryResumeId || null); })
      .catch(() => { if (!cancelled) setResolvedId(null); });
    return () => { cancelled = true; };
  }, [queryResume]);

  const studio = useStudioDocument(typeof resolvedId === "string" ? resolvedId : "", initialJd);

  const header = <PageHeader title="Resume Studio" />;

  if (resolvedId === undefined || studio.loading) {
    return (
      <div>
        {header}
        <div className="max-w-2xl mx-auto pt-16 flex flex-col items-center text-center">
          <Sparkles size={28} strokeWidth={1.6} className="text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading Resume Studio…</p>
        </div>
      </div>
    );
  }

  if (resolvedId === null) {
    return (
      <div>
        {header}
        <div className="max-w-lg mx-auto pt-16 flex flex-col items-center text-center">
          <FileText size={28} strokeWidth={1.5} className="text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground">Pick a resume to tailor</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
            Resume Studio tailors one of your resumes to a job. Open it from a resume in Resumes, or set a primary resume there first.
          </p>
          <Link to="/resumes" className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg">
            Go to Resumes <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {header}

      {/* Tracked-variant note */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 mb-5 text-xs text-muted-foreground">
        <FileText size={14} strokeWidth={1.8} className="text-primary shrink-0" />
        <span>
          Edits save automatically as a <strong className="text-foreground font-medium">tracked variant</strong> — it appears under{" "}
          <Link to="/resumes" className="text-primary hover:underline">Tailored variants</Link> in Resumes, with its own response metrics.
        </span>
        {isDemo && (
          <span className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertCircle size={13} /> Demo — AI edits prompt sign-up
          </span>
        )}
      </div>

      <StudioWizard studio={studio} initialStep="gap" />
    </div>
  );
}
