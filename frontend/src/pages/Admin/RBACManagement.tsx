import { useState, useEffect, useCallback, useRef } from "react";
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
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  moderator: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

function statusBadge(u: AdminUserDetail): { label: string; cls: string } {
  if (u.deleted) return { label: "Deleted", cls: "bg-muted text-foreground" };
  if (u.suspended) return { label: "Suspended", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" };
  return { label: "Active", cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" };
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
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Users &amp; Roles</h1>

      {/* Role Definitions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Role Definitions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.role} className="card-premium p-5">
              <h3 className="text-base font-semibold text-foreground capitalize mb-1">{role.role}</h3>
              <p className="text-sm text-secondary-foreground mb-3">{role.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.map((perm) => (
                  <span key={perm} className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">{perm}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Management */}
      <div className="card-premium p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-foreground">User Management</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge[user.role] || roleBadge.user}`}>{user.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
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

      {/* Permission Matrix (Coming Soon) */}
      <div className="card-premium p-6 relative">
        <h2 className="text-lg font-semibold text-foreground mb-4">Permission Matrix</h2>
        <div className="relative">
          <div className="absolute inset-0 bg-muted/80/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <span className="text-lg font-semibold text-muted-foreground bg-card px-4 py-2 rounded-lg shadow">Coming Soon</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Permission</th>
                  {roles.map((r) => (<th key={r.role} className="px-4 py-3 text-center capitalize">{r.role}</th>))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PERMISSIONS_ROWS.map((perm) => (
                  <tr key={perm}>
                    <td className="px-4 py-2 text-foreground font-mono text-xs">{perm}</td>
                    {roles.map((r) => (
                      <td key={r.role} className="px-4 py-2 text-center">
                        <input type="checkbox" disabled checked={r.permissions.includes(perm)} className="h-4 w-4 rounded border-border" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
