/** Settings → Mailboxes: Gmail/Outlook connections, inbox scans, and the
 *  manual rejection report. Hosts the scan-flow modal; OAuth callbacks land
 *  here (…/settings/mailboxes?gmail=success — the /settings index redirect
 *  also forwards legacy /settings?gmail=… links). */
import { useEffect, useState, FormEvent, lazy, Suspense, useContext } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Calendar, Mail } from "lucide-react";
import { applicationsAPI, emailAPI } from "../../../utils/api.ts";
import type { EmailStatusResponse, ScanJob } from "../../../utils/api.ts";
import { UserContext } from "../../../App.tsx";
import { useFeatureFlags } from "../../../hooks/useFeatureFlags.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";
import EmailScanFlowModal from "../EmailScanFlowModal.tsx";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../../components/ui/Modal.tsx";
import { Field, TextField } from "../../../components/ui/Field.tsx";
import DateInput from "../../../components/ui/DateInput.tsx";
import Button from "../../../components/ui/Button.tsx";
import { SettingsCard, SettingsHeader, SettingsSection } from "../ui.tsx";

const FeedbackModal = lazy(() => import("../../../components/FeedbackWidget/FeedbackModal.tsx"));

const DEFAULT_EMAIL_STATUS: EmailStatusResponse = {
  gmail: { connected: false, email: null, lastSyncAt: null, firstScanCompleted: false, firstScanDays: null, hasConsent: false },
  outlook: { connected: false, email: null, lastSyncAt: null, configured: false },
};

function ReportRejectionModal({ onClose }: { onClose: () => void }) {
  const [company, setCompany] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await applicationsAPI.getAll({ search: company, limit: 100 });
      const match = res.data.find(
        (a) => a.company.toLowerCase() === company.toLowerCase() && a.stage !== "Rejected"
      );
      if (!match) {
        toast.error("No matching active application found for that company.");
        setSubmitting(false);
        return;
      }
      await applicationsAPI.update(match._id, { stage: "Rejected", archivedReason: "rejected" });
      toast.success("Application rejected. It will be auto-archived in 7 days.");
      onClose();
    } catch {
      toast.error("Failed to report rejection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm" ariaLabel="Report a rejection">
      <ModalHeader
        title="Report a rejection"
        description="Marks the matching active application as Rejected."
        onClose={onClose}
      />
      <form className="flex flex-col min-h-0" onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <TextField label="Company name" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" data-autofocus />
          <Field label="Date received" required>
            <DateInput value={dateReceived} onChange={setDateReceived} required ariaLabel="Date received" />
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting}>Report rejection</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function MailboxRow({
  provider, state, loading, configured, comingSoon, onConnect, onDisconnect, onRequestAccess,
}: {
  provider: "Gmail" | "Outlook";
  state: { connected: boolean; email: string | null; lastSyncAt: string | null };
  loading: boolean;
  configured: boolean;
  comingSoon?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Surfaced when the provider is configured but the OAuth app is still in
   *  test mode (Google's case). */
  onRequestAccess?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          {provider === "Gmail"
            ? <Mail size={20} strokeWidth={1.6} className="text-foreground" />
            : <Calendar size={20} strokeWidth={1.6} className="text-foreground" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{provider}</span>
            {state.connected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
              </span>
            ) : !configured ? (
              <span className="text-[11px] font-medium text-muted-foreground">Not configured on this server</span>
            ) : (
              <span className="text-[11px] font-medium text-muted-foreground">Not connected</span>
            )}
          </div>
          {state.connected && state.email && (
            <p className="text-xs text-muted-foreground truncate">{state.email}{state.lastSyncAt ? ` · last scanned ${new Date(state.lastSyncAt).toLocaleDateString()}` : ""}</p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {state.connected ? (
          <button
            disabled={loading}
            onClick={onDisconnect}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted disabled:opacity-50"
          >
            {loading ? "Working…" : "Disconnect"}
          </button>
        ) : comingSoon ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-muted text-muted-foreground" aria-disabled="true">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            Coming soon
          </span>
        ) : (
          <>
            <button
              disabled={loading || !configured}
              onClick={onConnect}
              className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={configured ? "" : `${provider} integration is not configured on this server`}
            >
              {loading ? "Connecting…" : `Connect ${provider}`}
            </button>
            {onRequestAccess && (
              <button
                type="button"
                onClick={onRequestAccess}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 whitespace-nowrap"
                title="HireTrail's Gmail integration is in Google's test mode. Request to be added as a test user."
              >
                Request access
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScanJobBanner({ job, onOpen }: { job: ScanJob; onOpen: () => void }) {
  const ready = job.status === "ready_for_review";
  const failed = job.status === "failed";

  let tone = "border-primary/30 bg-primary/5";
  let dot = "bg-primary animate-pulse";
  let label = "Scanning your inbox in the background…";
  let cta = "Resume";
  if (ready) {
    tone = "border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20";
    dot = "bg-emerald-500";
    const n = job.counts.totalCandidates;
    label = n === 0 ? "Inbox scan finished — no applications detected." : `Inbox scan ready: ${n} application${n === 1 ? "" : "s"} to review.`;
    cta = "Review now";
  } else if (failed) {
    tone = "border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20";
    dot = "bg-red-500";
    label = job.error || "Inbox scan failed.";
    cta = "Retry";
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full mb-4 flex items-center justify-between gap-3 rounded-xl border ${tone} px-4 py-3 hover:bg-muted/20 transition-colors text-left`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-sm text-foreground truncate">{label}</span>
      </div>
      <span className="text-xs font-semibold text-primary shrink-0 inline-flex items-center gap-1">
        {cta}
        <ArrowRight size={11} strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  );
}

export default function MailboxSettings() {
  const { user } = useContext(UserContext);
  const { isEnabled } = useFeatureFlags();
  const outlookEnabled = isEnabled("feature_outlook_integration");
  const { requireRealAccount } = useDemoGate();

  const [loading, setLoading] = useState(true);
  const [mailbox, setMailbox] = useState<EmailStatusResponse>(DEFAULT_EMAIL_STATUS);
  const [mailboxLoading, setMailboxLoading] = useState<null | "gmail" | "outlook" | "scan">(null);
  const [scanJob, setScanJob] = useState<ScanJob | null>(null);
  const [scanModal, setScanModal] = useState(false);
  /** Local-session memo so the consent modal doesn't pop again if the user
   *  dismisses it without consenting — they can reopen via the banner. */
  const [scanModalDismissed, setScanModalDismissed] = useState(false);
  const [rejectionModal, setRejectionModal] = useState(false);
  const [requestAccessModal, setRequestAccessModal] = useState(false);

  useEffect(() => {
    Promise.all([
      emailAPI.status().then(setMailbox).catch(() => {}),
      emailAPI.getLatestScanJob().then((r) => setScanJob(r.job)).catch(() => {}),
    ]).finally(() => setLoading(false));

    // OAuth callback results (?gmail=success etc.) — toast + clean the URL.
    const params = new URLSearchParams(window.location.search);
    const gmailResult = params.get("gmail");
    const outlookResult = params.get("outlook");
    if (gmailResult === "success") toast.success("Gmail connected successfully!");
    else if (gmailResult === "error") toast.error("Failed to connect Gmail");
    if (outlookResult === "success") toast.success("Outlook connected successfully!");
    else if (outlookResult === "error") toast.error("Failed to connect Outlook");
    if (gmailResult || outlookResult) {
      emailAPI.status().then(setMailbox).catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /** Auto-prompt for the inbox-scan consent the first time a connected user
   *  arrives without having completed the backfill. One-shot per session if
   *  dismissed; "Scan now" handles re-runs after consent exists. */
  useEffect(() => {
    if (loading || scanModalDismissed) return;
    if (!mailbox.gmail.connected) return;
    if (mailbox.gmail.firstScanCompleted || mailbox.gmail.hasConsent) return;
    setScanModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mailbox.gmail.connected, mailbox.gmail.firstScanCompleted, mailbox.gmail.hasConsent]);

  const refreshMailbox = () => {
    emailAPI.status().then(setMailbox).catch(() => {});
    emailAPI.getLatestScanJob().then((r) => setScanJob(r.job)).catch(() => {});
  };

  return (
    <div>
      <SettingsHeader
        title="Mailboxes"
        badge={<span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary uppercase tracking-wider">Beta</span>}
        description="HireTrail scans your inbox for interview invites, offers, and rejections — and updates your applications automatically."
      />

      {scanJob && scanJob.status !== "completed" && (
        // Shows when the user closed the modal mid-scan. Clicking re-opens the
        // modal, which auto-routes to the right step from the job status.
        <ScanJobBanner
          job={scanJob}
          onOpen={() => {
            if (!requireRealAccount("Email inbox scan")) return;
            setScanModalDismissed(false);
            setScanModal(true);
          }}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-[72px] w-full !rounded-xl" />
          <Skeleton className="h-[72px] w-full !rounded-xl" />
        </div>
      ) : (
        <SettingsCard>
          <MailboxRow
            provider="Gmail"
            state={mailbox.gmail}
            loading={mailboxLoading === "gmail"}
            configured={true}
            onConnect={async () => {
              if (!requireRealAccount("Email integration")) return;
              setMailboxLoading("gmail");
              try {
                const { url } = await emailAPI.connectGmail();
                window.location.href = url;
              } catch { toast.error("Failed to start Gmail connection"); setMailboxLoading(null); }
            }}
            onDisconnect={async () => {
              setMailboxLoading("gmail");
              try {
                await emailAPI.disconnectGmail();
                setMailbox((m) => ({ ...m, gmail: { ...m.gmail, connected: false, email: null, lastSyncAt: null } }));
                toast.success("Gmail disconnected");
              } catch { toast.error("Failed to disconnect"); }
              finally { setMailboxLoading(null); }
            }}
            onRequestAccess={() => setRequestAccessModal(true)}
          />
          {/* Outlook: gated behind feature_outlook_integration — "Coming soon"
           *  until the OAuth app is wired up. */}
          {outlookEnabled ? (
            <MailboxRow
              provider="Outlook"
              state={mailbox.outlook}
              loading={mailboxLoading === "outlook"}
              configured={mailbox.outlook.configured}
              onConnect={async () => {
                if (!requireRealAccount("Email integration")) return;
                setMailboxLoading("outlook");
                try {
                  const { url } = await emailAPI.connectOutlook();
                  window.location.href = url;
                } catch (err) {
                  const e = err as { response?: { data?: { error?: string } } };
                  toast.error(e.response?.data?.error || "Failed to start Outlook connection");
                  setMailboxLoading(null);
                }
              }}
              onDisconnect={async () => {
                setMailboxLoading("outlook");
                try {
                  await emailAPI.disconnectOutlook();
                  setMailbox((m) => ({ ...m, outlook: { ...m.outlook, connected: false, email: null, lastSyncAt: null } }));
                  toast.success("Outlook disconnected");
                } catch { toast.error("Failed to disconnect"); }
                finally { setMailboxLoading(null); }
              }}
            />
          ) : (
            <MailboxRow
              provider="Outlook"
              state={mailbox.outlook}
              loading={false}
              configured={false}
              comingSoon
              onConnect={() => undefined}
              onDisconnect={() => undefined}
            />
          )}
        </SettingsCard>
      )}

      {(mailbox.gmail.connected || mailbox.outlook.connected) && (
        <SettingsSection title="Scans" description="Run a scan on demand — the nightly scan runs automatically.">
          <div className="flex flex-wrap items-center gap-3">
            {!mailbox.gmail.firstScanCompleted && !mailbox.gmail.hasConsent && mailbox.gmail.connected ? (
              /* Until the first backfill scan succeeds, the primary button
               *  routes to the 5/10/15-day picker — the only way to import
               *  historical applications. */
              <button
                onClick={() => {
                  if (!requireRealAccount("Email inbox scan")) return;
                  setScanModalDismissed(false);
                  setScanModal(true);
                }}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg"
              >
                Run your first scan
              </button>
            ) : (
              <button
                disabled={mailboxLoading === "scan"}
                onClick={async () => {
                  if (!requireRealAccount("Email inbox scan")) return;
                  setMailboxLoading("scan");
                  try {
                    // Catch-up window: from 1 AM of the user's local day up to
                    // now; before 1 AM, fall back to yesterday's 1 AM so the
                    // window is never in the future.
                    const oneAm = new Date();
                    oneAm.setHours(1, 0, 0, 0);
                    let afterMs = oneAm.getTime();
                    if (afterMs >= Date.now()) afterMs -= 24 * 60 * 60 * 1000;
                    const afterEpochSec = Math.floor(afterMs / 1000);
                    const { scanJobId, status } = await emailAPI.startManualScan(afterEpochSec);
                    setScanJob({
                      _id: scanJobId,
                      status,
                      kind: "manual",
                      windowDays: 1,
                      progress: { fetched: 0, candidates: 0, threadGroups: 0, classified: 0 },
                      counts: { totalCandidates: 0, imported: 0, skipped: 0, merged: 0, failed: 0 },
                      error: null,
                      startedAt: new Date().toISOString(),
                      finishedAt: null,
                    });
                    setScanModalDismissed(false);
                    setScanModal(true);
                  } catch (e) {
                    const err = e as { response?: { data?: { error?: string } } };
                    toast.error(err.response?.data?.error || "Could not start the scan.");
                  } finally { setMailboxLoading(null); }
                }}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
              >
                {mailboxLoading === "scan" ? "Starting…" : "Scan now"}
              </button>
            )}
            <button onClick={() => setRejectionModal(true)} className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-secondary-foreground hover:bg-muted">
              Report a rejection manually
            </button>
          </div>
        </SettingsSection>
      )}

      {!loading && !mailbox.gmail.connected && !mailbox.outlook.connected && (
        <p className="text-xs text-muted-foreground mt-4 max-w-2xl leading-relaxed">
          Connect a mailbox and HireTrail keeps your pipeline honest for you: it reads only
          job-related threads, proposes changes as an undoable review queue, and never sends email.
        </p>
      )}

      {rejectionModal && <ReportRejectionModal onClose={() => setRejectionModal(false)} />}
      {scanModal && (
        <EmailScanFlowModal
          initialJob={scanJob}
          onClose={() => {
            setScanModal(false);
            setScanModalDismissed(true);
            refreshMailbox();
          }}
          onFinished={refreshMailbox}
        />
      )}
      {requestAccessModal && (
        <Suspense fallback={null}>
          <FeedbackModal
            onClose={() => setRequestAccessModal(false)}
            initial={{
              type: "other",
              title: "Request Gmail integration access",
              message: `Hi! Please add my Google account (${user?.email ?? ""}) to the HireTrail Gmail OAuth test-user list so I can connect my inbox.\n\nThanks!`,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
