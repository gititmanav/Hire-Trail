/** Admin → Users. Everyone with an account: search, filter by role, select
 *  people to email (the selection is handed to Broadcasts), and per person —
 *  details, their AI (the same dialog Admin → AI opens), admin or not,
 *  suspend, delete. The one role that matters is admin vs user. */
import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import toast from "../../components/ui/toast.ts";
import { adminAPI } from "../../utils/api";
import PageHeader from "../../components/ui/PageHeader.tsx";
import Button from "../../components/ui/Button.tsx";
import Menu, { type MenuItem } from "../../components/ui/Menu.tsx";
import Select from "../../components/ui/Select.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { CheckboxMark } from "../../components/ui/Checkbox.tsx";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Modal.tsx";
import { Skeleton } from "../../components/Skeleton/Skeleton.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import UserAiModal from "./ai/UserAiModal.tsx";
import type { AdminUserDetail, Pagination } from "../../types";

const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "admin", label: "Admins" },
  { value: "user", label: "Users" },
];

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function statusOf(u: AdminUserDetail): { label: string; dot: string } {
  if (u.deleted) return { label: "Deleted", dot: "bg-muted-foreground/40" };
  if (u.suspended) return { label: "Suspended", dot: "bg-amber-500" };
  if (u.deletion) return { label: `Deleting on ${fmtDate(u.deletion.scheduledFor)}`, dot: "bg-red-500" };
  return { label: "Active", dot: "bg-emerald-500" };
}

function Status({ user }: { user: AdminUserDetail }) {
  const s = statusOf(user);
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground whitespace-nowrap">
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-control text-[11px] font-medium text-muted-foreground whitespace-nowrap">{children}</span>;
}

const labelOf = (u: Pick<AdminUserDetail, "name" | "email">) => u.name || u.email;

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [aiFor, setAiFor] = useState<{ id: string; label: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestRef = useRef(0);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  // A person picked in the header search arrives as ?user=<id>: open their details.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get("user");
    if (!id) return;
    setDetailId(id);
    const next = new URLSearchParams(params);
    next.delete("user");
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Only the latest request lands — a slow answer to an older search can't
  // overwrite a newer one.
  const fetchUsers = useCallback((page: number, searchVal: string, role: string) => {
    const request = ++requestRef.current;
    setLoading(true);
    adminAPI
      .getUsers({ page, limit: PAGE_SIZE, search: searchVal || undefined, role: role || undefined })
      .then((res) => {
        if (request !== requestRef.current) return;
        setUsers(res.data);
        setPagination(res.pagination);
      })
      .catch(() => { /* the interceptor toasts */ })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
  }, []);

  useEffect(() => {
    fetchUsers(1, search, roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(1, val, roleFilter), 300);
  };

  const refresh = () => fetchUsers(pagination.page, search, roleFilter);

  /* ----- selection (kept across pages; labels travel to Broadcasts) ----- */

  const toggleSelected = (u: AdminUserDetail) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(u._id)) next.delete(u._id);
      else next.add(u._id);
      return next;
    });
    setSelectedLabels((prev) => ({ ...prev, [u._id]: `${u.name} <${u.email}>` }));
  };

  const pageAllSelected = useMemo(
    () => users.length > 0 && users.every((u) => selectedIds.has(u._id)),
    [users, selectedIds],
  );

  const togglePageAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const u of users) {
        if (pageAllSelected) next.delete(u._id);
        else next.add(u._id);
      }
      return next;
    });
    if (!pageAllSelected) {
      setSelectedLabels((prev) => {
        const next = { ...prev };
        for (const u of users) next[u._id] = `${u.name} <${u.email}>`;
        return next;
      });
    }
  };

  const emailSelected = () => {
    navigate("/admin/broadcasts", { state: { userIds: Array.from(selectedIds), userLabels: selectedLabels } });
  };

  /* ----- actions ----- */

  const handleChangeRole = async (user: AdminUserDetail) => {
    const makeAdmin = user.role !== "admin";
    const ok = await confirm(
      makeAdmin
        ? `${labelOf(user)} gets the whole admin panel: every account, every setting.`
        : `${labelOf(user)} loses access to the admin panel.`,
      { title: makeAdmin ? "Make admin?" : "Remove admin?", confirmLabel: makeAdmin ? "Make admin" : "Remove admin", danger: !makeAdmin },
    );
    if (!ok) return;
    try {
      await adminAPI.updateUserRole(user._id, makeAdmin ? "admin" : "user");
      toast.success(makeAdmin ? `${labelOf(user)} is an admin` : `${labelOf(user)} is no longer an admin`);
      refresh();
    } catch { /* the interceptor toasts */ }
  };

  const handleSuspend = async (user: AdminUserDetail) => {
    const suspending = !user.suspended;
    const ok = await confirm(
      suspending
        ? `${labelOf(user)} is signed out and can't sign back in until you unsuspend them. Nothing is deleted.`
        : `${labelOf(user)} can sign in again.`,
      { title: suspending ? "Suspend this account?" : "Unsuspend this account?", confirmLabel: suspending ? "Suspend" : "Unsuspend", danger: suspending },
    );
    if (!ok) return;
    try {
      if (suspending) await adminAPI.suspendUser(user._id);
      else await adminAPI.unsuspendUser(user._id);
      toast.success(suspending ? `${labelOf(user)} is suspended` : `${labelOf(user)} is unsuspended`);
      refresh();
    } catch { /* the interceptor toasts */ }
  };

  const handleSoftDelete = async (user: AdminUserDetail) => {
    const ok = await confirm(
      `${labelOf(user)}'s account is closed and they're signed out. Their data stays until you delete it permanently.`,
      { title: "Close this account?", confirmLabel: "Close account" },
    );
    if (!ok) return;
    try {
      await adminAPI.deleteUser(user._id);
      toast.success(`${labelOf(user)}'s account is closed`);
      refresh();
    } catch { /* the interceptor toasts */ }
  };

  const handleHardDelete = async (user: AdminUserDetail) => {
    const ok = await confirm(
      `Everything ${labelOf(user)} has — applications, resumes, profile, AI keys, inbox scans, the account itself — is erased, and Google's access to their mailbox is revoked. This can't be undone.`,
      { title: "Delete permanently?", confirmLabel: "Delete permanently" },
    );
    if (!ok) return;
    try {
      await adminAPI.hardDeleteUser(user._id);
      toast.success(`${labelOf(user)} is deleted`);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(user._id); return next; });
      refresh();
    } catch { /* the interceptor toasts */ }
  };

  const handleExport = async () => {
    try {
      const blob = await adminAPI.exportUsers();
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch { /* the interceptor toasts */ }
  };

  // A closed account can only be looked at or erased (the other routes skip it).
  const menuItems = (user: AdminUserDetail): MenuItem[] => [
    { label: "Details", onSelect: () => setDetailId(user._id) },
    { label: "AI…", onSelect: () => setAiFor({ id: user._id, label: labelOf(user) }) },
    ...(user.deleted ? [] : [
      { label: user.role === "admin" ? "Remove admin" : "Make admin", onSelect: () => handleChangeRole(user), dividerBefore: true },
      { label: user.suspended ? "Unsuspend" : "Suspend", onSelect: () => handleSuspend(user) },
      { label: "Close account", onSelect: () => handleSoftDelete(user), warning: true, dividerBefore: true },
    ]),
    { label: "Delete permanently", onSelect: () => handleHardDelete(user), destructive: true, dividerBefore: !!user.deleted },
  ];

  const firstLoad = loading && users.length === 0;

  return (
    <div>
      <PageHeader
        title="Users"
        meta={firstLoad ? undefined : `${pagination.total.toLocaleString()} ${pagination.total === 1 ? "account" : "accounts"}`}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={handleExport}>Export CSV</Button>
            <Button size="sm" onClick={() => navigate("/admin/broadcasts")}>Send broadcast</Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} strokeWidth={1.8} aria-hidden />
          <Input
            type="search"
            aria-label="Search users"
            placeholder="Search by name or email"
            className="pl-9"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select ariaLabel="Role" value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border bg-control/60 px-4 py-2">
          <p className="text-[13px] text-foreground">
            <span className="font-semibold tabular-nums">{selectedIds.size}</span> selected
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            <Button size="sm" variant="primary" onClick={emailSelected}>Email selected</Button>
          </div>
        </div>
      )}

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="pl-4 pr-2 py-3 w-10">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={pageAllSelected}
                  aria-label="Select everyone on this page"
                  onClick={togglePageAll}
                  disabled={users.length === 0}
                  className="grid place-items-center w-6 h-6 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                >
                  <CheckboxMark checked={pageAllSelected} />
                </button>
              </th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Joined</th>
              <th className="px-3 py-3">Last sign-in</th>
              <th className="px-3 py-3 text-right">Apps</th>
              <th className="px-3 py-3">Connected</th>
              <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-border transition-opacity duration-200 ${loading && !firstLoad ? "opacity-60" : ""}`} aria-busy={loading}>
            {firstLoad && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={8} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {search || roleFilter ? "No one matches that." : "No accounts yet."}
                </td>
              </tr>
            )}
            {!firstLoad && users.map((user) => {
              const checked = selectedIds.has(user._id);
              return (
                <tr key={user._id} className={`hover:bg-control/50 ${checked ? "bg-control/60" : ""}`}>
                  <td className="pl-4 pr-2 py-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Select ${labelOf(user)}`}
                      onClick={() => toggleSelected(user)}
                      className="grid place-items-center w-6 h-6 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CheckboxMark checked={checked} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 max-w-[280px]">
                    <button
                      type="button"
                      onClick={() => setDetailId(user._id)}
                      className="block max-w-full text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-foreground truncate hover:underline">{user.name || "—"}</span>
                        {user.role === "admin" && <Pill>Admin</Pill>}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">{user.email}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5"><Status user={user} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(user.createdAt)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">{user.lastLogin ? fmtDate(user.lastLogin) : "Never"}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">{user.applicationCount.toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {user.gmailConnected && <Pill>Gmail</Pill>}
                      {user.outlookConnected && <Pill>Outlook</Pill>}
                      {user.hasMasterProfile && <Pill>Profile</Pill>}
                      {!!user.aiKeyCount && <Pill>{user.aiKeyCount === 1 ? "1 AI key" : `${user.aiKeyCount} AI keys`}</Pill>}
                      {!!user.tailorSessionCount && <Pill>{user.tailorSessionCount.toLocaleString()} tailored</Pill>}
                      {!user.gmailConnected && !user.outlookConnected && !user.hasMasterProfile && !user.aiKeyCount && !user.tailorSessionCount && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Menu
                      ariaLabel={`Actions for ${labelOf(user)}`}
                      align="end"
                      width={200}
                      items={menuItems(user)}
                      trigger={
                        <Button size="sm" variant="ghost" aria-label={`Actions for ${labelOf(user)}`}>
                          Actions <ChevronDown size={13} strokeWidth={1.8} aria-hidden />
                        </Button>
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-[13px] text-muted-foreground tabular-nums">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => fetchUsers(pagination.page - 1, search, roleFilter)} disabled={pagination.page <= 1 || loading}>Previous</Button>
            <Button size="sm" onClick={() => fetchUsers(pagination.page + 1, search, roleFilter)} disabled={pagination.page >= pagination.pages || loading}>Next</Button>
          </div>
        </div>
      )}

      {detailId && (
        <UserDetailModal
          userId={detailId}
          onClose={() => setDetailId(null)}
          onOpenAi={(label) => { setDetailId(null); setAiFor({ id: detailId, label }); }}
        />
      )}
      {aiFor && <UserAiModal userId={aiFor.id} label={aiFor.label} onClose={() => setAiFor(null)} />}

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

/* ----- one person ----- */

function UserDetailModal({ userId, onClose, onOpenAi }: { userId: string; onClose: () => void; onOpenAi: (label: string) => void }) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);

  useEffect(() => {
    let live = true;
    adminAPI.getUser(userId)
      .then((u) => { if (live) setUser(u); })
      .catch(() => { if (live) onClose(); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const counts: [string, number | undefined][] = user
    ? [
        ["Applications", user.applicationCount],
        ["Resumes", user.resumeCount],
        ["Contacts", user.contactCount],
        ["Deadlines", user.deadlineCount],
        ["Notifications", user.notificationCount],
      ]
    : [];

  const mailbox = (connected: boolean | undefined, email: string | null | undefined, lastSync: string | null | undefined) =>
    connected ? `${email || "Connected"}${lastSync ? ` · synced ${fmtDate(lastSync)}` : ""}` : "Not connected";

  return (
    <Modal onClose={onClose} size="md" ariaLabel={user ? labelOf(user) : "User"}>
      <ModalHeader title={user ? user.name || user.email : "User"} description={user?.email} onClose={onClose} />
      <ModalBody>
        {!user ? (
          <div className="space-y-3 pb-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {counts.map(([label, n]) => (
                <div key={label} className="rounded-xl border border-border px-3 py-2.5 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground truncate">{label}</p>
                  <p className="text-[15px] font-semibold text-foreground tabular-nums mt-0.5">{(n ?? 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <dl className="divide-y divide-border rounded-xl border border-border text-[13px]">
              <DetailRow label="Status"><Status user={user} /></DetailRow>
              <DetailRow label="Role">{user.role === "admin" ? "Admin" : "User"}</DetailRow>
              <DetailRow label="Joined">{fmtDate(user.createdAt)}</DetailRow>
              <DetailRow label="Last sign-in">{user.lastLogin ? fmtDate(user.lastLogin) : "Never"}</DetailRow>
              <DetailRow label="Gmail">{mailbox(user.gmailConnected, user.gmailEmail, user.gmailLastSyncAt)}</DetailRow>
              {user.outlookConnected && <DetailRow label="Outlook">{mailbox(user.outlookConnected, user.outlookEmail, user.outlookLastSyncAt)}</DetailRow>}
              {user.deletion && <DetailRow label="Deletion">Asked to be deleted — erased on {fmtDate(user.deletion.scheduledFor)} unless they sign in</DetailRow>}
            </dl>
          </div>
        )}
      </ModalBody>
      <ModalFooter start={user && <Button size="sm" variant="ghost" onClick={() => onOpenAi(labelOf(user))}>Their AI…</Button>}>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </ModalFooter>
    </Modal>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-foreground text-right min-w-0 break-words">{children}</dd>
    </div>
  );
}
