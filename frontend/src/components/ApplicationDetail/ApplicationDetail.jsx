import PropTypes from "prop-types";
import "./ApplicationDetail.css";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ApplicationDetail({ app, resume, contacts, onOpenResume, onEdit }) {
  if (!app) return null;

  const stageHistory = app.stageHistory || [];

  return (
    <div className="application-detail">
      <section className="application-detail-section">
        <div className="application-detail-heading">
          <h3>{app.role}</h3>
          <span className={`badge badge-${(app.stage || "Applied").toLowerCase()}`}>
            {app.stage}
          </span>
        </div>
        <p className="application-detail-company">{app.company}</p>
        {app.jobUrl && (
          <a
            href={app.jobUrl}
            target="_blank"
            rel="noreferrer"
            className="application-detail-link"
          >
            Open job posting →
          </a>
        )}
      </section>

      <section className="application-detail-section">
        <dl className="application-detail-facts">
          <dt>Applied</dt>
          <dd>{formatDate(app.applicationDate)}</dd>
          <dt>Last update</dt>
          <dd>{formatDate(app.updatedAt)}</dd>
        </dl>
      </section>

      {resume && (
        <section className="application-detail-section">
          <h4>Resume</h4>
          <button
            type="button"
            className="application-detail-resume"
            onClick={() => onOpenResume(resume._id)}
          >
            <span className="application-detail-resume-name">{resume.name}</span>
            {resume.targetRole && (
              <span className="application-detail-resume-role">
                {resume.targetRole}
              </span>
            )}
          </button>
        </section>
      )}

      {contacts.length > 0 && (
        <section className="application-detail-section">
          <h4>Linked contacts</h4>
          <ul className="application-detail-contacts">
            {contacts.map((c) => (
              <li key={c._id}>
                <span className="application-detail-contact-name">
                  {c.name}
                </span>
                {c.role && (
                  <span className="application-detail-contact-role">
                    {c.role}
                    {c.company ? ` · ${c.company}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {stageHistory.length > 1 && (
        <section className="application-detail-section">
          <h4>Stage history</h4>
          <ol className="application-detail-timeline">
            {stageHistory.map((s, i) => (
              <li key={`${s.stage}-${i}`}>
                <span className="application-detail-timeline-stage">
                  {s.stage}
                </span>
                <span className="application-detail-timeline-date">
                  {formatDate(s.date)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {app.notes && (
        <section className="application-detail-section">
          <h4>Notes</h4>
          <p className="application-detail-notes">{app.notes}</p>
        </section>
      )}

      {onEdit && (
        <div className="application-detail-actions">
          <button type="button" className="btn btn-secondary" onClick={onEdit}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

ApplicationDetail.propTypes = {
  app: PropTypes.shape({
    _id: PropTypes.string,
    company: PropTypes.string,
    role: PropTypes.string,
    stage: PropTypes.string,
    jobUrl: PropTypes.string,
    applicationDate: PropTypes.string,
    updatedAt: PropTypes.string,
    stageHistory: PropTypes.arrayOf(
      PropTypes.shape({ stage: PropTypes.string, date: PropTypes.string })
    ),
    notes: PropTypes.string,
  }),
  resume: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    targetRole: PropTypes.string,
  }),
  contacts: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      role: PropTypes.string,
      company: PropTypes.string,
    })
  ),
  onOpenResume: PropTypes.func,
  onEdit: PropTypes.func,
};

ApplicationDetail.defaultProps = {
  app: null,
  resume: null,
  contacts: [],
  onOpenResume: () => {},
  onEdit: null,
};

export default ApplicationDetail;
