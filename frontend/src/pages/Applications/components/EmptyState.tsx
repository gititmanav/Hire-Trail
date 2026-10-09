/**
 * Empty states for the Applications views:
 *   - "welcome": no applications at all — three ways to add the first one.
 *   - "filtered": applications exist, the search/filters match none.
 *   - "archived": nothing has been archived yet.
 */
import { Archive, Plus, Puzzle, Search, Upload } from "lucide-react";
import Button, { buttonClass } from "../../../components/ui/Button.tsx";
import { CHROME_STORE_URL } from "../../../utils/links.ts";

interface Props {
  mode: "welcome" | "filtered" | "archived";
  onAddManually: () => void;
  onImport: () => void;
  /** Back to every active application: search, filters and the Archived tab cleared. */
  onClearFilters: () => void;
}

function Quiet({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm text-center py-16">
      <div className="mx-auto mb-4 w-11 h-11 rounded-full bg-control flex items-center justify-center text-muted-foreground" aria-hidden>{icon}</div>
      <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-[13.5px] text-muted-foreground leading-relaxed">{body}</p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  );
}

export default function EmptyState({ mode, onAddManually, onImport, onClearFilters }: Props) {
  if (mode === "filtered") {
    return (
      <Quiet
        icon={<Search size={18} strokeWidth={1.8} />}
        title="Nothing matches"
        body="No application fits this search and these filters."
        action={<Button size="sm" onClick={onClearFilters}>Clear search and filters</Button>}
      />
    );
  }
  if (mode === "archived") {
    return (
      <Quiet
        icon={<Archive size={18} strokeWidth={1.8} />}
        title="Nothing archived"
        body="Applications you archive — or close as ghosted — rest here, out of the way. Restore any of them anytime."
        action={<Button size="sm" onClick={onClearFilters}>Back to active</Button>}
      />
    );
  }
  return (
    <div className="mx-auto max-w-lg text-center py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Welcome to HireTrail</p>
      <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-foreground">Track your first application</h2>
      <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
        Add one by hand, or install the browser extension — one click saves the job and its description from LinkedIn, Indeed, Greenhouse, Lever, Glassdoor and Workday.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" size="sm" onClick={onAddManually}><Plus size={14} strokeWidth={2} aria-hidden />Add application</Button>
        <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          <Puzzle size={14} strokeWidth={1.8} aria-hidden />Install the extension
        </a>
        <Button size="sm" onClick={onImport}><Upload size={14} strokeWidth={1.8} aria-hidden />Import CSV</Button>
      </div>
    </div>
  );
}
