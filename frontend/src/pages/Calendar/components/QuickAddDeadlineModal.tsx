/** Quick-add deadline triggered by clicking an empty day in the calendar. */
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";

const DEADLINE_TYPES = [
  "OA due date",
  "Follow-up reminder",
  "Interview prep",
  "Offer decision",
  "Thank you note",
  "Other",
] as const;

interface Props {
  initialDate: Date;
  onClose: () => void;
  onCreate: (data: { type: string; dueDate: string; notes: string; applicationId: string }) => Promise<void>;
}

export function QuickAddDeadlineModal({ initialDate, onClose, onCreate }: Props) {
  const [type, setType] = useState<string>(DEADLINE_TYPES[0]);
  const [dueDate, setDueDate] = useState(format(initialDate, "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onCreate({ type, dueDate, notes, applicationId: "" });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quick-add" onClick={onClose}>
      <div className="quick-add__panel" onClick={(e) => e.stopPropagation()}>
        <div className="quick-add__head">
          <h3>New deadline</h3>
          <button type="button" onClick={onClose} className="quick-add__close" aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="quick-add__form">
          <label>
            <span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {DEADLINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </label>
          <label>
            <span>Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" rows={3} />
          </label>
          <div className="quick-add__actions">
            <button type="button" className="quick-add__cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="quick-add__save" disabled={saving}>{saving ? "Adding…" : "Add deadline"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
