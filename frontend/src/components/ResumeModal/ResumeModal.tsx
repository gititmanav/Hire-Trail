/** Shared resume add/edit modal — used by Resumes page and Application form. */
import { useState, useRef, useMemo, FormEvent, KeyboardEvent } from "react";
import { X, Tag, FileText, CheckCircle2, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import type { Resume } from "../../types";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../ui/Modal.tsx";
import { TextField } from "../ui/Field.tsx";
import Button from "../ui/Button.tsx";
import { ComboboxList } from "../ui/Combobox.tsx";

interface Props {
  resume: Resume | null;
  existingTags?: string[];
  onSave: (data: { name: string; targetRole: string; fileName: string; tags: string[]; file: File | null }) => Promise<void>;
  onClose: () => void;
}

export default function ResumeModal({ resume, existingTags = [], onSave, onClose }: Props) {
  const [name, setName] = useState(resume?.name || "");
  const [targetRole, setTargetRole] = useState(resume?.targetRole || "");
  const [fileName, setFileName] = useState(resume?.fileName || "");
  const [tags, setTags] = useState<string[]>(resume?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagBoxRef = useRef<HTMLDivElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") { setFile(f); if (!fileName) setFileName(f.name); }
    else toast.error("Only PDF files are allowed");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); if (!fileName) setFileName(f.name); }
  };

  // Suggestions: existing tags that match input and aren't already selected
  const suggestions = useMemo(() => {
    if (!tagInput.trim()) return existingTags.filter((t) => !tags.includes(t));
    const q = tagInput.toLowerCase();
    return existingTags.filter((t) => t.toLowerCase().includes(q) && !tags.includes(t));
  }, [tagInput, existingTags, tags]);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
    setShowSuggestions(false);
    setHighlightIdx(-1);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Navigate suggestions with arrow keys
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        addTag(suggestions[highlightIdx]);
        return;
      }
    }

    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (idx: number) => setTags(tags.filter((_, i) => i !== idx));

  return (
    <Modal onClose={onClose} size="md" ariaLabel={resume ? "Edit resume" : "New resume version"}>
      <ModalHeader
        title={resume ? "Edit resume" : "New resume version"}
        description="Versions keep tailored variants of your resume organized."
        onClose={onClose}
      />
      <form className="flex flex-col min-h-0" onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave({ name, targetRole, fileName, tags, file }).catch(() => setSaving(false)); }}>
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Version name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SWE Resume v2" data-autofocus />
            <TextField label="Target role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Software Engineer" />
          </div>

          {/* Tags input with autocomplete */}
          <div className="relative">
            <label className="block text-[13px] font-medium text-foreground mb-1.5">Tags</label>
            <div
              ref={tagBoxRef}
              className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-background border border-border rounded-lg flex flex-wrap items-center gap-1.5 cursor-text transition-shadow focus-within:ring-2 focus-within:ring-ring/25 focus-within:border-ring"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                  {t}
                  <button type="button" onClick={() => removeTag(i)} className="hover:text-destructive">
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none"
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); setHighlightIdx(-1); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay to allow clicking suggestions
                  setTimeout(() => {
                    if (tagInput.trim()) addTag(tagInput);
                    setShowSuggestions(false);
                  }, 150);
                }}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? "e.g. SDE, Frontend (press Enter)" : "Add tag..."}
              />
            </div>

            {/* Suggestions dropdown */}
            <ComboboxList
              open={showSuggestions}
              onOpenChange={setShowSuggestions}
              anchorRef={tagBoxRef}
              ariaLabel="Tag suggestions"
              activeIndex={highlightIdx}
              onActiveIndexChange={setHighlightIdx}
              options={suggestions.map((t) => ({
                key: t,
                label: t,
                icon: <Tag size={12} strokeWidth={2} />,
                onSelect: () => addTag(t),
              }))}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1.5">PDF file <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center gap-3 justify-center">
                  <FileText size={24} strokeWidth={1.5} className="text-danger shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-muted-foreground hover:text-danger ml-2">
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              ) : resume?.fileUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <CheckCircle2 size={20} strokeWidth={1.5} className="text-success" />
                  <p className="text-sm text-secondary-foreground">File uploaded — click to replace</p>
                </div>
              ) : (
                <>
                  <UploadCloud className="mx-auto mb-2 text-muted-foreground dark:text-secondary-foreground" size={32} strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">Drop PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{resume ? "Save changes" : "Add resume"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
