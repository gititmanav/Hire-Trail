/** Paginated contact cards with client-side search across the current page. */
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ExternalLink, Mail, MoreHorizontal, Pencil, PenLine, Puzzle, Send, Star, Trash2 } from "lucide-react";
import toast from "../../components/ui/toast.ts";
import { contactsAPI, companiesAPI } from "../../utils/api.ts";
import CompanyLogo from "../../components/CompanyLogo/CompanyLogo.tsx";
import { SkeletonCard } from "../../components/Skeleton/Skeleton.tsx";
import EmptyState from "../../components/EmptyState/EmptyState.tsx";
import Menu from "../../components/ui/Menu.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.tsx";
import CompanyCombobox from "../../components/CompanyCombobox/CompanyCombobox.tsx";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "../../components/ui/Modal.tsx";
import { Field, TextField, Textarea } from "../../components/ui/Field.tsx";
import Select from "../../components/ui/Select.tsx";
import DateInput from "../../components/ui/DateInput.tsx";
import Button from "../../components/ui/Button.tsx";
import PageHeader, { CreateButton, PageBody, PageSearch, type PageSearchHandle } from "../../components/ui/PageHeader.tsx";
import FiltersPopover, { ANY_DOT, FilterRow } from "../../components/ui/FiltersPopover.tsx";
import SegmentedControl from "../../components/ui/SegmentedControl.tsx";
import Pagination from "../../components/ui/Pagination.tsx";
import { useConfirm } from "../../hooks/useConfirm.ts";
import { usePageShortcuts } from "../../hooks/usePageShortcuts.ts";
import { usePersistentState, oneOf } from "../../hooks/usePersistentState.ts";
import { contactStrength } from "../../utils/contactStrength.ts";
import { OUTREACH_TEMPLATES, renderOutreachTemplate, templateToClipboard } from "../../utils/outreachTemplates.ts";
import type { Contact, ContactFormData, ContactOutreachStatus, ContactSource, Pagination as PageInfo } from "../../types";

const SOURCES = ["Cold email", "Referral", "Career fair", "LinkedIn", "Professor intro", "Alumni network", "Other"];
const OUTREACH_STATUSES: { value: ContactOutreachStatus; label: string }[] = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "reached_out", label: "Reached out" },
  { value: "responded", label: "Responded" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "gone_cold", label: "Gone cold" },
];
const OUTREACH_COLORS: Record<ContactOutreachStatus, string> = {
  not_contacted: "bg-muted text-muted-foreground",
  reached_out: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  responded: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  meeting_scheduled: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  follow_up_needed: "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  gone_cold: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};
/** The status's colour as a dot (Filters, like a stage's). */
const OUTREACH_DOT: Record<ContactOutreachStatus, string> = {
  not_contacted: "bg-muted-foreground/40",
  reached_out: "bg-blue-500",
  responded: "bg-green-500",
  meeting_scheduled: "bg-purple-500",
  follow_up_needed: "bg-orange-500",
  gone_cold: "bg-red-500",
};
const SOURCE_FILTERS: { value: ContactSource; label: string; icon: React.ReactNode }[] = [
  { value: "manual", label: "Added manually", icon: <PenLine size={14} strokeWidth={1.8} className="text-muted-foreground" /> },
  { value: "extension", label: "Browser extension", icon: <Puzzle size={14} strokeWidth={1.8} className="text-muted-foreground" /> },
  { value: "email", label: "Inbox scan", icon: <Mail size={14} strokeWidth={1.8} className="text-muted-foreground" /> },
];
type GroupBy = "person" | "company";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
const btnIcon = "w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted";

function needsFollowUp(c: Contact): boolean {
  if (c.nextFollowUpDate) {
    const due = new Date(c.nextFollowUpDate); due.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (due.getTime() <= now.getTime()) return true;
  }
  if (c.outreachStatus === "reached_out" && c.lastOutreachDate) {
    if (Date.now() - new Date(c.lastOutreachDate).getTime() > 7 * 86400000) return true;
  }
  return false;
}

function ContactFormModal({ contact, onSave, onClose }: { contact: Contact | null; onSave: (d: ContactFormData) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<ContactFormData>({
    name: contact?.name || "", company: contact?.company || "", role: contact?.role || "",
    linkedinUrl: contact?.linkedinUrl || "", connectionSource: contact?.connectionSource || "", notes: contact?.notes || "",
    companyId: contact?.companyId || "", applicationIds: contact?.applicationIds || [],
    outreachStatus: contact?.outreachStatus || "not_contacted",
    nextFollowUpDate: contact?.nextFollowUpDate ? contact.nextFollowUpDate.split("T")[0] : "",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <Modal onClose={onClose} size="md" ariaLabel={contact ? "Edit contact" : "New contact"}>
      <ModalHeader
        title={contact ? "Edit contact" : "New contact"}
        description="Recruiters, referrers, and people you're networking with."
        onClose={onClose}
      />
      <form className="flex flex-col min-h-0" onSubmit={(e: FormEvent) => { e.preventDefault(); setSaving(true); onSave(form).catch(() => setSaving(false)); }}>
        <ModalBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Name" required value={form.name} onChange={(e) => u("name", e.target.value)} placeholder="e.g. Priya Sharma" data-autofocus />
            <Field label="Company" required>
              <CompanyCombobox
                name={form.company}
                companyId={form.companyId}
                onChange={({ name, companyId }) => setForm({ ...form, company: name, companyId })}
                required
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Role" value={form.role} onChange={(e) => u("role", e.target.value)} placeholder="e.g. Recruiter" />
            <Field label="How connected">
              <Select
                value={form.connectionSource || ""}
                onChange={(v) => u("connectionSource", v)}
                ariaLabel="How connected"
                placeholder="Select a source"
                searchable
                searchPlaceholder="Search sources…"
                options={[
                  { value: "", label: "None" },
                  ...SOURCES.map((s) => ({ value: s, label: s })),
                ]}
              />
            </Field>
          </div>
          <TextField label="LinkedIn URL" type="url" value={form.linkedinUrl} onChange={(e) => u("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/…" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Outreach status">
              <Select
                value={form.outreachStatus || "not_contacted"}
                onChange={(v) => u("outreachStatus", v)}
                ariaLabel="Outreach status"
                options={OUTREACH_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </Field>
            <Field label="Follow-up date">
              <DateInput value={form.nextFollowUpDate || ""} onChange={(v) => u("nextFollowUpDate", v)} ariaLabel="Follow-up date" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => u("notes", e.target.value)} placeholder="Where you met, what you talked about…" />
          </Field>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{contact ? "Save changes" : "Add contact"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}


/** Strength score chip with tier-tinted background. Tooltip surfaces the
 *  factor breakdown so the user trusts the number. */
function ContactStrengthChip({ contact }: { contact: Contact }) {
  const s = contactStrength(contact);
  const tone =
    s.tier === "strong" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : s.tier === "warm" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
    : "bg-muted text-muted-foreground";
  const title = [
    `Strength: ${s.score} (${s.tier})`,
    `Recency: ${s.factors.recency}`,
    `Outreach: ${s.factors.outreach}`,
    `LinkedIn: ${s.factors.linkedin}`,
    `Introductions: ${s.factors.introductions}`,
  ].join(" · ");
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${tone}`}
      title={title}
      aria-label={`Contact strength ${s.score} of 100`}
    >
      <Star size={9} fill="currentColor" strokeWidth={0} aria-hidden />
      {s.score}
    </span>
  );
}

function OutreachBadge({ status }: { status: ContactOutreachStatus }) {
  const label = OUTREACH_STATUSES.find((s) => s.value === status)?.label || status;
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${OUTREACH_COLORS[status] || OUTREACH_COLORS.not_contacted}`}>{label}</span>;
}

/** Days-since-last-contact in whole days. >= 0 except when lastContactDate is
 *  missing (returns null). Used by the row age chip + the follow-up nudge. */
function daysSinceLastContact(c: Contact, now: Date = new Date()): number | null {
  if (!c.lastContactDate) return null;
  const ms = now.getTime() - new Date(c.lastContactDate).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Quick visual urgency tone for the age chip — colored like the
 *  Applications page's health tones for visual consistency. */
function ageToneClass(days: number | null, outreach: ContactOutreachStatus): string {
  // Don't paint the chip red just because a "gone cold" / "responded" status
  // shows old days — the status carries the signal.
  if (days == null) return "bg-muted text-muted-foreground";
  if (outreach === "responded" || outreach === "meeting_scheduled") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (days <= 7)  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (days <= 21) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (days <= 60) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
}

/** Row redesign: horizontal layout mirroring the Applications page. Monogram
 *  avatar → name + role @ company + outreach badge + connection-source chip
 *  + days-since-last-contact age chip + "Send follow-up →" CTA → hover toolbar.
 *  Notes collapse inline so a 5-line note doesn't break the row rhythm. */
function ContactCard({ c, onEdit, onDelete, companyLogoUrl }: { c: Contact; onEdit: () => void; onDelete: () => void; companyLogoUrl?: string }) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const hasLongNotes = c.notes && c.notes.length > 80;
  const days = daysSinceLastContact(c);
  const ageLabel = days == null
    ? "—"
    : days === 0 ? "today"
    : days === 1 ? "1d"
    : days < 30  ? `${days}d`
    : days < 365 ? `${Math.round(days / 30)}mo`
    : `${Math.round(days / 365)}y`;

  const copyTemplate = async (key: (typeof OUTREACH_TEMPLATES)[number]["key"], label: string) => {
    const text = templateToClipboard(renderOutreachTemplate(key, c));
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied — paste into your email client.`);
    } catch {
      toast.error("Couldn't access the clipboard — try again or paste manually.");
    }
  };

  // Layout by the card's own width (App.css "Contact cards"): one line when
  // wide; on a phone the details drop into a footer and the tools fold into ⋯.
  return (
    <div className="contact-card bg-card border border-border rounded-xl px-4 py-3 group min-w-0">
      <div className="contact-card-row">
        <div className="w-10 h-10 rounded-full bg-muted text-secondary-foreground flex items-center justify-center text-[13px] font-semibold shrink-0">
          {ini(c.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="text-[14px] font-semibold text-foreground truncate">{c.name}</h3>
            {c.outreachStatus && <OutreachBadge status={c.outreachStatus} />}
            {c.connectionSource && (
              <span className="hidden sm:inline-block text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{c.connectionSource}</span>
            )}
            {c.source === "extension" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                via extension
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            {c.company && <CompanyLogo size="xs" name={c.company} logoUrl={companyLogoUrl} />}
            <p className="text-[12.5px] text-muted-foreground truncate">
              {c.role ? `${c.role} at ` : ""}{c.company}
            </p>
          </div>
          {c.notes && (
            <div className="mt-0.5">
              <p className={`text-[11.5px] text-muted-foreground/85 italic ${notesExpanded ? "" : "line-clamp-1"}`}>{c.notes}</p>
              {hasLongNotes && (
                <button onClick={() => setNotesExpanded(!notesExpanded)} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                  {notesExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="contact-card-side">
          {/* Strength chip — small 0-100 score with tier-tinted background.
           *  Tooltip exposes the factor breakdown so the user understands the
           *  number rather than seeing a magic value. */}
          <ContactStrengthChip contact={c} />
          {/* Age chip + follow-up date */}
          <div className="contact-card-age shrink-0">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ageToneClass(days, c.outreachStatus)}`}
              title={days == null ? "No last-contact date" : `${days} days since last contact`}
            >
              {ageLabel}
            </span>
            {c.nextFollowUpDate && (
              <span className={`text-[10.5px] tabular-nums ${needsFollowUp(c) ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
                Follow up: {fmt(c.nextFollowUpDate)}
              </span>
            )}
          </div>
          <div className="contact-card-end">
            {/* "Send follow-up →" CTA: prominent for any contact that owes a touch,
             *  otherwise tucked under hover so it doesn't compete with the data. */}
            {needsFollowUp(c) ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-[11px] font-medium text-primary hover:underline shrink-0"
                title="Open this contact to log a follow-up"
              >
                Send follow-up →
              </button>
            ) : null}
            {/* Action toolbar — Outreach + LinkedIn + Edit + Delete. Revealed on
             *  hover; always shown where there is no hover (touch). */}
            <div className="contact-card-tools gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity shrink-0">
              {/* Outreach templates: pick one → email is rendered with the
               *  contact's name/role/company filled in and copied to clipboard. */}
              <Menu
                ariaLabel="Outreach templates"
                align="end"
                width={224}
                trigger={
                  <button type="button" className={btnIcon} title="Outreach templates" aria-label="Outreach templates">
                    <Send size={14} strokeWidth={1.6} aria-hidden />
                  </button>
                }
                items={OUTREACH_TEMPLATES.map((tpl) => ({ label: tpl.label, onSelect: () => void copyTemplate(tpl.key, tpl.label) }))}
              />
              {c.linkedinUrl ? (
                <a
                  href={c.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btnIcon} !text-[#0a66c2] hover:!text-[#004182]`}
                  title="Open LinkedIn profile"
                  aria-label="Open LinkedIn profile"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.06 2.06 0 01-2.06-2.07 2.06 2.06 0 014.13 0 2.07 2.07 0 01-2.07 2.07zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z" />
                  </svg>
                </a>
              ) : (
                <span className={`${btnIcon} opacity-40 cursor-not-allowed`} title="No LinkedIn URL — add one via Edit" aria-label="LinkedIn unavailable">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.06 2.06 0 01-2.06-2.07 2.06 2.06 0 014.13 0 2.07 2.07 0 01-2.07 2.07zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z" />
                  </svg>
                </span>
              )}
              <button className={btnIcon} onClick={onEdit} aria-label="Edit contact">
                <Pencil size={14} strokeWidth={1.5} aria-hidden />
              </button>
              <button className={`${btnIcon} !text-danger`} onClick={onDelete} aria-label="Delete contact">
                <Trash2 size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            {/* The same tools in one menu, for a narrow card. */}
            <span className="contact-card-more">
              <Menu
                ariaLabel={`Actions for ${c.name}`}
                align="end"
                width={232}
                trigger={
                  <button type="button" className={btnIcon} aria-label={`Actions for ${c.name}`}>
                    <MoreHorizontal size={15} strokeWidth={1.8} aria-hidden />
                  </button>
                }
                items={[
                  { label: "Edit contact", icon: <Pencil size={14} strokeWidth={1.6} />, onSelect: onEdit },
                  ...(c.linkedinUrl
                    ? [{ label: "Open LinkedIn", icon: <ExternalLink size={14} strokeWidth={1.6} />, onSelect: () => { window.open(c.linkedinUrl, "_blank", "noopener,noreferrer"); } }]
                    : []),
                  ...OUTREACH_TEMPLATES.map((tpl, i) => ({
                    label: tpl.label,
                    icon: <Send size={14} strokeWidth={1.6} />,
                    heading: i === 0 ? "Copy an outreach email" : undefined,
                    dividerBefore: i === 0,
                    onSelect: () => void copyTemplate(tpl.key, tpl.label),
                  })),
                  { label: "Delete contact", icon: <Trash2 size={14} strokeWidth={1.6} />, destructive: true, dividerBefore: true, onSelect: onDelete },
                ]}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  // Search and filters run on the server, over every contact (not just this page).
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ContactOutreachStatus>("");
  const [sourceFilter, setSourceFilter] = useState<"" | ContactSource>("");
  const [statusCounts, setStatusCounts] = useState<Partial<Record<ContactOutreachStatus, number>>>({});
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState<PageInfo>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [groupBy, setGroupBy] = usePersistentState<GroupBy>("hiretrail-contacts-group", "person", oneOf<GroupBy>(["person", "company"]));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<PageSearchHandle>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const { confirm: confirmDelete, confirmState, handleConfirm: onConfirm, handleCancel: onCancel } = useConfirm();

  const fetchContacts = useCallback(async () => {
    try {
      const res = await contactsAPI.getAll({
        page,
        limit: 20,
        ...(sourceFilter ? { source: sourceFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });
      setContacts(res.data);
      setPag(res.pagination);
      if (res.statusCounts) setStatusCounts(res.statusCounts);
    } catch {} finally { setLoading(false); }
  }, [page, sourceFilter, statusFilter, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Company logos for contact cards/headers, keyed by lowercased company name.
  // Fetched once — the company graph is small and doesn't change per page.
  const [companyLogos, setCompanyLogos] = useState<Record<string, string>>({});
  useEffect(() => {
    companiesAPI.getAll({ limit: 500 }).then((res) => {
      const map: Record<string, string> = {};
      for (const co of res.data) {
        if (co.logoUrl) map[co.name.trim().toLowerCase()] = co.logoUrl;
      }
      setCompanyLogos(map);
    }).catch(() => {});
  }, []);
  const logoFor = useCallback((name?: string) => companyLogos[(name || "").trim().toLowerCase()] || "", [companyLogos]);

  /* ─── Shortcut deep-link: `?new=1` opens the create modal and strips the
   *  param so a hard reload doesn't reopen it. */
  const handledNewRef = useRef(false);
  useEffect(() => {
    if (handledNewRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") === "1") {
      handledNewRef.current = true;
      setEditing(null);
      setModal(true);
      sp.delete("new");
      const q = sp.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
  }, []);

  /* ─── Global search deep-link: `?focus=ID` opens the edit modal for that
   *  contact. Fires once per ID; ?focus is stripped on open. Falls back to a
   *  single-record fetch when the contact isn't in the current page. */
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId) { focusedRef.current = null; return; }
    if (focusedRef.current === focusId) return;
    if (contacts.length === 0) return;
    const target = contacts.find((c) => c._id === focusId);
    const open = (contact: Contact) => {
      focusedRef.current = focusId;
      setEditing(contact);
      setModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    };
    if (target) { open(target); return; }
    let cancelled = false;
    void contactsAPI.getOne(focusId).then((fetched) => {
      if (cancelled || !fetched) return;
      open(fetched);
    }).catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [contacts, searchParams, setSearchParams]);

  const save = async (d: ContactFormData) => {
    if (editing) { await contactsAPI.update(editing._id, d); toast.success("Updated"); }
    else { await contactsAPI.create(d); toast.success("Added"); }
    setModal(false); setEditing(null); await fetchContacts();
  };
  const handleDelete = async (id: string) => {
    const ok = await confirmDelete("This contact will be permanently deleted.", { title: "Delete contact?", confirmLabel: "Delete" });
    if (!ok) return;
    await contactsAPI.delete(id);
    toast.success("Deleted");
    await fetchContacts();
  };

  const create = () => { setEditing(null); setModal(true); };
  const filterBy = (patch: { status?: "" | ContactOutreachStatus; source?: "" | ContactSource; search?: string }) => {
    setPage(1);
    if (patch.status !== undefined) setStatusFilter(patch.status);
    if (patch.source !== undefined) setSourceFilter(patch.source);
    if (patch.search !== undefined) setSearch(patch.search);
  };
  const activeFilters = (statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0);
  const filtering = activeFilters > 0 || !!search;
  const clearFilters = () => filterBy({ status: "", source: "", search: "" });

  usePageShortcuts({
    "/": () => searchRef.current?.focus(),
    f: () => setFiltersOpen(true),
    c: create,
  });

  const header = (
    <PageHeader
      title="Contacts"
      meta={loading ? undefined : `${pag.total} ${filtering ? "found" : pag.total === 1 ? "contact" : "contacts"}`}
      actions={
        <>
          <PageSearch ref={searchRef} value={search} onChange={(q) => filterBy({ search: q })} placeholder="Search contacts" ariaLabel="Search contacts by name or company" />
          <FiltersPopover
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            active={activeFilters}
            canReset={activeFilters > 0 || groupBy !== "person"}
            onReset={() => { filterBy({ status: "", source: "" }); setGroupBy("person"); }}
            filters={
              <>
                <FilterRow label="Status">
                  <Select
                    variant="pill"
                    ariaLabel="Status"
                    value={statusFilter}
                    onChange={(v) => filterBy({ status: v as "" | ContactOutreachStatus })}
                    options={[
                      { value: "", label: "Any status", icon: ANY_DOT },
                      ...OUTREACH_STATUSES.map((st) => ({
                        value: st.value,
                        label: `${st.label} · ${statusCounts[st.value] ?? 0}`,
                        icon: <span className={`w-2 h-2 rounded-full ${OUTREACH_DOT[st.value]}`} />,
                      })),
                    ]}
                  />
                </FilterRow>
                <FilterRow label="Source">
                  <Select
                    variant="pill"
                    ariaLabel="Source"
                    value={sourceFilter}
                    onChange={(v) => filterBy({ source: v as "" | ContactSource })}
                    options={[{ value: "", label: "Any source", icon: ANY_DOT }, ...SOURCE_FILTERS]}
                  />
                </FilterRow>
              </>
            }
            display={
              <FilterRow label="Group by">
                <SegmentedControl<GroupBy>
                  ariaLabel="Group by"
                  size="sm"
                  value={groupBy}
                  onChange={setGroupBy}
                  segments={[{ value: "person", label: "Person" }, { value: "company", label: "Company" }]}
                />
              </FilterRow>
            }
          />
          <CreateButton onClick={create} label="New contact" />
        </>
      }
    />
  );

  if (loading) {
    return (
      <div>
        {header}
        <PageBody className="space-y-2">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</PageBody>
      </div>
    );
  }

  return (
    <div>
      {header}
      <PageBody>
        {contacts.length === 0 ? (
          !filtering ? (
            <EmptyState
              intent="welcome"
              title="Build your network here"
              description="Add recruiters, referrers, and hiring managers you've reached out to. Track outreach status and follow-up timing so nothing slips."
              actions={[
                { label: "Add contact", variant: "primary", onClick: create },
                { label: "Install extension", variant: "secondary", href: "/" },
              ]}
            />
          ) : (
            <EmptyState
              intent="filtered"
              title="No contacts match these filters"
              description="Try clearing your search or the filters."
              actions={[{ label: "Clear filters", variant: "secondary", onClick: clearFilters }]}
            />
          )
        ) : groupBy === "person" ? (
          <>
            <div className="space-y-2">
              {contacts.map((c) => <ContactCard key={c._id} c={c} companyLogoUrl={logoFor(c.company)} onEdit={() => { setEditing(c); setModal(true); }} onDelete={() => handleDelete(c._id)} />)}
            </div>
            <Pagination page={page} pag={pag} onPage={setPage} className="mt-4" />
          </>
        ) : (
          <>
            <div className="space-y-3">
              {Object.entries(
                contacts.reduce<Record<string, Contact[]>>((acc, c) => {
                  const key = c.company || "Unknown";
                  (acc[key] = acc[key] || []).push(c);
                  return acc;
                }, {})
              )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([company, companyContacts]) => {
                  const isExpanded = expandedCompanies.has(company);
                  const hasFollowUp = companyContacts.some(needsFollowUp);
                  return (
                    <div key={company} className="bg-card border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedCompanies((prev) => {
                          const next = new Set(prev);
                          if (next.has(company)) next.delete(company); else next.add(company);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <ChevronRight size={16} strokeWidth={1.5} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          <CompanyLogo size="sm" name={company} logoUrl={logoFor(company)} />
                          <span className="text-[15px] font-semibold text-foreground">{company}</span>
                          <span className="text-xs text-muted-foreground font-medium">{companyContacts.length} contact{companyContacts.length !== 1 ? "s" : ""}</span>
                          {hasFollowUp && <span className="w-2 h-2 rounded-full bg-orange-400" title="Has contacts needing follow-up" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border p-3 space-y-2">
                          {companyContacts.map((c) => <ContactCard key={c._id} c={c} companyLogoUrl={logoFor(c.company)} onEdit={() => { setEditing(c); setModal(true); }} onDelete={() => handleDelete(c._id)} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <Pagination page={page} pag={pag} onPage={setPage} className="mt-4" />
          </>
        )}
      </PageBody>

      {modal && <ContactFormModal contact={editing} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}
      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}