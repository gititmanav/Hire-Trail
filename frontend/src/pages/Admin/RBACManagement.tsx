import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, CheckCircle2, User, Search, Check, type LucideIcon } from "lucide-react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { RoleDefinition, AdminUserDetail, Pagination } from "../../types";
import type { DropdownItem } from "../../components/ActionDropdown/ActionDropdown";

const PERMISSIONS_ROWS = [
  "users.read", "users.write", "users.delete",
  "applications.read", "applications.write",
  "resumes.read", "resumes.write",
  "contacts.read", "contacts.write",
  "deadlines.read", "deadlines.write",
  "admin.access", "admin.settings", "admin.seed", "admin.backup",
];

const roleBadge: Record<string, string> = {
  admin: "bg-red-500/10 text-red-700 dark:text-red-300",
  moderator: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  user: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

const roleIcon: Record<string, LucideIcon> = {
  admin: Shield,
  moderator: CheckCircle2,
  user: User,
};

function statusBadge(u: AdminUserDetail): { label: string; cls: string; dot: string } {
  if (u.deleted) return { label: "Deleted", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" };
  if (u.suspended) return { label: "Suspended", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" };
  return { label: "Active", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
}

export default function RBACManagement() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchRoles = useCallback(async () => {
    try {
      const rolesRes = await adminAPI.getRoles();
      setRoles(rolesRes.roles);
    } catch { /* handled */ }
  }, []);

  const fetchUsers = useCallback(
    (page: number, searchVal: string) => {
      setLoading(true);
      const params: Record<string, unknown> = { page, limit: 20 };
      if (searchVal) params.search = searchVal;
      adminAPI
        .getUsers(params as Parameters<typeof adminAPI.getUsers>[0])
        .then((res) => { setUsers(res.data); setPagination(res.pagination); })
        .catch(() => toast.error("Failed to load users"))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchRoles();
    fetchUsers(1, "");
  }, [fetchRoles, fetchUsers]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(1, val), 300);
  };

  const refresh = () => fetchUsers(pagination.page, search);

  const handleChangeRole = async (user: AdminUserDetail, newRole: string) => {
    const ok = await confirm(`Change ${user.name}'s role to ${newRole}?`, {
      title: "Change Role",
      confirmLabel: "Change",
      danger: false,
    });
    if (!ok) return;
    try {
      await adminAPI.updateUserRole(user._id, newRole);
      toast.success("Role updated");
      refresh();
    } catch { /* interceptor */ }
  };

  const handleSuspend = async (user: AdminUserDetail) => {
    const action = user.suspended ? "unsuspend" : "suspend";
    const ok = await confirm(
      `${action === "suspend" ? "Suspend" : "Unsuspend"} ${user.name}?`,
      { title: action === "suspend" ? "Suspend User" : "Unsuspend User", confirmLabel: action === "suspend" ? "Suspend" : "Unsuspend", danger: action === "suspend" }
    );
    if (!ok) return;
    try {
      if (action === "suspend") await adminAPI.suspendUser(user._id);
      else await adminAPI.unsuspendUser(user._id);
      toast.success(action === "suspend" ? "User suspended" : "User unsuspended");
      refresh();
    } catch { /* handled */ }
  };

  const handleSoftDelete = async (user: AdminUserDetail) => {
    const ok = await confirm(`Soft delete ${user.name}? This marks the account as deleted.`, { title: "Soft Delete User", confirmLabel: "Soft Delete" });
    if (!ok) return;
    try { await adminAPI.deleteUser(user._id); toast.success("User soft-deleted"); refresh(); } catch { /* handled */ }
  };

  const handleHardDelete = async (user: AdminUserDetail) => {
    const ok = await confirm(`PERMANENTLY delete ${user.name} and all their data? This cannot be undone!`, { title: "Permanently Delete User", confirmLabel: "Delete Forever" });
    if (!ok) return;
    try { await adminAPI.hardDeleteUser(user._id); toast.success("User permanently deleted"); refresh(); } catch { /* handled */ }
  };

  const handleExport = async () => {
    try {
      const blob = await adminAPI.exportUsers();
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = "users-export.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch { toast.error("Export failed"); }
  };

  const getDropdownItems = (user: AdminUserDetail): DropdownItem[] => {
    const roleItems: DropdownItem[] = roles
      .filter((r) => r.role !== user.role)
      .map((r) => ({
        label: `Make ${r.role.charAt(0).toUpperCase() + r.role.slice(1)}`,
        onClick: () => handleChangeRole(user, r.role),
      }));
    return [
      ...roleItems,
      { label: user.suspended ? "Unsuspend" : "Suspend", onClick: () => handleSuspend(user), divider: true },
      { label: "Soft Delete", onClick: () => handleSoftDelete(user), className: "text-orange-600 dark:text-orange-400" },
      { label: "Hard Delete", onClick: () => handleHardDelete(user), className: "text-red-600 dark:text-red-400" },
    ];
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-premium animate-pulse h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Users &amp; Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">Role definitions, per-user role changes, and the permission matrix.</p>
      </div>

      {/* Role Definitions */}
      <div>
        <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground mb-3">Role Definitions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((role) => {
            const Icon = roleIcon[role.role] || roleIcon.user;
            const badge = roleBadge[role.role] || roleBadge.user;
            return (
              <div key={role.role} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${badge}`}>
                    <Icon width={18} height={18} strokeWidth={2} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground capitalize">{role.role}</h3>
                </div>
                <p className="text-sm text-secondary-foreground mb-3">{role.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((perm) => (
                    <span key={perm} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-secondary-foreground">{perm}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User Management */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">User Management</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Search, change role, suspend, or remove individual users.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width={14} height={14} strokeWidth={2} />
              <input
                type="text"
                placeholder="Search users..."
                className="input-premium pl-9 w-56 text-sm"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <button onClick={handleExport} className="btn-secondary text-xs shrink-0">Export CSV</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Apps</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>
              )}
              {!loading && users.map((user) => {
                const status = statusBadge(user);
                return (
                  <tr key={user._id} className="hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                    <td className="px-4 py-3 text-secondary-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${roleBadge[user.role] || roleBadge.user}`}>{user.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.applicationCount}</td>
                    <td className="px-4 py-3">
                      <ActionDropdown items={getDropdownItems(user)} align="right" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.pages} ({pagination.total} users)
            </p>
            <div className="flex gap-2">
              <button onClick={() => fetchUsers(pagination.page - 1, search)} disabled={pagination.page <= 1} className="btn-secondary text-sm disabled:opacity-50">Previous</button>
              <button onClick={() => fetchUsers(pagination.page + 1, search)} disabled={pagination.page >= pagination.pages} className="btn-secondary text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Permission Matrix */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold uppercase tracking-wider text-muted-foreground">Permission Matrix</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Read-only summary of which roles include which permissions.</p>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Read-only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3">Permission</th>
                {roles.map((r) => (<th key={r.role} className="px-4 py-3 text-center capitalize">{r.role}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSIONS_ROWS.map((perm) => (
                <tr key={perm} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-foreground font-mono text-xs">{perm}</td>
                  {roles.map((r) => {
                    const has = r.permissions.includes(perm);
                    return (
                      <td key={r.role} className="px-4 py-2 text-center">
                        {has ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Check width={12} height={12} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="inline-block w-3 h-px bg-muted-foreground/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
