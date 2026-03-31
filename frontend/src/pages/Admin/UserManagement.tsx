import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import ActionDropdown from "../../components/ActionDropdown/ActionDropdown";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useConfirm } from "../../hooks/useConfirm";
import type { AdminUserDetail, Pagination } from "../../types";
import type { DropdownItem } from "../../components/ActionDropdown/ActionDropdown";

const roleBadge: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

function statusBadge(u: AdminUserDetail): { label: string; cls: string } {
  if (u.deleted) return { label: "Deleted", cls: "bg-muted text-foreground" };
  if (u.suspended) return { label: "Suspended", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" };
  return { label: "Active", cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" };
}

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const fetchUsers = useCallback(
    (page: number, searchVal: string, role: string) => {
      setLoading(true);
      const params: Record<string, unknown> = { page, limit: 20 };
      if (searchVal) params.search = searchVal;
      if (role) params.role = role;
      adminAPI
        .getUsers(params as Parameters<typeof adminAPI.getUsers>[0])
        .then((res) => {
          setUsers(res.data);
          setPagination(res.pagination);
        })
        .catch(() => toast.error("Failed to load users"))
        .finally(() => setLoading(false));
    },
    []
  );

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

  const handleChangeRole = async (user: AdminUserDetail) => {
    const newRole = user.role === "admin" ? "user" : "admin";
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
    } catch { /* toast handled by interceptor */ }
  };

  const handleSuspend = async (user: AdminUserDetail) => {
    const action = user.suspended ? "unsuspend" : "suspend";
    const ok = await confirm(
      `${action === "suspend" ? "Suspend" : "Unsuspend"} ${user.name}?`,
      {
        title: action === "suspend" ? "Suspend User" : "Unsuspend User",
        confirmLabel: action === "suspend" ? "Suspend" : "Unsuspend",
        danger: action === "suspend",
      }
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
    const ok = await confirm(`Soft delete ${user.name}? This marks the account as deleted.`, {
      title: "Soft Delete User",
      confirmLabel: "Soft Delete",
    });
    if (!ok) return;
    try {
      await adminAPI.deleteUser(user._id);
      toast.success("User soft-deleted");
      refresh();
    } catch { /* handled */ }
  };

  const handleHardDelete = async (user: AdminUserDetail) => {
    const ok = await confirm(`PERMANENTLY delete ${user.name} and all their data? This cannot be undone!`, {
      title: "Permanently Delete User",
      confirmLabel: "Delete Forever",
    });
    if (!ok) return;
    try {
      await adminAPI.hardDeleteUser(user._id);
      toast.success("User permanently deleted");
      refresh();
    } catch { /* handled */ }
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
    } catch {
      toast.error("Export failed");
    }
  };

  const getDropdownItems = (user: AdminUserDetail): DropdownItem[] => [
    {
      label: `Make ${user.role === "admin" ? "User" : "Admin"}`,
      onClick: () => handleChangeRole(user),
    },
    {
      label: user.suspended ? "Unsuspend" : "Suspend",
      onClick: () => handleSuspend(user),
    },
    {
      label: "Soft Delete",
      onClick: () => handleSoftDelete(user),
      className: "text-orange-600 dark:text-orange-400",
      divider: true,
    },
    {
      label: "Hard Delete",
      onClick: () => handleHardDelete(user),
      className: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <button onClick={handleExport} className="btn-secondary text-sm">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            className="input-premium w-full pl-9"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <select
          className="input-premium w-full sm:w-44"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Table */}
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
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((user) => {
                const status = statusBadge(user);
                return (
                  <tr
                    key={user._id}
                    className="border-b border-border hover:bg-muted"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                    <td className="px-4 py-3 text-secondary-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge[user.role] || ""}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                    </td>
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
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages} ({pagination.total} users)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchUsers(pagination.page - 1, search, roleFilter)}
              disabled={pagination.page <= 1}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => fetchUsers(pagination.page + 1, search, roleFilter)}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
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
