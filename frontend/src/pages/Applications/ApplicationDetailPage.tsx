/**
 * Application page — /applications/:id.
 *
 * The single home for one application: overview, AI fit, job description,
 * notes, tailoring history, and a properties rail (details, deadlines,
 * timeline). Replaces the detail sidebar, the AI-analysis slide-over and the
 * scattered entry points that split one application across three surfaces.
 *
 * Opens instantly from any list (the list's cached row paints first; the full
 * document streams in). Back returns to the exact view, filters and scroll;
 * J / K walk the list you came from without going back.
 */
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Archive, ArchiveRestore, ArrowLeft, ChevronDown, ChevronUp, Ellipsis, ExternalLink, Link2, Pencil, Sparkles, Trash2 } from "lucide-react";
import CompanyLogo from "../../components/CompanyLogo/CompanyLogo.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import PageHeader from "../../components/ui/PageHeader.tsx";
import Button from "../../components/ui/Button.tsx";
import Menu from "../../components/ui/Menu.tsx";
import Tooltip from "../../components/ui/Tooltip.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import { computeAppHealth } from "../../utils/applicationHealth.ts";
import { toastWithUndo } from "../../utils/undoToast.tsx";
import ApplicationFormModal from "./components/ApplicationFormModal.tsx";
import StageMenu from "./components/StageMenu.tsx";
import ApplicationTailorDrawer from "./ApplicationTailorDrawer.tsx";
import FitSection from "./detail/FitSection.tsx";
import DetailRail from "./detail/DetailRail.tsx";
import { JobDescriptionSection, NotesSection, TailoringHistorySection } from "./detail/ContentSections.tsx";
import { readDetailNav } from "./data/navigation.ts";
import { useApplication, useArchiveMutation, useCompanies, useDeleteMutation, useReanalyzeMutation } from "./data/queries.ts";
import { useMoveStage } from "./data/useMoveStage.ts";
import type { Resume } from "../../types";

function DetailSkeleton() {
  return (
    <div className="max-w-[1320px] mx-auto" aria-busy="true" aria-label="Loading application">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 space-y-2.5 pt-1">
          <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/4 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 mt-8">
        <div className="space-y-4">{[180, 320].map((h) => <div key={h} className="rounded-xl border border-border bg-card animate-pulse" style={{ height: h }} />)}</div>
        <div className="space-y-4">{[300, 140].map((h) => <div key={h} className="rounded-xl border border-border bg-card animate-pulse" style={{ height: h }} />)}</div>
      </div>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: app, isPending, isError, isPlaceholderData } = useApplication(id);
  const { data: companies = [] } = useCompanies();
  const moveStage = useMoveStage();
  const reanalyze = useReanalyzeMutation();
  const archive = useArchiveMutation();
  const remove = useDeleteMutation();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const [editing, setEditing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [preview, setPreview] = useState<Resume | null>(null);

  /* Where "Back" goes and what J/K walk: the list the user came from. */
  const nav = useMemo(() => readDetailNav(), []);
  const backTo = nav?.backTo ?? "/applications";
  const position = id && nav ? nav.ids.indexOf(id) : -1;
  const prevId = position > 0 ? nav!.ids[position - 1] : null;
  const nextId = position >= 0 && position < (nav?.ids.length ?? 0) - 1 ? nav!.ids[position + 1] : null;

  const goBack = () => {
    // Came from a list in this tab → real history back (instant, restores
    // scroll); otherwise (deep link, new tab) go to the remembered view.
    if ((location.state as { fromList?: boolean } | null)?.fromList && window.history.length > 1) navigate(-1);
    else navigate(backTo);
  };
  const goTo = (target: string | null) => {
    if (target) navigate(`/applications/${target}`, { replace: true, state: location.state });
  };

  usePageShortcuts({
    j: () => { if (!nextId) return false; goTo(nextId); },
    k: () => { if (!prevId) return false; goTo(prevId); },
    e: () => { if (!app) return false; setEditing(true); },
    Escape: () => goBack(),
  });

  if (isPending) return <DetailSkeleton />;
  if (isError || !app) {
    return (
      <div className="max-w-md mx-auto text-center py-24">
        <h1 className="text-lg font-semibold text-foreground">This application isn't here</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1.5">It may have been deleted, or the link is out of date.</p>
        <Link to="/applications" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium text-primary hover:underline underline-offset-2">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden /> Back to applications
        </Link>
      </div>
    );
  }

  const company = companies.find((c) => c._id === app.companyId) ?? companies.find((c) => c.name.toLowerCase() === app.company.toLowerCase());
  const health = computeAppHealth(app);
  const meta = [app.location, app.jobType, app.salary].map((v) => v?.trim()).filter(Boolean);

  const toggleArchive = () => {
    const toArchived = !app.archived;
    archive.mutate({ ids: [app._id], archived: toArchived }, {
      onSuccess: () => toastWithUndo(
        toArchived ? "Application archived" : "Application restored",
        () => archive.mutate({ ids: [app._id], archived: !toArchived }),
      ),
    });
  };
  const handleDelete = async () => {
    const ok = await confirm("This permanently deletes the application and its history.", { title: `Delete ${app.role}?`, confirmLabel: "Delete" });
    if (!ok) return;
    remove.mutate([app._id], {
      onSuccess: () => { toast.success("Application deleted"); navigate(backTo, { replace: true }); },
    });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/applications/${app._id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto">
      <PageHeader
        titleAs="div"
        title={
          <span className="inline-flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <ArrowLeft size={15} strokeWidth={2} aria-hidden />
              Applications
            </button>
            <span className="text-muted-foreground/50" aria-hidden>/</span>
            <span className="truncate">{app.company}</span>
          </span>
        }
        actions={
          <>
            {position >= 0 && (
              <div className="flex items-center gap-0.5 mr-1">
                <span className="text-[12.5px] text-muted-foreground tabular-nums mr-1.5">{position + 1} of {nav!.ids.length}</span>
                <Tooltip label="Previous" shortcut="K">
                  <button type="button" onClick={() => goTo(prevId)} disabled={!prevId} aria-label="Previous application"
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronUp size={15} strokeWidth={2} aria-hidden />
                  </button>
                </Tooltip>
                <Tooltip label="Next" shortcut="J">
                  <button type="button" onClick={() => goTo(nextId)} disabled={!nextId} aria-label="Next application"
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronDown size={15} strokeWidth={2} aria-hidden />
                  </button>
                </Tooltip>
              </div>
            )}
            <Button size="sm" onClick={() => setEditing(true)}><Pencil size={13} strokeWidth={2} aria-hidden />Edit</Button>
            <Button size="sm" onClick={() => setTailoring(true)}><Sparkles size={13} strokeWidth={2} aria-hidden />Tailor resume</Button>
            <Menu
              ariaLabel="More actions"
              align="end"
              items={[
                ...(app.jobUrl ? [{ label: "Open job posting", icon: <ExternalLink size={14} />, onSelect: () => window.open(app.jobUrl, "_blank", "noopener") }] : []),
                { label: "Copy link", icon: <Link2 size={14} />, onSelect: copyLink },
                { label: app.archived ? "Restore from archive" : "Archive", icon: app.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />, onSelect: toggleArchive, dividerBefore: true },
                { label: "Delete", icon: <Trash2 size={14} />, destructive: true, onSelect: () => void handleDelete() },
              ]}
              trigger={
                <button type="button" aria-label="More actions"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Ellipsis size={15} strokeWidth={2} aria-hidden />
                </button>
              }
            />
          </>
        }
      />

      {/* Hero */}
      <div className="flex items-start gap-4">
        <CompanyLogo name={app.company} logoUrl={company?.logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight text-foreground">{app.role}</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            <span className="text-foreground/90 font-medium">{app.company}</span>
            {meta.map((m) => <span key={m}> · {m}</span>)}
          </p>
          <div className="mt-3 flex items-center gap-2.5 flex-wrap">
            <StageMenu app={app} onMove={moveStage} size="md" />
            <span className="text-[13px] text-muted-foreground">{health.longLabel}</span>
            {app.archived && <span className="text-[12px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">Archived</span>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 mt-8 items-start">
        <div className="space-y-4 min-w-0">
          <FitSection
            app={app}
            analyzing={reanalyze.isPending}
            onAnalyze={() => reanalyze.mutate(app._id)}
            onTailor={() => setTailoring(true)}
          />
          {/* The list's cached row has no JD (summary payload) — show the
              skeleton until the full document lands, never "No description". */}
          <JobDescriptionSection text={app.jobDescription} loading={isPlaceholderData && app.jobDescription == null} onAdd={() => setEditing(true)} />
          <NotesSection notes={app.notes ?? ""} onEdit={() => setEditing(true)} />
          <TailoringHistorySection applicationId={app._id} onOpen={() => setTailoring(true)} />
        </div>
        <DetailRail app={app} onMove={moveStage} onPreviewResume={setPreview} />
      </div>

      {editing && <ApplicationFormModal app={app} onClose={() => setEditing(false)} />}
      {tailoring && <ApplicationTailorDrawer applicationId={app._id} onClose={() => setTailoring(false)} />}
      {preview?.fileUrl && <ResumePreview fileUrl={preview.fileUrl} name={preview.name} fileName={preview.fileName} onClose={() => setPreview(null)} />}
      {confirmState.open && (
        <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
    </div>
  );
}
