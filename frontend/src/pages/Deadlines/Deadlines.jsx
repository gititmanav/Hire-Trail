import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { deadlinesAPI, applicationsAPI } from "../../utils/api.js";
import Pagination from "../../components/Pagination/Pagination.jsx";
import "./Deadlines.css";

const DEADLINE_PAGE_SIZE = 25;

const DEADLINE_TYPES = [
  "OA due date",
  "Follow-up reminder",
  "Interview prep",
  "Offer decision",
  "Thank you note",
  "Other",
];

/* ---- Modal ---- */
function DeadlineModal({ deadline, applications, onSave, onClose }) {
  const [form, setForm] = useState({
    applicationId: deadline?.applicationId || "",
    type: deadline?.type || "",
    dueDate: deadline?.dueDate
      ? new Date(deadline.dueDate).toISOString().split("T")[0]
      : "",
    notes: deadline?.notes || "",
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
          <h2>{deadline ? "Edit deadline" : "New deadline"}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="type">Type *</label>
              <select
                id="type"
                name="type"
                className="form-select"
                value={form.type}
                onChange={handleChange}
                required
              >
                <option value="">Select type...</option>
                {DEADLINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="dueDate">Due date *</label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                className="form-input"
                value={form.dueDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="applicationId">Linked application</label>
            <select
              id="applicationId"
              name="applicationId"
              className="form-select"
              value={form.applicationId}
              onChange={handleChange}
            >
              <option value="">None</option>
              {applications.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.company} — {a.role}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-textarea"
              value={form.notes}
              onChange={handleChange}
              placeholder="Details about this deadline..."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : deadline ? "Update" : "Add deadline"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

DeadlineModal.propTypes = {
  deadline: PropTypes.shape({
    _id: PropTypes.string,
    applicationId: PropTypes.string,
    type: PropTypes.string,
    dueDate: PropTypes.string,
    notes: PropTypes.string,
    completed: PropTypes.bool,
  }),
  applications: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      company: PropTypes.string,
      role: PropTypes.string,
    })
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

DeadlineModal.defaultProps = {
  deadline: null,
};

/* ---- Main Page ---- */
function Deadlines() {
  const [deadlines, setDeadlines] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("upcoming");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const fetchData = useCallback(async () => {
    try {
      const [dlData, appData] = await Promise.all([
        deadlinesAPI.getAll(),
        applicationsAPI.getAll(),
      ]);
      setDeadlines(dlData);
      setApplications(appData);
    } catch (err) {
      console.error("Fetch deadlines error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (formData) => {
    if (editing) {
      await deadlinesAPI.update(editing._id, formData);
    } else {
      await deadlinesAPI.create(formData);
    }
    setModalOpen(false);
    setEditing(null);
    await fetchData();
  };

  const handleToggleComplete = async (d) => {
    await deadlinesAPI.update(d._id, { completed: !d.completed });
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this deadline?")) return;
    await deadlinesAPI.delete(id);
    await fetchData();
  };

  const getAppLabel = (appId) => {
    const a = applications.find((app) => app._id === appId);
    return a ? `${a.company} — ${a.role}` : null;
  };

  const daysUntil = (dateStr) => {
    const diff = Math.ceil(
      (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  const getDueLabel = (dateStr) => {
    const days = daysUntil(dateStr);
    if (days < 0) return "Overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  const getDueClass = (dateStr, completed) => {
    if (completed) return "due-completed";
    const days = daysUntil(dateStr);
    if (days < 0) return "due-overdue";
    if (days <= 2) return "due-urgent";
    if (days <= 7) return "due-soon";
    return "due-normal";
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const now = new Date();
  const filtered = deadlines.filter((d) => {
    if (filter === "upcoming") return !d.completed && new Date(d.dueDate) >= now;
    if (filter === "overdue") return !d.completed && new Date(d.dueDate) < now;
    if (filter === "completed") return d.completed;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / DEADLINE_PAGE_SIZE));
  const paged = filtered.slice(
    (page - 1) * DEADLINE_PAGE_SIZE,
    page * DEADLINE_PAGE_SIZE
  );

  const upcomingCount = deadlines.filter(
    (d) => !d.completed && new Date(d.dueDate) >= now
  ).length;
  const overdueCount = deadlines.filter(
    (d) => !d.completed && new Date(d.dueDate) < now
  ).length;
  const completedCount = deadlines.filter((d) => d.completed).length;

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Deadlines</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          Add deadline
        </button>
      </div>

      {/* Filter tabs */}
      <div className="deadline-tabs">
        <button
          className={`deadline-tab ${filter === "upcoming" ? "deadline-tab-active" : ""}`}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming
          {upcomingCount > 0 && (
            <span className="deadline-tab-count">{upcomingCount}</span>
          )}
        </button>
        <button
          className={`deadline-tab ${filter === "overdue" ? "deadline-tab-active" : ""}`}
          onClick={() => setFilter("overdue")}
        >
          Overdue
          {overdueCount > 0 && (
            <span className="deadline-tab-count deadline-tab-count-danger">
              {overdueCount}
            </span>
          )}
        </button>
        <button
          className={`deadline-tab ${filter === "completed" ? "deadline-tab-active" : ""}`}
          onClick={() => setFilter("completed")}
        >
          Completed
          {completedCount > 0 && (
            <span className="deadline-tab-count">{completedCount}</span>
          )}
        </button>
        <button
          className={`deadline-tab ${filter === "all" ? "deadline-tab-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <circle cx="24" cy="24" r="16" />
              <polyline points="24,14 24,24 31,28" />
            </svg>
            <h3>
              {filter === "upcoming"
                ? "No upcoming deadlines"
                : filter === "overdue"
                  ? "No overdue deadlines"
                  : filter === "completed"
                    ? "No completed deadlines"
                    : "No deadlines yet"}
            </h3>
            <p>
              {filter === "upcoming"
                ? "You're all caught up!"
                : "Add deadlines to stay on track"}
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="deadline-list-full">
            {paged.map((d) => (
              <div
                key={d._id}
                className={`deadline-row ${d.completed ? "deadline-row-completed" : ""}`}
              >
                <button
                  className={`deadline-check ${d.completed ? "deadline-check-done" : ""}`}
                  onClick={() => handleToggleComplete(d)}
                  aria-label={d.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {d.completed && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </button>

                <div className="deadline-row-info">
                  <span className="deadline-row-type">{d.type}</span>
                  {getAppLabel(d.applicationId) && (
                    <span className="deadline-row-app">
                      {getAppLabel(d.applicationId)}
                    </span>
                  )}
                  {d.notes && (
                    <span className="deadline-row-notes">{d.notes}</span>
                  )}
                </div>

                <div className="deadline-row-right">
                  <span className={`deadline-due-badge ${getDueClass(d.dueDate, d.completed)}`}>
                    {d.completed ? "Done" : getDueLabel(d.dueDate)}
                  </span>
                  <span className="deadline-row-date">
                    {formatDate(d.dueDate)}
                  </span>
                </div>

                <div className="action-btns">
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setEditing(d);
                      setModalOpen(true);
                    }}
                    title="Edit"
                    aria-label="Edit deadline"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3z" />
                    </svg>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleDelete(d._id)}
                    title="Delete"
                    aria-label="Delete deadline"
                    style={{ color: "var(--danger)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <polyline points="2,4 12,4" />
                      <path d="M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4" />
                      <path d="M3 4l.75 8.5a1 1 0 001 .5h4.5a1 1 0 001-.5L11 4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filtered.length}
          itemLabel="deadlines"
        />
      )}

      {modalOpen && (
        <DeadlineModal
          deadline={editing}
          applications={applications}
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

export default Deadlines;
