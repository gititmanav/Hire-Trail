/** Modal a user can pop from any page to report a bug, suggest a feature, or share an idea.
 *  ui/Modal portals it to document.body, so it escapes the sidebar's overflow-hidden clipping context. */
import { useId, useState, FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Bug, Clock, Lightbulb, ThumbsUp, MessageSquare } from "lucide-react";
import toast from "../ui/toast.ts";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal.tsx";
import { Field, TextField, Textarea } from "../ui/Field.tsx";
import Button from "../ui/Button.tsx";
import { feedbackAPI } from "../../utils/api.ts";
import type { FeedbackType } from "../../utils/api.ts";

interface Props {
  onClose: () => void;
  /** Pre-fill the form. Useful when triggered from a specific CTA (e.g. "Request Gmail access"). */
  initial?: { type?: FeedbackType; title?: string; message?: string };
}

interface TypeOption { value: FeedbackType; label: string; description: string; icon: React.ReactNode }

const TYPES: TypeOption[] = [
  { value: "bug",        label: "Bug",        description: "Something broke or behaved wrong.",   icon: <Bug size={18} strokeWidth={1.7} /> },
  { value: "suggestion", label: "Suggestion", description: "A change to something that exists.",  icon: <Clock size={18} strokeWidth={1.7} /> },
  { value: "idea",       label: "Idea",       description: "Something new we could build.",       icon: <Lightbulb size={18} strokeWidth={1.7} /> },
  { value: "praise",     label: "Praise",     description: "Tell us what's working.",             icon: <ThumbsUp size={18} strokeWidth={1.7} /> },
  { value: "other",      label: "Other",      description: "Anything else.",                      icon: <MessageSquare size={18} strokeWidth={1.7} /> },
];

export default function FeedbackModal({ onClose, initial }: Props) {
  const location = useLocation();
  const detailsId = useId();
  const [type, setType] = useState<FeedbackType>(initial?.type ?? "bug");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (title.trim().length < 3) { toast.error("Add a short title."); return; }
    if (message.trim().length < 8) { toast.error("Add a little more detail."); return; }
    setSubmitting(true);
    try {
      await feedbackAPI.submit({
        type,
        title: title.trim(),
        message: message.trim(),
        pageContext: `${location.pathname}${location.search}`,
        userAgent: navigator.userAgent,
        appVersion: "4.0",
      });
      toast.success("Thanks — we got it.");
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: unknown } } };
      const msg = typeof e.response?.data?.error === "string" ? e.response.data.error : "Could not send feedback. Try again?";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader title="Send feedback" description="Bugs, ideas, what's broken, what's missing — anything." onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <ModalBody className="space-y-4">
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Type</p>
            <div className="grid grid-cols-5 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  title={t.description}
                  className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    type === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <TextField
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="One-line summary"
            data-autofocus
          />

          <Field
            label="Details"
            required
            htmlFor={detailsId}
            hint={<span className="block text-right tabular-nums">{message.length}/8000</span>}
          >
            <Textarea
              id={detailsId}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={8000}
              rows={6}
              placeholder={
                type === "bug"
                  ? "Steps to reproduce, what you expected, what happened…"
                  : "Tell us more — the more context the better."
              }
              required
            />
          </Field>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            We attach your current page (<code className="font-mono text-foreground">{location.pathname}</code>) and browser to help reproduce issues. Your name and email are included so we can follow up.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
