/** Settings → Connectors: the services HireTrail reads from.
 *
 *  Connected  — one row per connection: what it is, whose account, its state,
 *               when it last ran, and Manage
 *  Available  — what could be added, as compact tiles
 *
 *  Gmail is the one connector for now: an inbox scan reads job-related
 *  threads, AI sorts them (Settings → AI decides where), and a review queue
 *  waits for the person — nothing changes in the tracker until they import.
 *  OAuth callbacks land here (?gmail=success|error); legacy /settings and
 *  /settings/mailboxes links are forwarded. */
import { useContext, useEffect, useState, FormEvent, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "../../../components/ui/toast.ts";
import { ArrowRight, Mail } from "lucide-react";

import { UserContext } from "../../../App.tsx";
import { useDemoGate } from "../../../hooks/useDemoGate.tsx";
import { applicationsAPI, emailAPI, type EmailStatusResponse, type ScanJob } from "../../../utils/api.ts";
import { aiApi, LANE_LABEL } from "../../../utils/aiApi.ts";
import { cssPalette } from "../../../utils/palette.ts";
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../../components/ui/Modal.tsx";
import { Field, TextField } from "../../../components/ui/Field.tsx";
import DateInput from "../../../components/ui/DateInput.tsx";
import Button from "../../../components/ui/Button.tsx";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal.tsx";
import { sinceLabel } from "../../../components/ai/format.ts";
import EmailScanFlowModal from "../EmailScanFlowModal.tsx";
import { SettingsHeader } from "../ui.tsx";

const FeedbackModal = lazy(() => import("../../../components/FeedbackWidget/FeedbackModal.tsx"));

const STATUS_KEY = ["email", "status"] as const;
const SCAN_KEY = ["email", "scan-latest"] as const;

/** A connector's mark in a tile. Interim: a tinted glyph — the official
 *  marks drop in here without touching a caller. */
function ConnectorMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: cssPalette("red-500", 0.1),
        color: cssPalette("red-500"),
        boxShadow: `inset 0 0 0 1px ${cssPalette("red-500", 0.2)}`,
      }}
    >
      <Mail size={Math.round(size * 0.5)} strokeWidth={1.8} />
    </span>
  );
}

function ReportRejectionModal({ onClose }: { onClose: () => void }) {
  const [company, setCompany] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await applicationsAPI.getAll({ search: company, limit: 100 });
      const match = res.data.find((a) => a.company.toLowerCase() === company.toLowerCase() && a.stage !== "Rejected");
      if (!match) {
        toast.error("No active application at that company.");
        return;
      }
      await applicationsAPI.update(match._id, { stage: "Rejected", archivedReason: "rejected" });
      toast.success("Marked rejected. It's archived automatically in 7 days.");
      onClose();
    } catch {
      // The API layer says what went wrong.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm" ariaLabel="Report a rejection">
      <ModalHeader title="Report a rejection" description="Marks the matching active application as Rejected." onClose={onClose} />
      <form className="flex flex-col min-h-0" onSubmit={submit}>
        <ModalBody className="space-y-4">
          <TextField label="Company" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" data-autofocus />
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

/** The catch-up window for "Scan now": from 1 AM today (local), or yesterday's
 *  1 AM before then — never in the future. */
function catchUpSince(): number {
  const oneAm = new Date();
  oneAm.setHours(1, 0, 0, 0);
  let ms = oneAm.getTime();
  if (ms >= Date.now()) ms -= 86_400_000;
  return Math.floor(ms / 1000);
}

function ManageGmailModal({ status, sortLane, onScan, onFirstScan, onDisconnect, onReport, onClose, scanning }: {
  status: EmailStatusResponse["gmail"];
  sortLane: { lane: string | null; where: string | null; refusal: string | null } | null;
  onScan: () => void;
  onFirstScan: () => void;
  onDisconnect: () => void;
  onReport: () => void;
  onClose: () => void;
  scanning: boolean;
}) {
  const firstScanPending = !status.firstScanCompleted && !status.hasConsent;
  const sortOff = !!sortLane && (sortLane.lane === "off" || !!sortLane.refusal);
  return (
    <Modal onClose={onClose} size="md" ariaLabel="Gmail">
      <ModalHeader title="Gmail" description={status.email ?? "Connected"} icon={<ConnectorMark size={28} />} onClose={onClose} />
      <ModalBody className="space-y-5">
        <div className="rounded-xl border border-border divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">{firstScanPending ? "Your first scan" : "Scan now"}</p>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                {firstScanPending
                  ? "Look back 5, 10 or 15 days for applications you've already sent."
                  : `Catch up on today's mail.${status.lastSyncAt ? ` Last scan ${sinceLabel(status.lastSyncAt)}.` : ""}`}
              </p>
            </div>
            <Button size="sm" variant="primary" disabled={sortOff} loading={scanning} onClick={firstScanPending ? onFirstScan : onScan}>
              {firstScanPending ? "Choose a window" : "Scan now"}
            </Button>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Report a rejection</p>
              <p className="text-[12px] text-muted-foreground mt-0.5">For a rejection the scan didn't catch.</p>
            </div>
            <Button size="sm" onClick={onReport}>Report</Button>
          </div>
        </div>

        <div className="space-y-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
          <p>
            HireTrail reads only threads that look like job applications. AI works out the company, role and stage
            {sortLane?.where && sortLane.lane !== "off" ? <> — on <span className="text-foreground">{sortLane.where}</span></> : null}
            , and nothing changes in your tracker until you review it.
          </p>
          {sortOff && (
            <p className="text-amber-700 dark:text-amber-300">
              {sortLane?.refusal ?? "Inbox sorting is off, so scans can't run."} Change it in Settings → AI.
            </p>
          )}
          <p>Read-only: HireTrail never sends mail or changes your inbox.</p>
        </div>
      </ModalBody>
      <ModalFooter start={<Button variant="ghost" onClick={onDisconnect} className="text-red-600 dark:text-red-400">Disconnect</Button>}>
        <Button onClick={onClose}>Done</Button>
      </ModalFooter>
    </Modal>
  );
}

function ScanBanner({ job, onOpen }: { job: ScanJob; onOpen: () => void }) {
  const ready = job.status === "ready_for_review";
  const failed = job.status === "failed";
  const n = job.counts.totalCandidates;
  const label = ready
    ? n === 0 ? "Inbox scan finished — no applications found." : `Inbox scan ready: ${n} application${n === 1 ? "" : "s"} to review.`
    : failed ? job.error || "The inbox scan didn't finish."
    : "Scanning your inbox in the background…";
  const dot = ready ? "bg-emerald-500" : failed ? "bg-red-500" : "bg-foreground/50 animate-pulse motion-reduce:animate-none";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full mb-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-control/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden />
        <span className="text-sm text-foreground truncate">{label}</span>
      </span>
      <span className="text-xs font-semibold text-foreground shrink-0 inline-flex items-center gap-1">
        {ready ? "Review" : failed ? "Retry" : "Open"}
        <ArrowRight size={11} strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  );
}

export default function ConnectorsSettings() {
  const { user } = useContext(UserContext);
  const { requireRealAccount } = useDemoGate();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: emailAPI.status, meta: { errorMessage: "Couldn't load your connectors." } });
  const scan = useQuery({ queryKey: SCAN_KEY, queryFn: () => emailAPI.getLatestScanJob().then((r) => r.job) });
  // Where inbox sorting runs — the Manage dialog says so, and blocks a scan that can't run.
  const ai = useQuery({ queryKey: ["ai", "me"], queryFn: ({ signal }) => aiApi.me({ quiet: true, signal }), staleTime: 60_000 });
  const sort = ai.data?.features.find((f) => f.id === "inbox.sort");

  const [connecting, setConnecting] = useState(false);
  const [manage, setManage] = useState(false);
  const [flow, setFlow] = useState<{ open: boolean; job: ScanJob | null }>({ open: false, job: null });
  const [starting, setStarting] = useState(false);
  const [report, setReport] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [requestAccess, setRequestAccess] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: STATUS_KEY });
    void qc.invalidateQueries({ queryKey: SCAN_KEY });
  };

  // OAuth results (?gmail=success|error) — say so once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmail = params.get("gmail");
    if (gmail === "success") toast.success("Gmail connected");
    else if (gmail === "error") toast.error("Gmail didn't connect. Try again — and sign in with the account you want HireTrail to read.");
    if (gmail || params.get("outlook")) {
      window.history.replaceState({}, "", window.location.pathname);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gmail = status.data?.gmail;
  // First connection: offer the first scan once (dismissable; Manage reopens it).
  const [offeredFirstScan, setOfferedFirstScan] = useState(false);
  useEffect(() => {
    if (!gmail?.connected || gmail.firstScanCompleted || gmail.hasConsent || offeredFirstScan) return;
    setOfferedFirstScan(true);
    setFlow({ open: true, job: scan.data ?? null });
  }, [gmail, offeredFirstScan, scan.data]);

  const connect = async () => {
    if (!requireRealAccount("Connecting Gmail")) return;
    setConnecting(true);
    try {
      const { url } = await emailAPI.connectGmail();
      window.location.href = url;
    } catch {
      setConnecting(false);
    }
  };

  const scanNow = async () => {
    if (!requireRealAccount("Inbox scans")) return;
    setStarting(true);
    try {
      const { scanJobId, status: st } = await emailAPI.startManualScan(catchUpSince());
      setManage(false);
      setFlow({
        open: true,
        job: {
          _id: scanJobId, status: st, kind: "manual", windowDays: 1,
          progress: { fetched: 0, candidates: 0, threadGroups: 0, classified: 0 },
          counts: { totalCandidates: 0, imported: 0, skipped: 0, merged: 0, failed: 0 },
          error: null, startedAt: new Date().toISOString(), finishedAt: null,
        },
      });
    } catch {
      // The API layer's toast says why (and offers Settings → AI when that's the fix).
    } finally {
      setStarting(false);
    }
  };

  const job = scan.data;
  return (
    <div className="max-w-3xl">
      <SettingsHeader
        title="Connectors"
        description="Services HireTrail can read from to keep your pipeline up to date. Everything is read-only, and nothing changes in your tracker until you review it."
      />

      {job && job.status !== "completed" && (
        <ScanBanner job={job} onOpen={() => { if (requireRealAccount("Inbox scans")) setFlow({ open: true, job }); }} />
      )}

      {status.isPending ? (
        <Skeleton className="h-[72px] w-full !rounded-xl" />
      ) : gmail?.connected ? (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Connected</h2>
          <div className="mt-2 surface-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <ConnectorMark />
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-sm font-medium text-foreground">Gmail</p>
                <p className="truncate text-[12px] text-muted-foreground">{gmail.email ?? "Connected"}</p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
                  Connected
                </span>
                <span className="hidden sm:block w-28 truncate text-right text-[12px] text-muted-foreground">
                  {gmail.lastSyncAt ? `Scanned ${sinceLabel(gmail.lastSyncAt)}` : "Not scanned yet"}
                </span>
                <Button size="sm" onClick={() => setManage(true)}>Manage</Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Available</h2>
          <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr))]">
            <article className="flex min-h-[10.5rem] flex-col rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2.5">
                <ConnectorMark size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Gmail</span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                Finds application emails — interviews, assessments, offers, rejections — and lines them up for you to review.
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setRequestAccess(true)}
                  className="text-[11.5px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  title="HireTrail's Gmail access is in Google's testing mode — ask to be added."
                >
                  Request access
                </button>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={connecting}
                  className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-85 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {connecting ? "Connecting…" : "Connect"}
                </button>
              </div>
            </article>
          </div>
        </section>
      )}

      {manage && gmail && (
        <ManageGmailModal
          status={gmail}
          sortLane={sort ? {
            lane: sort.lane,
            where: sort.lane === "byok" ? `your ${ai.data?.keys.find((k) => k.id === sort.keyId)?.name ?? "own"} key` : sort.lane ? LANE_LABEL[sort.lane] : null,
            refusal: sort.refusal?.message ?? null,
          } : null}
          scanning={starting}
          onScan={() => void scanNow()}
          onFirstScan={() => { setManage(false); setFlow({ open: true, job: job ?? null }); }}
          onReport={() => { setManage(false); setReport(true); }}
          onDisconnect={() => { setManage(false); setDisconnecting(true); }}
          onClose={() => setManage(false)}
        />
      )}
      {flow.open && (
        <EmailScanFlowModal initialJob={flow.job} onClose={() => { setFlow({ open: false, job: null }); refresh(); }} onFinished={refresh} />
      )}
      {report && <ReportRejectionModal onClose={() => setReport(false)} />}
      {disconnecting && (
        <ConfirmModal
          title="Disconnect Gmail?"
          message="HireTrail stops reading your inbox and Google's access is revoked. Applications you've already imported stay."
          confirmLabel="Disconnect"
          onConfirm={async () => {
            setDisconnecting(false);
            try {
              await emailAPI.disconnectGmail();
              toast.success("Gmail disconnected");
            } finally {
              refresh();
            }
          }}
          onCancel={() => setDisconnecting(false)}
        />
      )}
      {requestAccess && (
        <Suspense fallback={null}>
          <FeedbackModal
            onClose={() => setRequestAccess(false)}
            initial={{
              type: "other",
              title: "Request Gmail access",
              message: `Hi! Please add my Google account (${user?.email ?? ""}) to HireTrail's Gmail test users so I can connect my inbox.\n\nThanks!`,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
