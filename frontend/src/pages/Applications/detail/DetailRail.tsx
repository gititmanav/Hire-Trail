/** Right rail of the application page: properties (Linear-style key/value
 *  rows), upcoming deadlines, and the stage timeline. */
import { ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import { STAGE_STRIPE_CLASS } from "../../../utils/stageStyles.ts";
import StageMenu from "../components/StageMenu.tsx";
import { useApplicationDeadlines, useContacts, useResumes } from "../data/queries.ts";
import type { Application, Resume, Stage } from "../../../types";

const SOURCE_LABEL: Record<string, string> = { manual: "Added manually", extension: "Browser extension", email: "Inbox scan" };
const DAY = 86_400_000;

function fmtDate(iso: string, withYear = true): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}

function relativeDue(iso: string): { text: string; tone: string } {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const due = new Date(iso); due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - start.getTime()) / DAY);
  if (days < 0) return { text: `${-days}d overdue`, tone: "text-red-600 dark:text-red-400" };
  if (days === 0) return { text: "Today", tone: "text-amber-700 dark:text-amber-400" };
  if (days === 1) return { text: "Tomorrow", tone: "text-amber-700 dark:text-amber-400" };
  return { text: `in ${days}d`, tone: "text-muted-foreground" };
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 min-h-8">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="text-[13px] text-foreground min-w-0 truncate">{children}</dd>
    </div>
  );
}

const Empty = () => <span className="text-muted-foreground/60">—</span>;

export default function DetailRail({ app, onMove, onPreviewResume }: {
  app: Application;
  onMove: (app: Application, stage: Stage) => void;
  onPreviewResume: (r: Resume) => void;
}) {
  const { data: resumes = [] } = useResumes();
  const { data: contacts = [] } = useContacts();
  const { data: deadlines = [], isPending: deadlinesPending } = useApplicationDeadlines(app._id);

  const resume = resumes.find((r) => r._id === app.resumeId);
  const contact = contacts.find((c) => c._id === app.contactId);
  const companyContacts = useMemo(() => {
    const company = app.company.trim().toLowerCase();
    return contacts.filter((c) => c._id !== app.contactId && (c.applicationIds?.includes(app._id) || (company && c.company.trim().toLowerCase() === company)));
  }, [contacts, app]);

  /** Timeline with time spent in each stage (last entry runs to today). */
  const timeline = useMemo(() => {
    const h = app.stageHistory?.length ? app.stageHistory : [{ stage: app.stage, date: app.applicationDate }];
    return h.map((e, i) => {
      const end = i + 1 < h.length ? new Date(h[i + 1].date) : new Date();
      const days = Math.max(0, Math.round((end.getTime() - new Date(e.date).getTime()) / DAY));
      return { ...e, days, current: i === h.length - 1 };
    }).reverse();
  }, [app.stageHistory, app.stage, app.applicationDate]);

  return (
    <div className="space-y-4">
      <Card title="Details">
        <dl className="space-y-0.5">
          <Prop label="Stage"><StageMenu app={app} onMove={onMove} /></Prop>
          <Prop label="Applied">{fmtDate(app.applicationDate)}</Prop>
          <Prop label="Source">{SOURCE_LABEL[app.source ?? "manual"] ?? "Added manually"}</Prop>
          <Prop label="Location">{app.location?.trim() || <Empty />}</Prop>
          <Prop label="Salary">{app.salary?.trim() || <Empty />}</Prop>
          <Prop label="Job type">{app.jobType?.trim() || <Empty />}</Prop>
          <Prop label="Resume">
            {resume ? (
              resume.fileUrl ? (
                <button type="button" onClick={() => onPreviewResume(resume)} className="inline-flex items-center gap-1.5 max-w-full hover:underline underline-offset-2">
                  <FileText size={13} strokeWidth={1.8} className="text-muted-foreground shrink-0" aria-hidden />
                  <span className="truncate">{resume.name}</span>
                </button>
              ) : <span className="truncate">{resume.name}</span>
            ) : <Empty />}
          </Prop>
          <Prop label="Contact">
            {contact ? <span className="truncate">{contact.name}{contact.role ? <span className="text-muted-foreground"> · {contact.role}</span> : null}</span> : <Empty />}
          </Prop>
          {app.jobUrl && (
            <Prop label="Posting">
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2">
                Open posting <ExternalLink size={12} strokeWidth={2} aria-hidden />
              </a>
            </Prop>
          )}
        </dl>
      </Card>

      <Card title="Upcoming deadlines" action={<Link to="/deadlines" className="text-[12px] font-medium text-muted-foreground hover:text-foreground">Manage</Link>}>
        {deadlinesPending ? (
          <div className="space-y-2" aria-hidden><div className="h-4 w-3/4 rounded bg-muted animate-pulse" /><div className="h-4 w-1/2 rounded bg-muted animate-pulse" /></div>
        ) : deadlines.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nothing due for this application.</p>
        ) : (
          <ul className="space-y-2">
            {deadlines.map((d) => {
              const rel = relativeDue(d.dueDate);
              return (
                <li key={d._id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-foreground truncate">{d.type}</span>
                  <span className="shrink-0 tabular-nums text-right">
                    <span className="text-foreground/80">{fmtDate(d.dueDate, false)}</span>
                    <span className={`ml-1.5 text-[12px] ${rel.tone}`}>{rel.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Timeline">
        <ol className="relative">
          {timeline.map((e, i) => (
            <li key={`${e.stage}-${e.date}-${i}`} className="relative pl-5 pb-3 last:pb-0">
              {i < timeline.length - 1 && <span className="absolute left-[4.5px] top-3 bottom-0 w-px bg-border" aria-hidden />}
              <span className={`absolute left-0 top-[5px] w-2.5 h-2.5 rounded-full ring-2 ring-card ${STAGE_STRIPE_CLASS[e.stage as Stage]}`} aria-hidden />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-foreground">{e.stage}</span>
                <span className="text-[12px] text-muted-foreground tabular-nums">{fmtDate(e.date)}</span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {e.current ? `${e.days === 0 ? "Today" : `${e.days} day${e.days === 1 ? "" : "s"}`} so far` : `${e.days} day${e.days === 1 ? "" : "s"}`}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      {companyContacts.length > 0 && (
        <Card title={`People at ${app.company}`} action={<Link to="/contacts" className="text-[12px] font-medium text-muted-foreground hover:text-foreground">Contacts</Link>}>
          <ul className="space-y-2">
            {companyContacts.slice(0, 4).map((c) => (
              <li key={c._id} className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">{c.name[0]}</span>
                <span className="min-w-0 text-[13px] truncate">{c.name}{c.role && <span className="text-muted-foreground"> · {c.role}</span>}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
