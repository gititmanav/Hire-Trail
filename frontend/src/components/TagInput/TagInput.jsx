import { useState, useRef, useId } from "react";
import PropTypes from "prop-types";
import "./TagInput.css";

function TagInput({ value, onChange, suggestions, placeholder, label }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const listId = useId();

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !value.includes(s) &&
      s.toLowerCase().includes(input.trim().toLowerCase()),
  );

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) return;
    onChange([...value, tag]);
    setInput("");
    setOpen(false);
  };

  const removeTag = (tag) => {
    onChange(value.filter((t) => t !== tag));
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="tag-input-wrapper">
      {label && (
        <label htmlFor={`${listId}-input`} className="tag-input-label">
          {label}
        </label>
      )}
      <div className="tag-input-field">
        {value.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
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
          id={`${listId}-input`}
          ref={inputRef}
          type="text"
          className="tag-input-control"
          value={input}
          placeholder={value.length === 0 ? placeholder : ""}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKey}
          role="combobox"
          aria-expanded={open && filteredSuggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {open && filteredSuggestions.length > 0 && (
        <ul id={listId} role="listbox" className="tag-input-suggestions">
          {filteredSuggestions.slice(0, 8).map((s) => (
            <li key={s} role="option" aria-selected="false">
              <button
                type="button"
                className="tag-input-suggestion"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

TagInput.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
  label: PropTypes.string,
};

TagInput.defaultProps = {
  suggestions: [],
  placeholder: "Type a tag and press Enter",
  label: "",
};

export default TagInput;
