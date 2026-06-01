/**
 * Searchable combobox for picking a Company. Free-text typing is allowed —
 * the parent receives both the typed name and the matched companyId (if any).
 * If the user submits with a name that doesn't match anything, the parent
 * passes companyId="" and the backend will find-or-create on save.
 */
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { companiesAPI } from "../../utils/api.ts";
import type { Company } from "../../types";

interface Props {
  name: string;
  companyId: string;
  onChange: (next: { name: string; companyId: string }) => void;
  placeholder?: string;
  required?: boolean;
  inputClassName?: string;
}

export default function CompanyCombobox({
  name,
  companyId,
  onChange,
  placeholder = "Search or add company...",
  required,
  inputClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Outside click closes the menu
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Debounced search whenever the typed name changes and the menu is open
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await companiesAPI.getAll({ search: name.trim(), limit: 8, page: 1 });
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [name, open]);

  const exactMatch = results.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  const showCreateRow = name.trim().length > 0 && !exactMatch;

  const choose = (c: Company) => {
    onChange({ name: c.name, companyId: c._id });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={inputClassName}
        value={name}
        onChange={(e) => {
          // Typing invalidates a previously-picked companyId — server will
          // resolve it on save by name (find-or-create).
          onChange({ name: e.target.value, companyId: "" });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
          )}
          {!loading && results.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => choose(c)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${companyId === c._id ? "text-primary font-medium" : "text-foreground"}`}
            >
              <span className="truncate">{c.name}</span>
              {c.applicationCount ? (
                <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{c.applicationCount} app{c.applicationCount === 1 ? "" : "s"}</span>
              ) : null}
            </button>
          ))}
          {!loading && results.length === 0 && !showCreateRow && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Type to search</div>
          )}
          {showCreateRow && (
            <button
              type="button"
              onClick={() => {
                onChange({ name: name.trim(), companyId: "" });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted border-t border-border flex items-center gap-1.5"
            >
              <Plus size={12} strokeWidth={2} />
              Create "{name.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
