import PropTypes from "prop-types";
import "./ResumePreview.css";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ResumePreview({ resume }) {
  if (!resume) return null;

  const isPdf = resume.fileType === "application/pdf";
  const hasFile = Boolean(resume.cloudinaryUrl);

  return (
    <div className="resume-preview">
      <div className="resume-preview-meta">
        <h3 className="resume-preview-name">{resume.name}</h3>
        {resume.targetRole && (
          <span className="resume-preview-role">{resume.targetRole}</span>
        )}
        {resume.tags && resume.tags.length > 0 && (
          <div className="resume-preview-tags">
            {resume.tags.map((tag) => (
              <span key={tag} className="tag-chip tag-chip-static">
                {tag}
              </span>
            ))}
          </div>
        )}
        <dl className="resume-preview-facts">
          {resume.fileName && (
            <>
              <dt>File</dt>
              <dd>{resume.fileName}</dd>
            </>
          )}
          {resume.fileSize ? (
            <>
              <dt>Size</dt>
              <dd>{formatSize(resume.fileSize)}</dd>
            </>
          ) : null}
          {resume.uploadDate && (
            <>
              <dt>Uploaded</dt>
              <dd>{formatDate(resume.uploadDate)}</dd>
            </>
          )}
          {typeof resume.applicationCount === "number" && (
            <>
              <dt>Used in</dt>
              <dd>
                {resume.applicationCount} application
                {resume.applicationCount === 1 ? "" : "s"}
              </dd>
            </>
          )}
        </dl>

        {hasFile && (
          <a
            href={resume.cloudinaryUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            download={resume.fileName || "resume"}
          >
            Open / download file
          </a>
        )}
      </div>

      <div className="resume-preview-frame">
        {!hasFile ? (
          <div className="resume-preview-empty">
            <p>No file uploaded for this resume version yet.</p>
            <p className="resume-preview-hint">
              Edit this resume to upload a PDF or Word document.
            </p>
          </div>
        ) : isPdf ? (
          <iframe
            title={`Preview of ${resume.name}`}
            src={`${resume.cloudinaryUrl}#toolbar=0`}
            className="resume-preview-iframe"
          />
        ) : (
          <div className="resume-preview-empty">
            <p>
              Preview isn&apos;t available for this file type. Use the link
              above to open it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

ResumePreview.propTypes = {
  resume: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    targetRole: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    fileName: PropTypes.string,
    fileType: PropTypes.string,
    fileSize: PropTypes.number,
    uploadDate: PropTypes.string,
    cloudinaryUrl: PropTypes.string,
    applicationCount: PropTypes.number,
  }),
};

ResumePreview.defaultProps = {
  resume: null,
};

export default ResumePreview;
