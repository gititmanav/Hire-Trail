import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { parseCSV, downloadTemplate, type CSVRow } from "../../utils/csv.ts";
import { applicationsAPI } from "../../utils/api.ts";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<CSVRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleFile = async (f: File) => {
    setFile(f);
    const { data, errors: parseErrors } = await parseCSV(f);
    setParsed(data);
    setErrors(parseErrors);
    setStep("preview");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      handleFile(f);
    } else {
      toast.error("Please drop a CSV file");
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    try {
      const result = await applicationsAPI.bulkImport(parsed);
      toast.success(result.message);
      setStep("done");
      onImported();
    } catch {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 w-full max-w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Import Applications</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg>
          </button>
        </div>

        {step === "upload" && (
          <>
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-primary dark:hover:border-primary cursor-pointer"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <svg className="mx-auto mb-3 text-muted-foreground" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-sm font-medium text-foreground mb-1">
                Drop your CSV here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Columns: Company, Role, Job URL, Stage, Application Date, Notes
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={downloadTemplate}
                className="text-sm text-primary hover:underline"
              >
                Download CSV template
              </button>
            </div>
          </>
        )}

        {step === "preview" && parsed && (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
                  </svg>
                  <span className="text-secondary-foreground">{file?.name}</span>
                </div>
                <button onClick={() => { setStep("upload"); setParsed(null); setErrors([]); setFile(null); }} className="text-xs text-primary hover:underline">
                  Change file
                </button>
              </div>

              {errors.length > 0 && (
                <div className="bg-danger-light dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                    {errors.length} row{errors.length > 1 ? "s" : ""} skipped:
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5 max-h-24 overflow-y-auto">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
                <span className="text-sm text-foreground">
                  <strong>{parsed.length}</strong> application{parsed.length !== 1 ? "s" : ""} ready to import
                </span>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Company</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsed.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-foreground font-medium">{row.company}</td>
                      <td className="px-3 py-2 text-secondary-foreground">{row.role}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 20 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                  ...and {parsed.length - 20} more
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || parsed.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import ${parsed.length} applications`}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <svg className="mx-auto mb-3 text-success" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
            <h3 className="text-lg font-semibold text-foreground mb-1">Import complete!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {parsed?.length} applications have been added to your tracker
            </p>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}