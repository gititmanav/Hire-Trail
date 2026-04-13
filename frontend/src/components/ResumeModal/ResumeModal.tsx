/** Shared resume add/edit modal — used by Resumes page and Application form. */
import { useState, useRef, useEffect, useMemo, FormEvent, KeyboardEvent } from "react";
import toast from "react-hot-toast";
import type { Resume } from "../../types";

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
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const h = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);

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
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="card-premium p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">{resume ? "Edit resume" : "New resume version"}</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button>
        </div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave({ name, targetRole, fileName, tags, file }).catch(() => setSaving(false)); }} className="space-y-4">
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Version name *</label><input className="input-premium" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SWE Resume v2" required /></div>
          <div><label className="block text-sm font-medium text-foreground mb-1.5">Target role</label><input className="input-premium" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Software Engineer" /></div>

          {/* Tags input with autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-1.5">Tags</label>
            <div
              className="input-premium flex flex-wrap gap-1.5 min-h-[38px] !py-1.5 cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                  {t}
                  <button type="button" onClick={() => removeTag(i)} className="hover:text-destructive">
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/></svg>
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
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-[160px] overflow-y-auto py-1"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left ${
                      i === highlightIdx
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-foreground shrink-0"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">PDF file <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center gap-3 justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger shrink-0"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><polyline points="13,2 13,9 20,9"/></svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-muted-foreground hover:text-danger ml-2">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>
                  </button>
                </div>
              ) : resume?.fileUrl ? (
                <div className="flex items-center gap-3 justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                  <p className="text-sm text-secondary-foreground">File uploaded — click to replace</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto mb-2 text-muted-foreground dark:text-secondary-foreground" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p className="text-sm text-muted-foreground">Drop PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent disabled:opacity-50">{saving ? "Saving..." : resume ? "Update" : "Add resume"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
