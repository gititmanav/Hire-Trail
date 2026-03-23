import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { applicationsAPI, resumesAPI } from "../../utils/api.js";
import "./Applications.css";

const STAGES = ["Applied", "OA", "Interview", "Offer", "Rejected"];

/* ---- Modal Form ---- */
function ApplicationModal({ app, resumes, onSave, onClose }) {
  const [form, setForm] = useState({
    company: app?.company || "",
    role: app?.role || "",
    jobUrl: app?.jobUrl || "",
    stage: app?.stage || "Applied",
    notes: app?.notes || "",
    resumeId: app?.resumeId || "",
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{app ? "Edit application" : "New application"}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

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
            <button type="button" className="btn btn-secondary" onClick={onClose}>
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
  }),
  resumes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
    })
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
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStage, setFilterStage] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [appsData, resumesData] = await Promise.all([
        applicationsAPI.getAll(),
        resumesAPI.getAll(),
      ]);
      setApps(appsData);
      setResumes(resumesData);
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

  // DRY: getBadgeClass is identical to the one in Dashboard.jsx; extract to utils/formatters.js
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

  // DRY: formatDate is duplicated in Dashboard.jsx; extract to utils/formatters.js
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Performance: O(n) linear scan on every render for every table row;
  // build a Map<id, name> once from the resumes array instead
  const getResumeName = (resumeId) => {
    const r = resumes.find((res) => res._id === resumeId);
    return r ? r.name : "—";
  };

  const filtered = apps.filter((app) => {
    const matchesStage = filterStage === "All" || app.stage === filterStage;
    const matchesSearch =
      !searchTerm ||
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStage && matchesSearch;
  });

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Applications</h1>
        <button className="btn btn-primary" onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          Add application
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          className="form-input"
          placeholder="Search by company or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div className="stage-filters">
          {["All", ...STAGES].map((s) => (
            <button
              key={s}
              className={`filter-chip ${filterStage === s ? "filter-chip-active" : ""}`}
              onClick={() => setFilterStage(s)}
            >
              {s}
              {s !== "All" && (
                <span className="filter-chip-count">
                  {apps.filter((a) => a.stage === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
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
              <button className="btn btn-primary btn-sm" onClick={openNew}>
                Add application
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>Resume</th>
                  <th>Applied</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app._id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{app.company}</span>
                      {app.jobUrl && (
                        <a
                          href={app.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="job-link"
                          title="Open job posting"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M9 6.5v3a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5a1 1 0 011-1h3" />
                            <polyline points="7,1.5 10.5,1.5 10.5,5" />
                            <line x1="5.5" y1="6.5" x2="10.5" y2="1.5" />
                          </svg>
                        </a>
                      )}
                    </td>
                    <td>{app.role}</td>
                    <td>
                      <span className={`badge ${getBadgeClass(app.stage)}`}>
                        {app.stage}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {getResumeName(app.resumeId)}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {formatDate(app.applicationDate)}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn-icon"
                          onClick={() => openEdit(app)}
                          title="Edit"
                          aria-label="Edit application"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" />
                          </svg>
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(app._id)}
                          title="Delete"
                          aria-label="Delete application"
                          style={{ color: "var(--danger)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <polyline points="2,4 12,4" />
                            <path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" />
                            <path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ApplicationModal
          app={editing}
          resumes={resumes}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

export default Applications;
