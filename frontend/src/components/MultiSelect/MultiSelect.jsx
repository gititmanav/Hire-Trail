import { useState, useRef, useEffect, useId } from "react";
import PropTypes from "prop-types";
import "./MultiSelect.css";

function MultiSelect({ options, value, onChange, label, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggle = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const remove = (optionValue) => {
    onChange(value.filter((v) => v !== optionValue));
  };

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean);

  return (
    <div className="multi-select" ref={wrapRef}>
      {label && (
        <label htmlFor={`${id}-search`} className="multi-select-label">
          {label}
        </label>
      )}
      <div
        className={`multi-select-field ${open ? "multi-select-field-open" : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
      >
        {selectedLabels.length === 0 && !open && (
          <span className="multi-select-placeholder">{placeholder}</span>
        )}
        {selectedLabels.map((opt) => (
          <span key={opt.value} className="tag-chip">
            {opt.label}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={() => remove(opt.value)}
              aria-label={`Remove ${opt.label}`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={`${id}-search`}
          type="text"
          className="multi-select-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={selectedLabels.length === 0 ? "" : ""}
        />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-multiselectable="true"
          className="multi-select-list"
        >
          {filtered.length === 0 ? (
            <li className="multi-select-empty">No matches</li>
          ) : (
            filtered.slice(0, 40).map((opt) => {
              const selected = value.includes(opt.value);
              return (
                <li key={opt.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={`multi-select-option ${
                      selected ? "multi-select-option-selected" : ""
                    }`}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className="multi-select-check" aria-hidden="true">
                      {selected ? "✓" : ""}
                    </span>
                    <span>{opt.label}</span>
                    {opt.sub && (
                      <span className="multi-select-sub">{opt.sub}</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

MultiSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      sub: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  placeholder: PropTypes.string,
};

MultiSelect.defaultProps = {
  label: "",
  placeholder: "Select…",
};

export default MultiSelect;
