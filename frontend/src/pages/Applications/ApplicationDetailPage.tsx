/**
 * Application page — /applications/:id.
 *
 * The home of one application for Ledger and Trail readers (and anyone
 * arriving from the Board, the Calendar, search or a shared link). Desk
 * readers never land here: the Desk is their application page, so this URL
 * opens the Desk with the application beside the list.
 *
 * Opens instantly from any list (the list's cached row paints first; the full
 * document streams in). Back returns to the exact view, filters and scroll;
 * J / K walk the list you came from without going back.
 */
import { useMemo } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Ellipsis, Pencil, Sparkles } from "lucide-react";
import PageHeader, { PageBody } from "../../components/ui/PageHeader.tsx";
import Button from "../../components/ui/Button.tsx";
import Menu from "../../components/ui/Menu.tsx";
import Tooltip from "../../components/ui/Tooltip.tsx";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import { useListDesign } from "../../hooks/useListDesign.ts";
import ApplicationDetail, { ApplicationDetailSkeleton } from "./detail/ApplicationDetail.tsx";
import { useDetailActions } from "./detail/useDetailActions.tsx";
import { applicationHref, readDetailNav } from "./data/navigation.ts";
import { useApplication } from "./data/queries.ts";

const navButton = "w-7 h-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-control disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [design] = useListDesign();
  if (id && design === "desk") return <Navigate to={applicationHref(id, "desk")} replace />;
  return <ApplicationPage id={id} />;
}

function ApplicationPage({ id }: { id: string | undefined }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: app, isPending, isError, isPlaceholderData } = useApplication(id);

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
  const actions = useDetailActions(app, { onDeleted: () => navigate(backTo, { replace: true }) });

  usePageShortcuts({
    j: () => { if (!nextId) return false; goTo(nextId); },
    k: () => { if (!prevId) return false; goTo(prevId); },
    e: () => { if (!app) return false; actions.edit(); },
    Escape: () => goBack(),
  });

  const header = (
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
          {app && (
            <>
              <span className="text-muted-foreground/50" aria-hidden>/</span>
              <span className="truncate">{app.company}</span>
            </>
          )}
        </span>
      }
      actions={app && (
        <>
          {position >= 0 && (
            <div className="flex items-center gap-0.5 mr-1">
              <span className="text-[12.5px] text-muted-foreground tabular-nums mr-1.5">{position + 1} of {nav!.ids.length}</span>
              <Tooltip label="Previous" shortcut="K">
                <button type="button" onClick={() => goTo(prevId)} disabled={!prevId} aria-label="Previous application" className={navButton}>
                  <ChevronUp size={15} strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
              <Tooltip label="Next" shortcut="J">
                <button type="button" onClick={() => goTo(nextId)} disabled={!nextId} aria-label="Next application" className={navButton}>
                  <ChevronDown size={15} strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
            </div>
          )}
          <Button size="sm" onClick={actions.edit}><Pencil size={13} strokeWidth={2} aria-hidden />Edit</Button>
          <Button size="sm" onClick={actions.tailor}><Sparkles size={13} strokeWidth={2} aria-hidden />Tailor resume</Button>
          <Menu
            ariaLabel="More actions"
            align="end"
            items={actions.moreItems}
            trigger={
              <button type="button" aria-label="More actions"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Ellipsis size={15} strokeWidth={2} aria-hidden />
              </button>
            }
          />
        </>
      )}
    />
  );

  if (isPending) return <div>{header}<PageBody size="2xl"><ApplicationDetailSkeleton /></PageBody></div>;
  if (isError || !app) {
    return (
      <div>
        {header}
        <div className="max-w-md mx-auto text-center py-24">
          <h1 className="text-lg font-semibold text-foreground">This application isn't here</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1.5">It may have been deleted, or the link is out of date.</p>
          <Link to="/applications" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium text-primary hover:underline underline-offset-2">
            <ArrowLeft size={14} strokeWidth={2} aria-hidden /> Back to applications
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <PageBody size="2xl">
        <ApplicationDetail app={app} jdLoading={isPlaceholderData} onEdit={actions.edit} onTailor={actions.tailor} onPreviewResume={actions.previewResume} />
      </PageBody>
      {actions.dialogs}
    </div>
  );
}
