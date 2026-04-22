import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { applicationsAPI, resumesAPI, contactsAPI } from "../../utils/api.js";
import DetailSidebar from "../../components/DetailSidebar/DetailSidebar.jsx";
import ApplicationDetail from "../../components/ApplicationDetail/ApplicationDetail.jsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.jsx";
import MultiSelect from "../../components/MultiSelect/MultiSelect.jsx";
import Pagination from "../../components/Pagination/Pagination.jsx";
import "./Applications.css";

const STAGES = ["Applied", "OA", "Interview", "Offer", "Rejected"];
const PAGE_SIZE = 25;

/* ---- Modal Form ---- */
function ApplicationModal({ app, resumes, contacts, onSave, onClose }) {
  const [form, setForm] = useState({
    company: app?.company || "",
    role: app?.role || "",
    jobUrl: app?.jobUrl || "",
    stage: app?.stage || "Applied",
    notes: app?.notes || "",
    resumeId: app?.resumeId || "",
    contactIds: app?.contactIds || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const contactOptions = contacts.map((c) => ({
    value: c._id,
    label: c.name,
    sub: c.company || c.role || "",
  }));

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <div className="modal-header">
          <h2 id="app-modal-title">
            {app ? "Edit application" : "New application"}
          </h2>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="company">Company *</label>
            <input
              id="company"
              name="company"
              type="text"
              className="form-input"
              value={form.company}
              onChange={handleChange}
              placeholder="e.g. Google"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role *</label>
            <input
              id="role"
              name="role"
              type="text"
              className="form-input"
              value={form.role}
              onChange={handleChange}
              placeholder="e.g. Software Engineer Intern"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="jobUrl">Job URL</label>
            <input
              id="jobUrl"
              name="jobUrl"
              type="url"
              className="form-input"
              value={form.jobUrl}
              onChange={handleChange}
              placeholder="https://..."
            />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="stage">Stage</label>
              <select
                id="stage"
                name="stage"
                className="form-select"
                value={form.stage}
                onChange={handleChange}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="resumeId">Resume version</label>
              <select
                id="resumeId"
                name="resumeId"
                className="form-select"
                value={form.resumeId}
                onChange={handleChange}
              >
                <option value="">None</option>
                {resumes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <MultiSelect
              label="Linked contacts"
              options={contactOptions}
              value={form.contactIds}
              onChange={(contactIds) => setForm({ ...form, contactIds })}
              placeholder="Type a contact name…"
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-textarea"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any notes about this application..."
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : app ? "Update" : "Add application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ApplicationModal.propTypes = {
  app: PropTypes.shape({
    _id: PropTypes.string,
    company: PropTypes.string,
    role: PropTypes.string,
    jobUrl: PropTypes.string,
    stage: PropTypes.string,
    notes: PropTypes.string,
    resumeId: PropTypes.string,
    contactIds: PropTypes.arrayOf(PropTypes.string),
  }),
  resumes: PropTypes.arrayOf(
    PropTypes.shape({ _id: PropTypes.string, name: PropTypes.string }),
  ).isRequired,
  contacts: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      company: PropTypes.string,
      role: PropTypes.string,
    }),
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

ApplicationModal.defaultProps = {
  app: null,
};

/* ---- Main Page ---- */
function Applications() {
  const [apps, setApps] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStage, setFilterStage] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [expandedCompanies, setExpandedCompanies] = useState(() => new Set());
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [previewResumeId, setPreviewResumeId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [appsData, resumesData, contactsData] = await Promise.all([
        applicationsAPI.getAll(),
        resumesAPI.getAll(),
        contactsAPI.getAll(),
      ]);
      setApps(appsData);
      setResumes(resumesData);
      setContacts(contactsData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (formData) => {
    if (editing) {
      await applicationsAPI.update(editing._id, formData);
    } else {
      await applicationsAPI.create(formData);
    }
    setModalOpen(false);
    setEditing(null);
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this application?")) return;
    await applicationsAPI.delete(id);
    if (selectedAppId === id) setSelectedAppId(null);
    await fetchData();
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (app) => {
    setEditing(app);
    setModalOpen(true);
  };

  const getBadgeClass = (stage) => {
    const map = {
      Applied: "badge-applied",
      OA: "badge-oa",
      Interview: "badge-interview",
      Offer: "badge-offer",
      Rejected: "badge-rejected",
    };
    return map[stage] || "badge-applied";
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const resumeMap = useMemo(() => {
    const m = new Map();
    resumes.forEach((r) => m.set(r._id, r));
    return m;
  }, [resumes]);

  const contactMap = useMemo(() => {
    const m = new Map();
    contacts.forEach((c) => m.set(c._id, c));
    return m;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return apps.filter((app) => {
      const matchesStage = filterStage === "All" || app.stage === filterStage;
      const matchesSearch =
        !q ||
        app.company.toLowerCase().includes(q) ||
        app.role.toLowerCase().includes(q);
      return matchesStage && matchesSearch;
    });
  }, [apps, filterStage, searchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStage, searchTerm]);

  // Group by company, preserving order
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((app) => {
      const key = app.company.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          company: app.company,
          apps: [],
        });
      }
      map.get(key).apps.push(app);
    });
    const arr = Array.from(map.values());
    // sort each group's apps by applicationDate desc
    arr.forEach((g) => {
      g.apps.sort(
        (a, b) => new Date(b.applicationDate) - new Date(a.applicationDate),
      );
    });
    // sort groups by most-recent app in group desc
    arr.sort(
      (a, b) =>
        new Date(b.apps[0].applicationDate) -
        new Date(a.apps[0].applicationDate),
    );
    return arr;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE));
  const pagedGroups = grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleCompany = (key) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedApp = useMemo(
    () => apps.find((a) => a._id === selectedAppId) || null,
    [apps, selectedAppId],
  );

  const selectedResume = useMemo(() => {
    if (!selectedApp?.resumeId) return null;
    return resumeMap.get(selectedApp.resumeId) || null;
  }, [selectedApp, resumeMap]);

  const selectedContacts = useMemo(() => {
    if (!selectedApp?.contactIds) return [];
    return selectedApp.contactIds
      .map((id) => contactMap.get(id))
      .filter(Boolean);
  }, [selectedApp, contactMap]);

  const previewResume = useMemo(
    () => resumes.find((r) => r._id === previewResumeId) || null,
    [resumes, previewResumeId],
  );

  if (loading) {
    return <div className="spinner"></div>;
  }

  const renderAppRow = (app, { indent = false } = {}) => (
    <tr
      key={app._id}
      className={`application-row ${indent ? "application-row-nested" : ""}`}
    >
      <td>
        <button
          type="button"
          className="application-row-link"
          onClick={() => setSelectedAppId(app._id)}
          aria-label={`Open details for ${app.role} at ${app.company}`}
        >
          <span className="application-row-company">{app.company}</span>
        </button>
        {app.jobUrl && (
          <a
            href={app.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="job-link"
            aria-label={`Open job posting for ${app.role}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M9 6.5v3a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1h3" />
              <polyline points="7,1.5 10.5,1.5 10.5,5" />
              <line x1="5.5" y1="6.5" x2="10.5" y2="1.5" />
            </svg>
          </a>
        )}
      </td>
      <td>{app.role}</td>
      <td>
        <span className={`badge ${getBadgeClass(app.stage)}`}>{app.stage}</span>
      </td>
      <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
        {resumeMap.get(app.resumeId)?.name || "—"}
      </td>
      <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
        {formatDate(app.applicationDate)}
      </td>
      <td>
        <div className="action-btns">
          <button
            type="button"
            className="btn-icon"
            onClick={() => openEdit(app)}
            aria-label={`Edit ${app.role} at ${app.company}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => handleDelete(app._id)}
            aria-label={`Delete ${app.role} at ${app.company}`}
            style={{ color: "var(--danger)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <polyline points="2,4 12,4" />
              <path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" />
              <path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );

  const renderGroupRow = (group) => {
    const expanded = expandedCompanies.has(group.key);
    const count = group.apps.length;
    const stageCounts = {};
    group.apps.forEach((a) => {
      stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1;
    });
    const present = STAGES.filter((s) => stageCounts[s]);
    const summary = present.map((s) => `${stageCounts[s]} ${s}`).join(", ");
    const newest = group.apps[0];

    return (
      <tr key={group.key} className="application-group-row">
        <td>
          <button
            type="button"
            className="application-group-toggle"
            onClick={() => toggleCompany(group.key)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${group.company} — ${summary}`}
          >
            <span
              className={`application-group-caret ${expanded ? "application-group-caret-open" : ""}`}
              aria-hidden="true"
            >
              ▸
            </span>
            <span className="application-row-company">{group.company}</span>
            <span className="application-group-count">
              {count} app{count === 1 ? "" : "s"}
            </span>
          </button>
        </td>
        <td aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          —
        </td>
        <td>
          <div
            className="application-stage-bar"
            title={summary}
            aria-label={`Stage breakdown: ${summary}`}
          >
            {present.map((s) => (
              <span
                key={s}
                className={`application-stage-segment stage-${s.toLowerCase()}`}
                style={{ flex: stageCounts[s] }}
              >
                <span className="application-stage-segment-label">
                  {stageCounts[s]}
                </span>
              </span>
            ))}
          </div>
        </td>
        <td aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          —
        </td>
        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Latest: {formatDate(newest.applicationDate)}
        </td>
        <td />
      </tr>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1>Applications</h1>
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          Add application
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <label className="sr-only" htmlFor="applications-search">
          Search applications
        </label>
        <input
          id="applications-search"
          type="search"
          className="form-input"
          placeholder="Search by company or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div
          className="stage-filters"
          role="group"
          aria-label="Filter by stage"
        >
          {["All", ...STAGES].map((s) => {
            const stageClass =
              s === "All" ? "" : `filter-chip-stage-${s.toLowerCase()}`;
            return (
              <button
                key={s}
                type="button"
                className={`filter-chip ${stageClass} ${
                  filterStage === s ? "filter-chip-active" : ""
                }`}
                onClick={() => setFilterStage(s)}
                aria-pressed={filterStage === s}
              >
                {s !== "All" && (
                  <span className="filter-chip-dot" aria-hidden="true" />
                )}
                {s}
                {s !== "All" && (
                  <span className="filter-chip-count">
                    {apps.filter((a) => a.stage === s).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="8" y="6" width="32" height="36" rx="4" />
              <line x1="16" y1="16" x2="32" y2="16" />
              <line x1="16" y1="22" x2="32" y2="22" />
              <line x1="16" y1="28" x2="26" y2="28" />
            </svg>
            <h3>No applications found</h3>
            <p>
              {searchTerm || filterStage !== "All"
                ? "Try adjusting your filters"
                : "Start by adding your first application"}
            </p>
            {!searchTerm && filterStage === "All" && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openNew}
              >
                Add application
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="table-wrapper" tabIndex={0}>
              <table className="data-table">
                <caption className="sr-only">
                  Applications grouped by company. Multiple applications to the
                  same company are collapsible.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Role</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Resume</th>
                    <th scope="col">Applied</th>
                    <th scope="col" style={{ width: 80 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map((group) => {
                    if (group.apps.length === 1) {
                      return renderAppRow(group.apps[0]);
                    }
                    const rows = [renderGroupRow(group)];
                    if (expandedCompanies.has(group.key)) {
                      group.apps.forEach((a) =>
                        rows.push(renderAppRow(a, { indent: true })),
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={grouped.length}
            itemLabel="companies"
          />
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <ApplicationModal
          app={editing}
          resumes={resumes}
          contacts={contacts}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      {/* Detail sidebar */}
      <DetailSidebar
        open={Boolean(selectedApp)}
        title={
          selectedApp
            ? `${selectedApp.company} · ${selectedApp.role}`
            : "Application"
        }
        onClose={() => setSelectedAppId(null)}
        width={520}
      >
        <ApplicationDetail
          app={selectedApp}
          resume={selectedResume}
          contacts={selectedContacts}
          onOpenResume={(id) => setPreviewResumeId(id)}
          onEdit={() => {
            if (selectedApp) {
              openEdit(selectedApp);
              setSelectedAppId(null);
            }
          }}
        />
      </DetailSidebar>

      {/* Resume preview from application detail */}
      <DetailSidebar
        open={Boolean(previewResume)}
        title={previewResume?.name || "Resume"}
        onClose={() => setPreviewResumeId(null)}
        width={560}
      >
        <ResumePreview resume={previewResume} />
      </DetailSidebar>
    </div>
  );
}

export default Applications;
