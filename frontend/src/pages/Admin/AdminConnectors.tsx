/** Admin → Connectors — what people connect to HireTrail, the way Settings →
 *  Connectors shows it to them: one row per connector (state, reach, what it
 *  did in the last 30 days), then the people who connected one, each with
 *  the account they linked and a way to disconnect it.
 *
 *  Scans are the person's own action (they run on their AI lane and land in
 *  their review queue), so there's no "scan for them" here. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import toast from "../../components/ui/toast.ts";
import { adminAPI } from "../../utils/api";
import PageHeader from "../../components/ui/PageHeader.tsx";
import Button from "../../components/ui/Button.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import BrandTile, { BrandLogo } from "../../components/BrandLogo/BrandLogo.tsx";
import { sinceLabel } from "../../components/ai/format.ts";
import { useConfirm } from "../../hooks/useConfirm";
import type { AdminMailboxStats, AdminMailboxUser, MailboxProvider, Pagination } from "../../types";

type Filter = MailboxProvider | "all";

const LABEL: Record<MailboxProvider, string> = { gmail: "Gmail", outlook: "Outlook" };

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
const people = (n: number) => `${n.toLocaleString()} ${n === 1 ? "person" : "people"}`;

function Dot({ tone }: { tone: "live" | "paused" }) {
  return <span aria-hidden className={`w-1.5 h-1.5 shrink-0 rounded-full ${tone === "live" ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />;
}

/** One connector, as a row: what it is, how many people use it, its state. */
function ConnectorRow({ brand, title, sub, state, tone, detail, warn }: {
  brand: MailboxProvider;
  title: string;
  sub: string;
  state: string;
  tone: "live" | "paused";
  detail?: string;
  warn?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <BrandTile brand={brand} size={32} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {warn
          ? <p className="truncate text-[12px] text-amber-700 dark:text-amber-400">{warn}</p>
          : <p className="truncate text-[12px] text-muted-foreground">{sub}</p>}
      </div>
      {/* One cluster, so when it wraps it drops as a block and stays right-aligned. */}
      <div className="ml-auto flex shrink-0 items-center gap-4">
        {detail && <p className="text-[12px] text-muted-foreground tabular-nums">{detail}</p>}
        <p className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${tone === "live" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
          <Dot tone={tone} />
          {state}
        </p>
      </div>
    </div>
  );
}

export default function AdminConnectors() {
  const [users, setUsers] = useState<AdminMailboxUser[]>([]);
  const [stats, setStats] = useState<AdminMailboxStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchData = useCallback(async (page: number, searchVal: string, provider: Filter) => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        adminAPI.getMailboxUsers({ page, limit: 20, search: searchVal || undefined, provider }),
        adminAPI.getMailboxStats(),
      ]);
      setUsers(usersRes.data);
      setPagination(usersRes.pagination);
      setStats(statsRes);
    } catch {
      // the API layer has already said what went wrong
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  useEffect(() => { void fetchData(1, search, filter); }, [fetchData, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchData(1, val, filter), 300);
  };

  const disconnect = async (user: AdminMailboxUser, provider: MailboxProvider) => {
    const account = provider === "gmail" ? user.gmailEmail : user.outlookEmail;
    const ok = await confirm(
      `${user.name} can connect it again from Settings → Connectors. Applications already in their tracker stay.`,
      { title: `Disconnect ${LABEL[provider]}${account ? ` (${account})` : ""}?`, confirmLabel: "Disconnect", danger: true },
    );
    if (!ok) return;
    const key = `${user._id}:${provider}`;
    setBusyKey(key);
    try {
      await adminAPI.disconnectMailbox(user._id, provider);
      toast.success(`${LABEL[provider]} disconnected for ${user.name}`);
      void fetchData(pagination.page, search, filter);
    } catch {
      // the API layer's toast says why
    } finally {
      setBusyKey(null);
    }
  };

  const p = stats?.providers;
  const s = stats?.scans30d;
  const showOutlook = (p?.outlookConnected ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Connectors"
        meta={p ? `${people(p.anyConnected)} connected` : undefined}
      />
      <p className="-mt-2 mb-6 max-w-2xl text-[13px] text-muted-foreground leading-relaxed">
        What people connect to HireTrail. Every connector is read-only, and what it finds waits in that person's review queue — nothing changes in a tracker until they accept it.
      </p>

      {/* ── The connectors ─────────────────────────────────────────── */}
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Connectors</h2>
      <div className="surface-card mt-2 mb-8 divide-y divide-border overflow-hidden">
        {!stats ? (
          <div className="px-4 py-3"><Skeleton className="h-8 w-full" /></div>
        ) : (
          <>
            <ConnectorRow
              brand="gmail"
              title="Gmail"
              sub={`${people(p!.gmailConnected)} · reads application emails into review`}
              warn={s!.failed ? `${plural(s!.failed, "scan")} in the last 30 days didn't finish` : null}
              detail={`30 days: ${plural(s!.scans, "scan")} · ${s!.found.toLocaleString()} found · ${s!.imported.toLocaleString()} imported`}
              state="Live"
              tone="live"
            />
            {showOutlook && (
              <ConnectorRow
                brand="outlook"
                title="Outlook"
                sub={`${plural(p!.outlookConnected, "earlier connection")} · hidden until it joins the review queue`}
                state="Paused"
                tone="paused"
              />
            )}
          </>
        )}
      </div>

      {/* ── The people ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:mr-auto">People</h2>
        {showOutlook && (
          <SegmentedControl<Filter>
            ariaLabel="Connector"
            size="sm"
            value={filter}
            onChange={setFilter}
            segments={[{ value: "all", label: "All" }, { value: "gmail", label: "Gmail" }, { value: "outlook", label: "Outlook" }]}
          />
        )}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} strokeWidth={1.8} aria-hidden />
          <Input
            type="search"
            aria-label="Search people"
            placeholder="Name or connected email"
            className="pl-9"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={`surface-card divide-y divide-border overflow-hidden transition-opacity duration-200 ${loading && !firstLoad ? "opacity-60" : ""}`} aria-busy={loading}>
        {firstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-9 w-full" /></div>)
        ) : users.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {search ? `No one matches “${search}”.` : "No one has connected Gmail yet."}
          </p>
        ) : users.map((u) => (
          <div key={u._id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
              <p className="truncate text-[12px] text-muted-foreground">{u.email}</p>
            </div>
            <div className="ml-auto flex min-w-0 flex-col gap-1.5">
              {(["gmail", "outlook"] as const).map((provider) => {
                const connected = provider === "gmail" ? u.gmailConnected : u.outlookConnected;
                if (!connected) return null;
                const account = provider === "gmail" ? u.gmailEmail : u.outlookEmail;
                const synced = sinceLabel(provider === "gmail" ? u.gmailLastSyncAt : u.outlookLastSyncAt);
                return (
                  <div key={provider} className="flex min-w-0 items-center gap-3">
                    <BrandLogo brand={provider} size={15} />
                    <p className="min-w-0 truncate text-[13px] text-foreground">
                      {account || LABEL[provider]}
                      <span className="text-muted-foreground"> · {synced ? `scanned ${synced}` : "not scanned yet"}</span>
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyKey === `${u._id}:${provider}`}
                      onClick={() => void disconnect(u, provider)}
                      aria-label={`Disconnect ${LABEL[provider]} for ${u.name}`}
                    >
                      Disconnect
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-[13px] text-muted-foreground tabular-nums">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => void fetchData(pagination.page - 1, search, filter)} disabled={pagination.page <= 1 || loading}>Previous</Button>
            <Button size="sm" onClick={() => void fetchData(pagination.page + 1, search, filter)} disabled={pagination.page >= pagination.pages || loading}>Next</Button>
          </div>
        </div>
      )}

      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
