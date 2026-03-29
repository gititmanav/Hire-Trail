import { useEffect, useMemo, useState } from "react";
import { adminAPI } from "../../utils/api.ts";
import { SkeletonStats, SkeletonTable } from "../../components/Skeleton/Skeleton.tsx";
import type { AdminOverview } from "../../types";

export default function Admin() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const overview = await adminAPI.getOverview();
        setData(overview);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.users;
    const term = query.toLowerCase();
    return data.users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [data, query]);

  if (loading) {
    return (
      <div className="fade-up">
        <SkeletonStats />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <SkeletonTable />
          <SkeletonTable />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card-premium p-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Unable to load admin data right now.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Admin Panel
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor user accounts and login activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card-premium p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total users</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{data.stats.totalUsers}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Admin users</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{data.stats.adminUsers}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Regular users</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{data.stats.regularUsers}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Recent logins tracked</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{data.stats.totalLoginsTracked}</p>
        </div>
      </div>

      <div className="card-premium p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Users</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="input-premium max-w-xs"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u._id} className="border-b border-gray-100 dark:border-gray-700/30 last:border-b-0">
                  <td className="py-2 pr-3 text-gray-900 dark:text-white">{u.name}</td>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "admin" ? "bg-accent-light text-accent-dark dark:bg-accent/20 dark:text-accent" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-premium p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent login activity</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLogins.map((event) => (
                <tr key={event._id} className="border-b border-gray-100 dark:border-gray-700/30 last:border-b-0">
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                    {new Date(event.loggedInAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 text-gray-900 dark:text-white">{event.name}</td>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{event.email}</td>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300 capitalize">{event.provider}</td>
                  <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{event.ipAddress || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
