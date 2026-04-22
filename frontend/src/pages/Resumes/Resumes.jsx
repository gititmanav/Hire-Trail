import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { resumesAPI } from "../../utils/api.js";
import TagInput from "../../components/TagInput/TagInput.jsx";
import DetailSidebar from "../../components/DetailSidebar/DetailSidebar.jsx";
import ResumePreview from "../../components/ResumePreview/ResumePreview.jsx";
import "./Resumes.css";

const MAX_UPLOAD_MB = 8;

/* ---- Modal ---- */
function ResumeModal({ resume, existingTags, onSave, onClose }) {
  const [form, setForm] = useState({
    name: resume?.name || "",
    targetRole: resume?.targetRole || "",
    tags: resume?.tags || [],
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFile = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) {
      setFile(null);
      return;
    }
    if (chosen.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File must be ${MAX_UPLOAD_MB} MB or smaller`);
      e.target.value = "";
      return;
    }
    setError("");
    setFile(chosen);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, file });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-modal-title"
      >
        <div className="modal-header">
          <h2 id="resume-modal-title">
            {resume ? "Edit resume" : "New resume version"}
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
            <label htmlFor="name">Version name *</label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-input"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. SWE Resume v2"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="targetRole">Target role type</label>
            <input
              id="targetRole"
              name="targetRole"
              type="text"
              className="form-input"
              value={form.targetRole}
              onChange={handleChange}
              placeholder="e.g. Software Engineering, Data Science"
            />
          </div>

          <div className="form-group">
            <TagInput
              label="Tags"
              value={form.tags}
              onChange={(tags) => setForm({ ...form, tags })}
              suggestions={existingTags}
              placeholder="e.g. frontend, remote — press Enter"
            />
          </div>

          <div className="form-group">
            <label htmlFor="resume-file">
              {resume?.cloudinaryUrl ? "Replace file" : "Upload file"}
              <span className="form-hint">
                {" "}
                — PDF or Word, up to {MAX_UPLOAD_MB} MB
              </span>
            </label>
            <input
              id="resume-file"
              name="file"
              type="file"
              className="form-input"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFile}
            />
            {resume?.fileName && !file && (
              <span className="form-hint">Current: {resume.fileName}</span>
            )}
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
              {saving ? "Saving..." : resume ? "Update" : "Add resume"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ResumeModal.propTypes = {
  resume: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    targetRole: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    fileName: PropTypes.string,
    cloudinaryUrl: PropTypes.string,
  }),
  existingTags: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

ResumeModal.defaultProps = {
  resume: null,
};

/* ---- Main Page ---- */
function Resumes() {
  const [resumes, setResumes] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [previewId, setPreviewId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [data, tagsData] = await Promise.all([
        resumesAPI.getAll(),
        resumesAPI.getTags(),
      ]);
      setResumes(data);
      setTags(tagsData);
    } catch (err) {
      console.error("Fetch resumes error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = async (formData) => {
    if (editing) {
      await resumesAPI.update(editing._id, formData);
    } else {
      await resumesAPI.create(formData);
    }
    setModalOpen(false);
    setEditing(null);
    await fetchAll();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this resume version?")) return;
    await resumesAPI.delete(id);
    if (previewId === id) setPreviewId(null);
    await fetchAll();
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const toggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const visibleResumes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resumes.filter((r) => {
      if (q) {
        const hay = [r.name, r.targetRole, r.fileName, ...(r.tags || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeTags.length > 0) {
        const rTags = r.tags || [];
        if (!activeTags.every((t) => rTags.includes(t))) return false;
      }
      return true;
    });
  }, [resumes, search, activeTags]);

  const previewResume = useMemo(
    () => resumes.find((r) => r._id === previewId) || null,
    [resumes, previewId],
  );

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Resumes</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
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
            <line x1="8" y1="3" x2="8" y2="13" />
            <line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          Add resume
        </button>
      </div>

      {resumes.length > 0 && (
        <div className="resumes-toolbar">
          <label className="sr-only" htmlFor="resume-search">
            Search resumes
          </label>
          <input
            id="resume-search"
            type="search"
            className="form-input"
            placeholder="Search by name, role, tag, or file…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tags.length > 0 && (
            <div
              className="resumes-tag-filter"
              role="group"
              aria-label="Filter by tag"
            >
              {tags.map((tag) => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-chip tag-chip-filter ${
                      active ? "tag-chip-filter-active" : ""
                    }`}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={active}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeTags.length > 0 && (
                <button
                  type="button"
                  className="tag-chip tag-chip-clear"
                  onClick={() => setActiveTags([])}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {resumes.length === 0 ? (
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
              <path d="M28 6H14a4 4 0 00-4 4v28a4 4 0 004 4h20a4 4 0 004-4V16l-10-10z" />
              <polyline points="28,6 28,16 38,16" />
            </svg>
            <h3>No resume versions yet</h3>
            <p>Add your resume versions to track which performs best</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Add first resume
            </button>
          </div>
        </div>
      ) : visibleResumes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No matches</h3>
            <p>Try clearing search or tag filters.</p>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {visibleResumes.map((r) => (
            <article key={r._id} className="card resume-card">
              <div className="resume-card-header">
                <div className="resume-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z" />
                    <polyline points="12,2 12,7 17,7" />
                  </svg>
                </div>
                <div className="action-btns">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => {
                      setEditing(r);
                      setModalOpen(true);
                    }}
                    aria-label={`Edit ${r.name}`}
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
                    onClick={() => handleDelete(r._id)}
                    aria-label={`Delete ${r.name}`}
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
              </div>
              <button
                type="button"
                className="resume-card-body-button"
                onClick={() => setPreviewId(r._id)}
                aria-label={`Open preview of ${r.name}`}
              >
                <h2 className="resume-name">{r.name}</h2>
                {r.targetRole && (
                  <span className="resume-role">{r.targetRole}</span>
                )}
                {r.tags && r.tags.length > 0 && (
                  <div className="resume-card-tags">
                    {r.tags.map((t) => (
                      <span key={t} className="tag-chip tag-chip-static">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {r.fileName && (
                  <span className="resume-file">
                    {r.cloudinaryUrl ? "Uploaded: " : ""}
                    {r.fileName}
                  </span>
                )}
                <div className="resume-meta">
                  <span>Added {formatDate(r.uploadDate)}</span>
                  <span className="resume-usage">
                    {r.applicationCount} app
                    {r.applicationCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <ResumeModal
          resume={editing}
          existingTags={tags}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      <DetailSidebar
        open={Boolean(previewResume)}
        title={previewResume?.name || "Resume"}
        onClose={() => setPreviewId(null)}
        width={560}
      >
        <ResumePreview resume={previewResume} />
      </DetailSidebar>
    </div>
  );
}

export default Resumes;
