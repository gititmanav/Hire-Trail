/**
 * Searchable combobox for picking a Company. Free-text typing is allowed —
 * the parent receives both the typed name and the matched companyId (if any).
 * If the user submits with a name that doesn't match anything, the parent
 * passes companyId="" and the backend will find-or-create on save.
 * The suggestion list is the shared ui/Combobox list (↑/↓, Enter, Escape).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { companiesAPI } from "../../utils/api.ts";
import { ComboboxList, handleComboboxKey, type ComboboxOption } from "../ui/Combobox.tsx";
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
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const listId = useId();

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

  // New results → no stale keyboard cursor.
  useEffect(() => { setActive(-1); }, [results]);

  const exactMatch = results.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  const showCreateRow = name.trim().length > 0 && !exactMatch;

  const choose = (c: Company) => {
    onChange({ name: c.name, companyId: c._id });
    setOpen(false);
  };

  const options: ComboboxOption[] = loading ? [] : [
    ...results.map((c) => ({
      key: c._id,
      label: c.name,
      current: companyId === c._id,
      hint: c.applicationCount ? `${c.applicationCount} app${c.applicationCount === 1 ? "" : "s"}` : undefined,
      onSelect: () => choose(c),
    })),
    ...(showCreateRow ? [{
      key: "__create",
      label: `Create "${name.trim()}"`,
      icon: <Plus size={13} strokeWidth={2} />,
      tone: "primary" as const,
      dividerBefore: results.length > 0,
      onSelect: () => { onChange({ name: name.trim(), companyId: "" }); setOpen(false); },
    }] : []),
  ];
  const status = loading ? "Searching…" : options.length === 0 ? "Type to search" : undefined;

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
        onKeyDown={(e) => handleComboboxKey(e, {
          open, setOpen, count: options.length, active, setActive, pick: (i) => options[i]?.onSelect(),
        })}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
      />
      <ComboboxList
        open={open}
        onOpenChange={setOpen}
        anchorRef={wrapRef}
        options={options}
        activeIndex={active}
        onActiveIndexChange={setActive}
        status={status}
        ariaLabel="Companies"
        id={listId}
      />
    </div>
  );
}
