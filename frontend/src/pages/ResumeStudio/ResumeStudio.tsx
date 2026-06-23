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
import { AlertCircle, ArrowLeft, ArrowRight, FileText, Sparkles } from "lucide-react";
import "./ResumeStudio.css";
import { useStudioDocument } from "./useStudioDocument.ts";
import StudioWizard from "./StudioWizard.tsx";
import { authAPI } from "../../utils/api.ts";
import { useDemoGate } from "../../hooks/useDemoGate.tsx";

const DEFAULT_JD =
  "Senior Software Engineer — build and operate event-driven backend services. Requirements: TypeScript, GraphQL, Kubernetes, observability, Terraform, Postgres, strong testing and CI/CD practices, mentoring.";

export default function ResumeStudio() {
  const [params] = useSearchParams();
  const queryResume = params.get("resume");
  const initialJd = params.get("jd") || DEFAULT_JD;
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

  if (resolvedId === undefined || studio.loading) {
    return (
      <div className="max-w-2xl mx-auto pt-20 flex flex-col items-center text-center">
        <Sparkles size={28} strokeWidth={1.6} className="text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading Resume Studio…</p>
      </div>
    );
  }

  if (resolvedId === null) {
    return (
      <div className="max-w-lg mx-auto pt-20 flex flex-col items-center text-center">
        <FileText size={28} strokeWidth={1.5} className="text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-foreground">Pick a resume to tailor</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
          Resume Studio tailors one of your resumes to a job. Open it from a resume in Documents, or set a primary resume there first.
        </p>
        <Link to="/resumes" className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">
          Go to Documents <ArrowRight size={15} strokeWidth={2} />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="min-w-0 mb-5">
        <Link to="/resumes" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft size={13} strokeWidth={2} /> Back to Documents
        </Link>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-primary text-white shadow-sm">
            <Sparkles size={18} strokeWidth={1.9} />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Resume Studio</h1>
        </div>
      </div>

      {/* Tracked-variant note */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 mb-5 text-xs text-muted-foreground">
        <FileText size={14} strokeWidth={1.8} className="text-primary shrink-0" />
        <span>
          Edits save automatically as a <strong className="text-foreground font-medium">tracked variant</strong> — it appears under{" "}
          <Link to="/resumes" className="text-primary hover:underline">Tailored variants</Link> in Documents, with its own response metrics.
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
