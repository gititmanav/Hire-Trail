import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { adminAPI } from "../../utils/api";
import type { Application, Contact, Deadline, Resume, Pagination } from "../../types";

type Tab = "applications" | "contacts" | "deadlines" | "resumes";

type WithUser<T> = T & { userId: { _id: string; name: string; email: string } };

const tabs: { key: Tab; label: string }[] = [
  { key: "applications", label: "Applications" },
  { key: "contacts", label: "Contacts" },
  { key: "deadlines", label: "Deadlines" },
  { key: "resumes", label: "Resumes" },
];

const stageBadge: Record<string, string> = {
  Applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  OA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  Interview: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  Offer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface TabState<T> {
  data: T[];
  pagination: Pagination;
  search: string;
  loading: boolean;
}

function defaultTabState<T>(): TabState<T> {
  return { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 }, search: "", loading: true };
}

export default function ContentModeration() {
  const [activeTab, setActiveTab] = useState<Tab>("applications");

  const [apps, setApps] = useState<TabState<WithUser<Application>>>(defaultTabState);
  const [contacts, setContacts] = useState<TabState<WithUser<Contact>>>(defaultTabState);
  const [deadlines, setDeadlines] = useState<TabState<WithUser<Deadline>>>(defaultTabState);
  const [resumes, setResumes] = useState<TabState<WithUser<Resume>>>(defaultTabState);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchApps = useCallback((page: number, search: string) => {
    setApps((s) => ({ ...s, loading: true }));
    const params: Record<string, unknown> = { page, limit: 20 };
    if (search) params.search = search;
    adminAPI
      .getContentApplications(params)
      .then((res) => setApps((s) => ({ ...s, data: res.data, pagination: res.pagination, loading: false })))
      .catch(() => { toast.error("Failed to load applications"); setApps((s) => ({ ...s, loading: false })); });
  }, []);

  const fetchContacts = useCallback((page: number, search: string) => {
    setContacts((s) => ({ ...s, loading: true }));
    const params: Record<string, unknown> = { page, limit: 20 };
    if (search) params.search = search;
    adminAPI
      .getContentContacts(params)
      .then((res) => setContacts((s) => ({ ...s, data: res.data, pagination: res.pagination, loading: false })))
      .catch(() => { toast.error("Failed to load contacts"); setContacts((s) => ({ ...s, loading: false })); });
  }, []);

  const fetchDeadlines = useCallback((page: number, search: string) => {
    setDeadlines((s) => ({ ...s, loading: true }));
    const params: Record<string, unknown> = { page, limit: 20 };
    if (search) params.search = search;
    adminAPI
      .getContentDeadlines(params)
      .then((res) => setDeadlines((s) => ({ ...s, data: res.data, pagination: res.pagination, loading: false })))
      .catch(() => { toast.error("Failed to load deadlines"); setDeadlines((s) => ({ ...s, loading: false })); });
  }, []);

  const fetchResumes = useCallback((page: number, search: string) => {
    setResumes((s) => ({ ...s, loading: true }));
    const params: Record<string, unknown> = { page, limit: 20 };
    if (search) params.search = search;
    adminAPI
      .getContentResumes(params)
      .then((res) => setResumes((s) => ({ ...s, data: res.data, pagination: res.pagination, loading: false })))
      .catch(() => { toast.error("Failed to load resumes"); setResumes((s) => ({ ...s, loading: false })); });
  }, []);

  // Fetch on tab change
  useEffect(() => {
    if (activeTab === "applications") fetchApps(apps.pagination.page, apps.search);
    else if (activeTab === "contacts") fetchContacts(contacts.pagination.page, contacts.search);
    else if (activeTab === "deadlines") fetchDeadlines(deadlines.pagination.page, deadlines.search);
    else if (activeTab === "resumes") fetchResumes(resumes.pagination.page, resumes.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const currentState = (): { search: string; pagination: Pagination; loading: boolean } => {
    if (activeTab === "applications") return apps;
    if (activeTab === "contacts") return contacts;
    if (activeTab === "deadlines") return deadlines;
    return resumes;
  };

  const handleSearch = (val: string) => {
    if (activeTab === "applications") setApps((s) => ({ ...s, search: val }));
    else if (activeTab === "contacts") setContacts((s) => ({ ...s, search: val }));
    else if (activeTab === "deadlines") setDeadlines((s) => ({ ...s, search: val }));
    else setResumes((s) => ({ ...s, search: val }));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (activeTab === "applications") fetchApps(1, val);
      else if (activeTab === "contacts") fetchContacts(1, val);
      else if (activeTab === "deadlines") fetchDeadlines(1, val);
      else fetchResumes(1, val);
    }, 300);
  };

  const goToPage = (page: number) => {
    if (activeTab === "applications") fetchApps(page, apps.search);
    else if (activeTab === "contacts") fetchContacts(page, contacts.search);
    else if (activeTab === "deadlines") fetchDeadlines(page, deadlines.search);
    else fetchResumes(page, resumes.search);
  };

  const state = currentState();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">Content Moderation</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={`Search ${activeTab}...`}
        className="input-premium w-full max-w-md"
        value={state.search}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {/* Table */}
      <div className="overflow-x-auto">
        {activeTab === "applications" && (
          <ApplicationsTable data={apps.data} loading={apps.loading} />
        )}
        {activeTab === "contacts" && (
          <ContactsTable data={contacts.data} loading={contacts.loading} />
        )}
        {activeTab === "deadlines" && (
          <DeadlinesTable data={deadlines.data} loading={deadlines.loading} />
        )}
        {activeTab === "resumes" && (
          <ResumesTable data={resumes.data} loading={resumes.loading} />
        )}
      </div>

      {/* Pagination */}
      {state.pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {state.pagination.page} of {state.pagination.pages} ({state.pagination.total} items)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(state.pagination.page - 1)}
              disabled={state.pagination.page <= 1}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(state.pagination.page + 1)}
              disabled={state.pagination.page >= state.pagination.pages}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-tables ─── */

function ApplicationsTable({ data, loading }: { data: WithUser<Application>[]; loading: boolean }) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="text-xs uppercase text-muted-foreground border-b border-border">
        <tr>
          <th className="px-4 py-3">User</th>
          <th className="px-4 py-3">Company</th>
          <th className="px-4 py-3">Role</th>
          <th className="px-4 py-3">Stage</th>
          <th className="px-4 py-3">Location</th>
          <th className="px-4 py-3">Salary</th>
          <th className="px-4 py-3">Job Type</th>
          <th className="px-4 py-3">Date</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
        )}
        {!loading && data.length === 0 && (
          <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No applications found.</td></tr>
        )}
        {!loading && data.map((a) => (
          <tr key={a._id} className="border-b border-border hover:bg-muted">
            <td className="px-4 py-3 text-foreground">{a.userId?.name || "Unknown"}</td>
            <td className="px-4 py-3 text-secondary-foreground">{a.company}</td>
            <td className="px-4 py-3 text-secondary-foreground">{a.role}</td>
            <td className="px-4 py-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stageBadge[a.stage] || ""}`}>{a.stage}</span>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{a.location || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{a.salary || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{a.jobType || "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{new Date(a.applicationDate).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContactsTable({ data, loading }: { data: WithUser<Contact>[]; loading: boolean }) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="text-xs uppercase text-muted-foreground border-b border-border">
        <tr>
          <th className="px-4 py-3">User</th>
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Company</th>
          <th className="px-4 py-3">Source</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
        )}
        {!loading && data.length === 0 && (
          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No contacts found.</td></tr>
        )}
        {!loading && data.map((c) => (
          <tr key={c._id} className="border-b border-border hover:bg-muted">
            <td className="px-4 py-3 text-foreground">{c.userId?.name || "Unknown"}</td>
            <td className="px-4 py-3 text-secondary-foreground">{c.name}</td>
            <td className="px-4 py-3 text-secondary-foreground">{c.company}</td>
            <td className="px-4 py-3 text-muted-foreground">{c.connectionSource}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeadlinesTable({ data, loading }: { data: WithUser<Deadline>[]; loading: boolean }) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="text-xs uppercase text-muted-foreground border-b border-border">
        <tr>
          <th className="px-4 py-3">User</th>
          <th className="px-4 py-3">Type</th>
          <th className="px-4 py-3">Due Date</th>
          <th className="px-4 py-3">Status</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
        )}
        {!loading && data.length === 0 && (
          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No deadlines found.</td></tr>
        )}
        {!loading && data.map((d) => (
          <tr key={d._id} className="border-b border-border hover:bg-muted">
            <td className="px-4 py-3 text-foreground">{d.userId?.name || "Unknown"}</td>
            <td className="px-4 py-3 text-secondary-foreground">{d.type}</td>
            <td className="px-4 py-3 text-muted-foreground">{new Date(d.dueDate).toLocaleDateString()}</td>
            <td className="px-4 py-3">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  d.completed
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                }`}
              >
                {d.completed ? "Completed" : "Pending"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResumesTable({ data, loading }: { data: WithUser<Resume>[]; loading: boolean }) {
  return (
    <table className="w-full text-sm text-left">
      <thead className="text-xs uppercase text-muted-foreground border-b border-border">
        <tr>
          <th className="px-4 py-3">User</th>
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Target Role</th>
          <th className="px-4 py-3">File</th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
        )}
        {!loading && data.length === 0 && (
          <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No resumes found.</td></tr>
        )}
        {!loading && data.map((r) => (
          <tr key={r._id} className="border-b border-border hover:bg-muted">
            <td className="px-4 py-3 text-foreground">{r.userId?.name || "Unknown"}</td>
            <td className="px-4 py-3 text-secondary-foreground">{r.name}</td>
            <td className="px-4 py-3 text-secondary-foreground">{r.targetRole}</td>
            <td className="px-4 py-3">
              {r.fileUrl ? (
                <a
                  href={r.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                >
                  {r.fileName}
                </a>
              ) : (
                <span className="text-muted-foreground text-xs">{r.fileName || "—"}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
