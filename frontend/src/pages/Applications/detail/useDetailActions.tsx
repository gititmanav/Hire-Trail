/** What you can do to one application, wherever it's open (its page, the
 *  Desk pane): edit, tailor, preview its resume, open the posting, copy its
 *  link, archive / restore (with Undo), delete (one light confirm) — plus the
 *  dialogs those open. The owner renders `dialogs` once. */
import { useState } from "react";
import { Archive, ArchiveRestore, ExternalLink, Link2, Trash2 } from "lucide-react";
import toast, { toastWithUndo } from "../../../components/ui/toast.ts";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal.tsx";
import ResumePreview from "../../../components/ResumePreview/ResumePreview.tsx";
import type { MenuItem } from "../../../components/ui/Menu.tsx";
import { useConfirm } from "../../../hooks/useConfirm.ts";
import ApplicationFormModal from "../components/ApplicationFormModal.tsx";
import ApplicationTailorDrawer from "../ApplicationTailorDrawer.tsx";
import { useArchiveMutation, useDeleteMutation } from "../data/queries.ts";
import type { Application, Resume } from "../../../types";

export function useDetailActions(app: Application | undefined, { onDeleted }: { onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [preview, setPreview] = useState<Resume | null>(null);
  const archive = useArchiveMutation();
  const remove = useDeleteMutation();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const toggleArchive = () => {
    if (!app) return;
    const toArchived = !app.archived;
    archive.mutate({ ids: [app._id], archived: toArchived }, {
      onSuccess: () => toastWithUndo(
        toArchived ? "Application archived" : "Application restored",
        () => archive.mutate({ ids: [app._id], archived: !toArchived }),
      ),
    });
  };
  const handleDelete = async () => {
    if (!app) return;
    const ok = await confirm("This permanently deletes the application, its deadlines and its fit checks.", { title: `Delete ${app.role}?`, confirmLabel: "Delete" });
    if (!ok) return;
    remove.mutate([app._id], { onSuccess: () => { toast.success("Application deleted"); onDeleted(); } });
  };
  const copyLink = async () => {
    if (!app) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/applications/${app._id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const moreItems: MenuItem[] = app ? [
    ...(app.jobUrl ? [{ label: "Open job posting", icon: <ExternalLink size={14} />, onSelect: () => window.open(app.jobUrl, "_blank", "noopener") }] : []),
    { label: "Copy link", icon: <Link2 size={14} />, onSelect: () => void copyLink() },
    { label: app.archived ? "Restore from archive" : "Archive", icon: app.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />, onSelect: toggleArchive, dividerBefore: true },
    { label: "Delete", icon: <Trash2 size={14} />, destructive: true, onSelect: () => void handleDelete() },
  ] : [];

  const dialogs = app ? (
    <>
      {editing && <ApplicationFormModal app={app} onClose={() => setEditing(false)} />}
      {tailoring && <ApplicationTailorDrawer applicationId={app._id} onClose={() => setTailoring(false)} />}
      {preview?.fileUrl && <ResumePreview fileUrl={preview.fileUrl} name={preview.name} fileName={preview.fileName} onClose={() => setPreview(null)} />}
      {confirmState.open && (
        <ConfirmModal title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
    </>
  ) : null;

  return {
    edit: () => setEditing(true),
    tailor: () => setTailoring(true),
    previewResume: setPreview,
    moreItems,
    dialogs,
  };
}
