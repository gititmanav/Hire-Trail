/** Create / edit an application. Shared by the Applications views and the
 *  application detail page. Includes the job description — the input the AI
 *  fit analysis needs (the extension fills it automatically; manual entries
 *  previously had no way to add one outside the old sidebar). */
import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { resumesAPI } from "../../../utils/api.ts";
import { STAGES } from "../../../utils/stageStyles.ts";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../../components/ui/Modal.tsx";
import { Field, TextField, Textarea } from "../../../components/ui/Field.tsx";
import Select from "../../../components/ui/Select.tsx";
import Button from "../../../components/ui/Button.tsx";
import ResumeModal from "../../../components/ResumeModal/ResumeModal.tsx";
import { useResumes, useSaveApplication } from "../data/queries.ts";
import type { Application, ApplicationFormData, Stage } from "../../../types";

type FormState = ApplicationFormData & { jobDescription: string };

function initialForm(app: Application | null): FormState {
  return {
    company: app?.company || "", role: app?.role || "", jobUrl: app?.jobUrl || "",
    stage: app?.stage || "Applied", notes: app?.notes || "",
    resumeId: app?.resumeId || "", companyId: app?.companyId || "",
    contactId: app?.contactId || "", outreachStatus: app?.outreachStatus || "none",
    location: app?.location || "", salary: app?.salary || "", jobType: app?.jobType || "",
    jobDescription: app?.jobDescription || "",
  };
}

export default function ApplicationFormModal({ app, onClose, onSaved }: {
  app: Application | null;
  onClose: () => void;
  onSaved?: (saved: Application) => void;
}) {
  const qc = useQueryClient();
  const { data: resumes = [] } = useResumes();
  const save = useSaveApplication();
  const [form, setForm] = useState<FormState>(() => initialForm(app));
  const [showResumeModal, setShowResumeModal] = useState(false);
  // Only reveal the JD box up front when there's already text to edit.
  const [showJd, setShowJd] = useState(() => !!app?.jobDescription?.trim());
  const u = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Unchanged JD isn't re-sent: an edit opened from a list row (summary
    // payload, no JD loaded) must never blank the stored description.
    const { jobDescription, ...rest } = form;
    const jdChanged = jobDescription !== (app?.jobDescription || "");
    const payload = jdChanged ? { ...rest, jobDescription } : rest;
    save.mutate(
      { id: app?._id ?? null, data: payload },
      {
        onSuccess: (saved) => {
          toast.success(app ? "Changes saved" : "Application added");
          onSaved?.(saved);
          onClose();
        },
      },
    );
  };

  const handleAddResume = async (data: { name: string; targetRole: string; fileName: string; tags: string[]; file: File | null }) => {
    const created = await resumesAPI.create(data);
    await qc.invalidateQueries({ queryKey: ["resumes"] });
    u("resumeId", created._id);
    setShowResumeModal(false);
    toast.success("Resume added");
  };

  return (
    <>
      <Modal onClose={onClose} size="lg" ariaLabel={app ? "Edit application" : "New application"}>
        <ModalHeader
          title={app ? "Edit application" : "New application"}
          description={app ? `${app.company} — ${app.role}` : "Track a role you're pursuing."}
          onClose={onClose}
        />
        <form className="flex flex-col min-h-0" onSubmit={submit}>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Company" required value={form.company} onChange={(e) => u("company", e.target.value)} placeholder="e.g. Stripe" data-autofocus />
              <TextField label="Role" required value={form.role} onChange={(e) => u("role", e.target.value)} placeholder="e.g. Software Engineer Intern" />
            </div>
            <TextField label="Job URL" type="url" value={form.jobUrl} onChange={(e) => u("jobUrl", e.target.value)} placeholder="https://…" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextField label="Location" value={form.location || ""} onChange={(e) => u("location", e.target.value)} placeholder="City or remote" />
              <TextField label="Salary" value={form.salary || ""} onChange={(e) => u("salary", e.target.value)} placeholder="$120k–$150k" />
              <TextField label="Job type" value={form.jobType || ""} onChange={(e) => u("jobType", e.target.value)} placeholder="Internship" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Stage">
                <Select
                  value={form.stage}
                  onChange={(v) => u("stage", v as Stage)}
                  ariaLabel="Stage"
                  options={STAGES.map((s) => ({ value: s, label: s }))}
                />
              </Field>
              <Field label="Resume">
                <div className="flex gap-1.5">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={form.resumeId || ""}
                      onChange={(v) => u("resumeId", v)}
                      ariaLabel="Resume"
                      placeholder="None"
                      searchable
                      searchPlaceholder="Search resumes…"
                      options={[{ value: "", label: "None" }, ...resumes.map((r) => ({ value: r._id, label: r.name }))]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResumeModal(true)}
                    title="Add new resume"
                    aria-label="Add new resume"
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus size={16} strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </Field>
            </div>
            {showJd ? (
              <Field label="Job description" hint="Paste the posting to unlock AI fit analysis and resume tailoring.">
                <Textarea rows={6} value={form.jobDescription} onChange={(e) => u("jobDescription", e.target.value)} placeholder="Paste the full job description…" />
              </Field>
            ) : (
              <button
                type="button"
                onClick={() => setShowJd(true)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <Plus size={14} strokeWidth={2.2} aria-hidden />
                Add job description
              </button>
            )}
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => u("notes", e.target.value)} placeholder="Referral, recruiter contact, next steps…" />
            </Field>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={save.isPending}>
              {app ? "Save changes" : "Add application"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
      {showResumeModal && (
        <ResumeModal
          resume={null}
          existingTags={[...new Set(resumes.flatMap((r) => r.tags || []))].sort()}
          onSave={handleAddResume}
          onClose={() => setShowResumeModal(false)}
        />
      )}
    </>
  );
}
