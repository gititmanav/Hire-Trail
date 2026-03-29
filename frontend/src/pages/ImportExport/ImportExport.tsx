/** CSV export with filters; import flows reuse `parseCSV` + bulk application create. */
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { applicationsAPI, contactsAPI } from "../../utils/api.ts";
import { exportToCSV, parseCSV, downloadTemplate } from "../../utils/csv.ts";
import type { Stage, Application, Contact } from "../../types";

const STAGES: Stage[] = ["Applied", "OA", "Interview", "Offer", "Rejected"];

function ExportSection() {
  const [type, setType] = useState<"applications" | "contacts">("applications");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [exporting, setExporting] = useState(false);

  const toggleStage = (s: Stage) => setStages((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (type === "applications") {
        const res = await applicationsAPI.getAll({ limit: 999 });
        let data = res.data;
        if (dateFrom) data = data.filter((a) => new Date(a.applicationDate) >= new Date(dateFrom));
        if (dateTo) data = data.filter((a) => new Date(a.applicationDate) <= new Date(dateTo + "T23:59:59"));
        if (stages.length > 0) data = data.filter((a) => stages.includes(a.stage));
        if (data.length === 0) { toast.error("No applications match your filters"); setExporting(false); return; }
        exportToCSV(data, `hiretrail-applications-${new Date().toISOString().split("T")[0]}.csv`);
        toast.success(`Exported ${data.length} applications`);
      } else {
        const res = await contactsAPI.getAll({ limit: 999 });
        const data = res.data;
        if (data.length === 0) { toast.error("No contacts to export"); setExporting(false); return; }
        // Build CSV manually for contacts
        const rows = data.map((c: Contact) => ({ Name: c.name, Company: c.company, Role: c.role || "", "LinkedIn URL": c.linkedinUrl || "", "Connection Source": c.connectionSource || "", Notes: c.notes || "", "Last Contact": new Date(c.lastContactDate).toLocaleDateString("en-US") }));
        const Papa = await import("papaparse");
        const csv = Papa.default.unparse(rows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `hiretrail-contacts-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        toast.success(`Exported ${data.length} contacts`);
      }
    } catch { toast.error("Export failed"); } finally { setExporting(false); }
  };

  return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-emerald-600 dark:text-emerald-400"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div><h2 className="text-base font-semibold text-gray-900 dark:text-white">Export Data</h2><p className="text-sm text-gray-500 dark:text-gray-400">Download your data as CSV</p></div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Data type</label>
          <div className="flex gap-2">
            {(["applications", "contacts"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${type === t ? "bg-accent-light border-accent text-accent-dark dark:bg-accent/20 dark:border-accent dark:text-accent" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {type === "applications" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From date</label><input type="date" className="input-premium" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">To date</label><input type="date" className="input-premium" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Filter by stage <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s) => (
                  <button key={s} onClick={() => toggleStage(s)} className={`px-3 py-1 text-[13px] font-medium rounded-full border transition-all ${stages.includes(s) ? "bg-accent-light border-accent text-accent-dark dark:bg-accent/20 dark:border-accent dark:text-accent" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300"}`}>{s}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <button onClick={handleExport} disabled={exporting} className="btn-accent w-full justify-center mt-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exporting ? "Exporting..." : `Export ${type}`}
        </button>
      </div>
    </div>
  );
}

function ImportSection({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<"applications" | "contacts">("applications");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === "upload") { setFile(null); setParsed(null); setErrors([]); } }, [step]);

  const handleFile = async (f: File) => {
    setFile(f);
    if (type === "applications") {
      const { data, errors: e } = await parseCSV(f);
      setParsed(data); setErrors(e); setStep("preview");
    } else {
      const Papa = await import("papaparse");
      Papa.default.parse(f, {
        header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim(),
        complete: (results) => {
          const data: any[] = []; const errs: string[] = [];
          results.data.forEach((row: any, i: number) => {
            const name = row["Name"] || row["name"] || ""; const company = row["Company"] || row["company"] || "";
            if (!name.trim()) { errs.push(`Row ${i + 2}: Missing name`); return; }
            if (!company.trim()) { errs.push(`Row ${i + 2}: Missing company`); return; }
            data.push({ name: name.trim(), company: company.trim(), role: (row["Role"] || row["role"] || "").trim(), linkedinUrl: (row["LinkedIn URL"] || row["linkedinUrl"] || "").trim(), connectionSource: (row["Connection Source"] || row["connectionSource"] || "").trim(), notes: (row["Notes"] || row["notes"] || "").trim() });
          });
          setParsed(data); setErrors(errs); setStep("preview");
        }
      });
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    try {
      if (type === "applications") {
        const result = await applicationsAPI.bulkImport(parsed);
        toast.success(result.message);
      } else {
        let count = 0;
        for (const c of parsed) { await contactsAPI.create(c); count++; }
        toast.success(`Imported ${count} contacts`);
      }
      setStep("done"); onDone();
    } catch { setImporting(false); }
  };

  return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-blue-600 dark:text-blue-400"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <div><h2 className="text-base font-semibold text-gray-900 dark:text-white">Import Data</h2><p className="text-sm text-gray-500 dark:text-gray-400">Upload a CSV to bulk-add records</p></div>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Data type</label>
            <div className="flex gap-2">
              {(["applications", "contacts"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${type === t ? "bg-accent-light border-accent text-accent-dark dark:bg-accent/20 dark:border-accent dark:text-accent" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300"}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-8 text-center hover:border-accent dark:hover:border-accent transition-colors cursor-pointer" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) handleFile(f); else toast.error("CSV files only"); }}>
            <svg className="mx-auto mb-3 text-gray-300 dark:text-gray-600" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Drop CSV here or click to browse</p>
            <p className="text-xs text-gray-400">{type === "applications" ? "Company, Role, Stage, Job URL, Application Date, Notes" : "Name, Company, Role, LinkedIn URL, Connection Source, Notes"}</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          {type === "applications" && <button onClick={downloadTemplate} className="text-sm text-accent hover:underline">Download CSV template</button>}
        </div>
      )}

      {step === "preview" && parsed && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">{file?.name}</span>
            <button onClick={() => setStep("upload")} className="text-xs text-accent hover:underline">Change</button>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg p-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">{errors.length} row{errors.length > 1 ? "s" : ""} skipped</p>
              <div className="text-xs text-red-500 max-h-20 overflow-y-auto space-y-0.5">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-success"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
            <span className="text-sm text-gray-700 dark:text-gray-300"><strong>{parsed.length}</strong> {type} ready to import</span>
          </div>

          <div className="max-h-[250px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700"><tr>
                {(type === "applications" ? ["Company", "Role", "Stage"] : ["Name", "Company", "Role"]).map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {parsed.slice(0, 15).map((r, i) => <tr key={i}><td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{r.company || r.name}</td><td className="px-3 py-2 text-gray-500">{r.role || r.company}</td><td className="px-3 py-2 text-gray-400">{r.stage || r.role || ""}</td></tr>)}
              </tbody>
            </table>
            {parsed.length > 15 && <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">...and {parsed.length - 15} more</div>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("upload")} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleImport} disabled={importing || parsed.length === 0} className="btn-accent flex-1 justify-center">{importing ? "Importing..." : `Import ${parsed.length} ${type}`}</button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-8">
          <svg className="mx-auto mb-3 text-success" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Import complete!</h3>
          <p className="text-sm text-gray-500 mb-4">{parsed?.length} {type} added successfully</p>
          <button onClick={() => setStep("upload")} className="btn-secondary">Import more</button>
        </div>
      )}
    </div>
  );
}

export default function ImportExport() {
  return (
    <div className="fade-up max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Import & Export</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Move your data in and out of HireTrail</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExportSection />
        <ImportSection onDone={() => {}} />
      </div>
    </div>
  );
}
