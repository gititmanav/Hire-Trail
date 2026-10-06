/** Create / edit an application. Shared by the Applications views and the
 *  application detail page. Sora's composer: the role as the headline, the
 *  company and the link under it, then the details as chips (stage, resume,
 *  location, salary, type), notes as plain text, and the job description —
 *  the input the AI fit check needs — one chip away. */
import { FormEvent, useState } from "react";
import { Briefcase, DollarSign, FileText, Link2, MapPin, Plus } from "lucide-react";
import toast from "../../../components/ui/toast.ts";
import { useQueryClient } from "@tanstack/react-query";
import { resumesAPI } from "../../../utils/api.ts";
import { STAGES, STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../../components/ui/Modal.tsx";
import { Input, Textarea } from "../../../components/ui/Field.tsx";
import Select from "../../../components/ui/Select.tsx";
import ChipInput from "../../../components/ui/ChipInput.tsx";
import { chipCls } from "../../../components/ui/fieldLook.ts";
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
        <ModalHeader title={app ? "Edit application" : "New application"} onClose={onClose} />
        <form className="flex flex-col min-h-0" onSubmit={submit}>
          <ModalBody className="space-y-3">
            <Input
              required
              value={form.role}
              onChange={(e) => u("role", e.target.value)}
              placeholder="Role — e.g. Software Engineer Intern"
              aria-label="Role"
              data-autofocus
              className="!h-9 !text-[19px] font-semibold tracking-tight"
            />
            <Input
              required
              value={form.company}
              onChange={(e) => u("company", e.target.value)}
              placeholder="Company"
              aria-label="Company"
              className="!text-[15px] font-medium"
            />
            <div className="flex items-center gap-2.5">
              <Link2 size={15} strokeWidth={1.8} className="shrink-0 text-muted-foreground" aria-hidden />
              <Input type="url" value={form.jobUrl} onChange={(e) => u("jobUrl", e.target.value)} placeholder="Paste the job link" aria-label="Job URL" />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Select
                value={form.stage}
                onChange={(v) => u("stage", v as Stage)}
                ariaLabel="Stage"
                options={STAGES.map((st) => ({ value: st, label: st, icon: <span className={`w-2 h-2 rounded-full ${STAGE_STRIPE_CLASS[st]}`} /> }))}
              />
              <Select
                value={form.resumeId || ""}
                onChange={(v) => u("resumeId", v)}
                ariaLabel="Resume"
                searchable
                searchPlaceholder="Search resumes…"
                options={[
                  { value: "", label: "No resume", icon: <FileText size={13} strokeWidth={1.9} /> },
                  ...resumes.map((r) => ({ value: r._id, label: r.name, icon: <FileText size={13} strokeWidth={1.9} /> })),
                ]}
                action={{ label: "Add a resume", icon: <Plus size={14} strokeWidth={2} />, onSelect: () => setShowResumeModal(true) }}
              />
              <ChipInput icon={<MapPin size={13} strokeWidth={1.9} />} value={form.location || ""} onChange={(v) => u("location", v)} placeholder="Location" />
              <ChipInput icon={<DollarSign size={13} strokeWidth={1.9} />} value={form.salary || ""} onChange={(v) => u("salary", v)} placeholder="Salary" />
              <ChipInput icon={<Briefcase size={13} strokeWidth={1.9} />} value={form.jobType || ""} onChange={(v) => u("jobType", v)} placeholder="Job type" />
              {!showJd && (
                <button type="button" onClick={() => setShowJd(true)} className={`${chipCls} pl-2.5 pr-3 border-dashed bg-transparent text-muted-foreground hover:text-foreground`}>
                  <Plus size={13} strokeWidth={2} aria-hidden />
                  Job description
                </button>
              )}
            </div>

            <Textarea value={form.notes} onChange={(e) => u("notes", e.target.value)} placeholder="Add notes — a referral, the recruiter, next steps…" aria-label="Notes" className="!mt-4" />
            {showJd && (
              <div className="pt-1">
                <p className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Job description <span className="font-normal">— paste the posting; the AI fit check and tailoring read it.</span></p>
                <Textarea rows={6} value={form.jobDescription} onChange={(e) => u("jobDescription", e.target.value)} placeholder="Paste the full job description…" aria-label="Job description" />
              </div>
            )}
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
