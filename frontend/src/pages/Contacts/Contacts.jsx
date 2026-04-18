import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { contactsAPI, applicationsAPI } from "../../utils/api.js";
import DetailSidebar from "../../components/DetailSidebar/DetailSidebar.jsx";
import Pagination from "../../components/Pagination/Pagination.jsx";
import "./Contacts.css";

const CONNECTION_SOURCES = [
  "Cold email",
  "Referral",
  "Career fair",
  "LinkedIn",
  "Professor intro",
  "Alumni network",
  "Other",
];

const PAGE_SIZE = 24;
const VIEW_PERSON = "person";
const VIEW_COMPANY = "company";

/* ---- Modal ---- */
function ContactModal({ contact, onSave, onClose }) {
  const [form, setForm] = useState({
    name: contact?.name || "",
    company: contact?.company || "",
    role: contact?.role || "",
    linkedinUrl: contact?.linkedinUrl || "",
    connectionSource: contact?.connectionSource || "",
    notes: contact?.notes || "",
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
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
      >
        <div className="modal-header">
          <h2 id="contact-modal-title">
            {contact ? "Edit contact" : "New contact"}
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

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="name">Name *</label>
              <input
                id="name"
                name="name"
                type="text"
                className="form-input"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="company">Company *</label>
              <input
                id="company"
                name="company"
                type="text"
                className="form-input"
                value={form.company}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="role">Role</label>
              <input
                id="role"
                name="role"
                type="text"
                className="form-input"
                value={form.role}
                onChange={handleChange}
                placeholder="e.g. Recruiter, Hiring Manager"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="connectionSource">How connected</label>
              <select
                id="connectionSource"
                name="connectionSource"
                className="form-select"
                value={form.connectionSource}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                {CONNECTION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="linkedinUrl">LinkedIn URL</label>
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              className="form-input"
              value={form.linkedinUrl}
              onChange={handleChange}
              placeholder="https://linkedin.com/in/..."
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
              placeholder="Conversation history, key details..."
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
              {saving ? "Saving..." : contact ? "Update" : "Add contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ContactModal.propTypes = {
  contact: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    company: PropTypes.string,
    role: PropTypes.string,
    linkedinUrl: PropTypes.string,
    connectionSource: PropTypes.string,
    notes: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

ContactModal.defaultProps = {
  contact: null,
};

function ContactDetail({ contact, apps }) {
  if (!contact) return null;
  return (
    <div className="contact-detail">
      <section>
        <h3 className="contact-detail-name">{contact.name}</h3>
        <p className="contact-detail-role">
          {contact.role ? `${contact.role} at ` : ""}
          {contact.company}
        </p>
        {contact.linkedinUrl && (
          <a
            className="contact-linkedin"
            href={contact.linkedinUrl}
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn profile →
          </a>
        )}
      </section>

      <dl className="contact-detail-facts">
        {contact.connectionSource && (
          <>
            <dt>How connected</dt>
            <dd>{contact.connectionSource}</dd>
          </>
        )}
        {contact.lastContactDate && (
          <>
            <dt>Last contact</dt>
            <dd>{new Date(contact.lastContactDate).toLocaleDateString()}</dd>
          </>
        )}
      </dl>

      {contact.notes && (
        <section>
          <h4 className="contact-detail-subhead">Notes</h4>
          <p className="contact-detail-notes">{contact.notes}</p>
        </section>
      )}

      <section>
        <h4 className="contact-detail-subhead">
          Linked applications ({apps.length})
        </h4>
        {apps.length === 0 ? (
          <p className="contact-detail-empty">
            No applications reference this contact yet.
          </p>
        ) : (
          <ul className="contact-detail-apps">
            {apps.map((a) => (
              <li key={a._id}>
                <span className="contact-detail-app-role">{a.role}</span>
                <span className="contact-detail-app-company">{a.company}</span>
                <span className={`badge badge-${(a.stage || "Applied").toLowerCase()}`}>
                  {a.stage}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

ContactDetail.propTypes = {
  contact: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    company: PropTypes.string,
    role: PropTypes.string,
    linkedinUrl: PropTypes.string,
    connectionSource: PropTypes.string,
    lastContactDate: PropTypes.string,
    notes: PropTypes.string,
  }),
  apps: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      company: PropTypes.string,
      role: PropTypes.string,
      stage: PropTypes.string,
    })
  ),
};

ContactDetail.defaultProps = {
  contact: null,
  apps: [],
};

function CompanyDetail({ companyName, contacts, apps }) {
  return (
    <div className="contact-detail">
      <section>
        <h3 className="contact-detail-name">{companyName}</h3>
        <p className="contact-detail-role">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"} ·{" "}
          {apps.length} application{apps.length === 1 ? "" : "s"}
        </p>
      </section>

      <section>
        <h4 className="contact-detail-subhead">Contacts</h4>
        <ul className="contact-detail-apps">
          {contacts.map((c) => (
            <li key={c._id}>
              <span className="contact-detail-app-role">{c.name}</span>
              <span className="contact-detail-app-company">
                {c.role || "Contact"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {apps.length > 0 && (
        <section>
          <h4 className="contact-detail-subhead">Applications</h4>
          <ul className="contact-detail-apps">
            {apps.map((a) => (
              <li key={a._id}>
                <span className="contact-detail-app-role">{a.role}</span>
                <span
                  className={`badge badge-${(a.stage || "Applied").toLowerCase()}`}
                >
                  {a.stage}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

CompanyDetail.propTypes = {
  companyName: PropTypes.string.isRequired,
  contacts: PropTypes.array.isRequired,
  apps: PropTypes.array.isRequired,
};

/* ---- Main Page ---- */
function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState(VIEW_PERSON);
  const [page, setPage] = useState(1);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [contactsData, appsData] = await Promise.all([
        contactsAPI.getAll(),
        applicationsAPI.getAll(),
      ]);
      setContacts(contactsData);
      setApps(appsData);
    } catch (err) {
      console.error("Fetch contacts error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [view, searchTerm]);

  const handleSave = async (formData) => {
    if (editing) {
      await contactsAPI.update(editing._id, formData);
    } else {
      await contactsAPI.create(formData);
    }
    setModalOpen(false);
    setEditing(null);
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this contact?")) return;
    await contactsAPI.delete(id);
    if (selectedContactId === id) setSelectedContactId(null);
    await fetchData();
  };

  const getInitials = (name) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const filteredContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q)
      );
    });
  }, [contacts, searchTerm]);

  const companyGroups = useMemo(() => {
    const map = new Map();
    filteredContacts.forEach((c) => {
      const key = (c.company || "Unknown").trim();
      if (!map.has(key)) {
        map.set(key, { company: key, contacts: [] });
      }
      map.get(key).contacts.push(c);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.company.localeCompare(b.company)
    );
  }, [filteredContacts]);

  const totalItems =
    view === VIEW_PERSON ? filteredContacts.length : companyGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paged =
    view === VIEW_PERSON
      ? filteredContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : companyGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedContact = useMemo(
    () => contacts.find((c) => c._id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const appsForContact = useMemo(() => {
    if (!selectedContactId) return [];
    return apps.filter((a) =>
      (a.contactIds || []).includes(selectedContactId)
    );
  }, [apps, selectedContactId]);

  const companyData = useMemo(() => {
    if (!selectedCompany) return null;
    const companyContacts = contacts.filter(
      (c) => (c.company || "") === selectedCompany
    );
    const companyApps = apps.filter((a) => a.company === selectedCompany);
    return { contacts: companyContacts, apps: companyApps };
  }, [selectedCompany, contacts, apps]);

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Contacts</h1>
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
          Add contact
        </button>
      </div>

      {contacts.length > 0 && (
        <div className="contacts-toolbar">
          <div
            className="contacts-toggle"
            role="tablist"
            aria-label="View contacts by person or company"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === VIEW_PERSON}
              className={`contacts-toggle-btn ${
                view === VIEW_PERSON ? "contacts-toggle-btn-active" : ""
              }`}
              onClick={() => setView(VIEW_PERSON)}
            >
              People
              <span className="contacts-toggle-count">{contacts.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === VIEW_COMPANY}
              className={`contacts-toggle-btn ${
                view === VIEW_COMPANY ? "contacts-toggle-btn-active" : ""
              }`}
              onClick={() => setView(VIEW_COMPANY)}
            >
              Companies
              <span className="contacts-toggle-count">
                {new Set(contacts.map((c) => c.company || "Unknown")).size}
              </span>
            </button>
          </div>
          <label className="sr-only" htmlFor="contacts-search">
            Search contacts
          </label>
          <input
            id="contacts-search"
            type="search"
            className="form-input"
            placeholder={
              view === VIEW_PERSON
                ? "Search by name, company, or role…"
                : "Search companies…"
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {totalItems === 0 ? (
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
              <circle cx="24" cy="16" r="7" />
              <path d="M12 40v-3a8 8 0 018-8h8a8 8 0 018 8v3" />
            </svg>
            <h3>
              {contacts.length === 0 ? "No contacts yet" : "No matches"}
            </h3>
            <p>
              {contacts.length === 0
                ? "Track recruiters, referrals, and hiring managers"
                : "Try a different search term"}
            </p>
            {contacts.length === 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                Add first contact
              </button>
            )}
          </div>
        </div>
      ) : view === VIEW_PERSON ? (
        <>
          <div className="card-grid">
            {paged.map((c) => (
              <article key={c._id} className="card contact-card">
                <div className="contact-card-header">
                  <button
                    type="button"
                    className="contact-card-open"
                    onClick={() => setSelectedContactId(c._id)}
                    aria-label={`Open details for ${c.name}`}
                  >
                    <div className="contact-avatar" aria-hidden="true">
                      {getInitials(c.name)}
                    </div>
                    <div className="contact-info">
                      <h2 className="contact-name">{c.name}</h2>
                      <p className="contact-company">
                        {c.role ? `${c.role} at ` : ""}
                        {c.company}
                      </p>
                    </div>
                  </button>
                  <div className="action-btns">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                      aria-label={`Edit ${c.name}`}
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
                      onClick={() => handleDelete(c._id)}
                      aria-label={`Delete ${c.name}`}
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

                {c.connectionSource && (
                  <span className="contact-source">{c.connectionSource}</span>
                )}

                {c.notes && <p className="contact-notes">{c.notes}</p>}

                <div className="contact-meta">
                  Last contact: {formatDate(c.lastContactDate)}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            itemLabel="people"
          />
        </>
      ) : (
        <>
          <div className="card-grid">
            {paged.map((group) => (
              <article key={group.company} className="card contact-card">
                <button
                  type="button"
                  className="contact-card-open"
                  onClick={() => setSelectedCompany(group.company)}
                  aria-label={`Open details for ${group.company}`}
                >
                  <div className="contact-avatar" aria-hidden="true">
                    {group.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <h2 className="contact-name">{group.company}</h2>
                    <p className="contact-company">
                      {group.contacts.length} contact
                      {group.contacts.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            itemLabel="companies"
          />
        </>
      )}

      {modalOpen && (
        <ContactModal
          contact={editing}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      <DetailSidebar
        open={Boolean(selectedContact)}
        title={selectedContact?.name || "Contact"}
        onClose={() => setSelectedContactId(null)}
        width={480}
      >
        <ContactDetail contact={selectedContact} apps={appsForContact} />
      </DetailSidebar>

      <DetailSidebar
        open={Boolean(selectedCompany)}
        title={selectedCompany || "Company"}
        onClose={() => setSelectedCompany(null)}
        width={480}
      >
        {companyData && (
          <CompanyDetail
            companyName={selectedCompany}
            contacts={companyData.contacts}
            apps={companyData.apps}
          />
        )}
      </DetailSidebar>
    </div>
  );
}

export default Contacts;
