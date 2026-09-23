/** Quick-add deadline triggered by clicking an empty day in the calendar. */
import { useState } from "react";
import { format } from "date-fns";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../../components/ui/Modal.tsx";
import { Field, Textarea } from "../../../components/ui/Field.tsx";
import Select from "../../../components/ui/Select.tsx";
import DateInput from "../../../components/ui/DateInput.tsx";
import Button from "../../../components/ui/Button.tsx";

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
    <Modal onClose={onClose} size="sm" ariaLabel="New deadline">
      <ModalHeader title="New deadline" description={format(initialDate, "EEEE, MMM d")} onClose={onClose} />
      <form className="flex flex-col min-h-0" onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <Field label="Type">
            <Select
              value={type}
              onChange={setType}
              ariaLabel="Deadline type"
              options={DEADLINE_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          <Field label="Due date" required>
            <DateInput value={dueDate} onChange={setDueDate} required ariaLabel="Due date" />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Add deadline</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
