/** The deadline dialog (create + edit) and the deadline type vocabulary —
 *  shared by the Deadlines page and the calendar so a deadline is edited the
 *  same way everywhere. */
import { useState, FormEvent } from "react";
import { Calendar, ClipboardList, Handshake, Heart, Mail, Users } from "lucide-react";
import toast from "../ui/toast.ts";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal.tsx";
import { Field, Input, Textarea } from "../ui/Field.tsx";
import Select from "../ui/Select.tsx";
import DateInput from "../ui/DateInput.tsx";
import Button from "../ui/Button.tsx";
import { dayOf } from "../../utils/dates.ts";
import type { Application, Deadline, DeadlineFormData } from "../../types";

export const DEADLINE_TYPES = ["OA due date", "Follow-up reminder", "Interview prep", "Offer decision", "Thank you note", "Other"];

/** Type → glyph. Inherits colour. Unknown / "Other" types get a calendar. */
export function DeadlineTypeIcon({ type, size = 14, className }: { type: string; size?: number; className?: string }) {
  const t = type.toLowerCase();
  const props = { size, strokeWidth: 1.8, className, "aria-hidden": true as const };
  if (t.includes("oa") || t.includes("assessment")) return <ClipboardList {...props} />;
  if (t.includes("follow"))                          return <Mail {...props} />;
  if (t.includes("interview"))                       return <Users {...props} />;
  // Not a check mark: on an open deadline a check reads as "done".
  if (t.includes("offer") || t.includes("decision")) return <Handshake {...props} />;
  if (t.includes("thank"))                           return <Heart {...props} />;
  return <Calendar {...props} />;
}

export default function DeadlineFormModal({ deadline: dl, applications: apps, onSave, onClose, initialDueDate = "", initialApplicationId = "", initialType = "" }: {
  deadline: Deadline | null;
  applications: Application[];
  onSave: (d: DeadlineFormData) => Promise<void>;
  onClose: () => void;
  /** New deadlines: the day to start on (the calendar's hovered or focused day). */
  initialDueDate?: string;
  initialApplicationId?: string;
  /** New deadlines: the type to start on (an application's next step — "Interview prep"). */
  initialType?: string;
}) {
  const [form, setForm] = useState<DeadlineFormData>({
    applicationId: dl?.applicationId || initialApplicationId,
    type: dl?.type || initialType,
    dueDate: dl ? dayOf(dl.dueDate) : initialDueDate,
    notes: dl?.notes || "",
    recurrenceDays: dl?.recurrenceDays || 0,
  });
  const [saving, setSaving] = useState(false);

  return (
    <Modal onClose={onClose} size="md" ariaLabel={dl ? "Edit deadline" : "New deadline"}>
      <ModalHeader
        title={dl ? "Edit deadline" : "New deadline"}
        description="A dated to-do — interviews, assessments, follow-ups."
        onClose={onClose}
      />
      <form
        className="flex flex-col min-h-0"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!form.type) return toast.error("Please select a deadline type");
          if (!form.dueDate) return toast.error("Please pick a due date");
          setSaving(true);
          onSave(form).catch(() => setSaving(false));
        }}
      >
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Type" required>
              <Select
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v })}
                ariaLabel="Deadline type"
                placeholder="Select a type"
                options={DEADLINE_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Field>
            <Field label="Due date" required>
              <DateInput
                value={form.dueDate}
                onChange={(v) => setForm({ ...form, dueDate: v })}
                required
                ariaLabel="Due date"
              />
            </Field>
          </div>
          <Field label="Application" hint="Optional — link this deadline to an application.">
            <Select
              value={form.applicationId || ""}
              onChange={(v) => setForm({ ...form, applicationId: v })}
              ariaLabel="Application"
              placeholder="None"
              searchable
              searchPlaceholder="Search applications…"
              options={[
                { value: "", label: "None" },
                ...apps.map((a) => ({ value: a._id, label: a.company, description: a.role })),
              ]}
            />
          </Field>
          {/* Recurrence cadence — "Follow up every 2 weeks until response." When
           *  non-zero, the backend spawns the next occurrence automatically when
           *  this one is completed. Leave at 0 (default) for a one-off. */}
          <Field label="Repeat every (days)" hint="When marked complete, the next occurrence is created automatically. 0 = one-off.">
            <Input
              type="number"
              min={0}
              max={365}
              value={form.recurrenceDays ?? 0}
              onChange={(e) => setForm({ ...form, recurrenceDays: Math.max(0, Math.min(365, parseInt(e.target.value || "0", 10) || 0)) })}
              placeholder="0 = one-off"
              className="sm:w-40"
            />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Prep topics, links, who you're meeting…" />
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{dl ? "Save changes" : "Add deadline"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
