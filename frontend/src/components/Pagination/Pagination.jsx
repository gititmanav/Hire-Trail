import PropTypes from "prop-types";
import "./Pagination.css";

function Pagination({ page, totalPages, onPageChange, totalItems, itemLabel }) {
  if (totalPages <= 1) {
    return (
      <div className="pagination">
        <span className="pagination-info">
          {totalItems} {itemLabel}
        </span>
      </div>
    );
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Build a short page list: first, neighbors of current, last
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-info">
        Page {page} of {totalPages} · {totalItems} {itemLabel}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          Previous
        </button>
        {sorted.map((p, i) => {
          const prev = sorted[i - 1];
          const showGap = prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="pagination-page-wrap">
              {showGap && <span className="pagination-ellipsis">…</span>}
              <button
                type="button"
                className={`pagination-page ${p === page ? "pagination-page-active" : ""}`}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Go to page ${p}`}
              >
                {p}
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

Pagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  totalItems: PropTypes.number.isRequired,
  itemLabel: PropTypes.string,
};

Pagination.defaultProps = {
  itemLabel: "items",
};

export default Pagination;
