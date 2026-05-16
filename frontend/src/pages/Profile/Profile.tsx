/** Profile page — single-card, scroll-spy tab layout for the user's master profile.
 *  Right sidebar shows the source-resume preview + quick stats. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { masterProfileAPI, resumesAPI } from "../../utils/api.ts";
import ResumePreview from "../../components/ResumePreview/ResumePreview.tsx";
import EditDrawer, { type SectionKey as EditSectionKey } from "./EditDrawer.tsx";
import type { Resume } from "../../types";

/* ------------------ Types (mirror backend MasterProfile shape) ------------------ */

interface Bullet { text: string; tags: string[] }
interface Experience {
  company: string; role: string; location: string;
  startDate: string; endDate: string; current: boolean;
  bullets: Bullet[];
}
interface Project {
  name: string; url: string; description: string;
  bullets: Bullet[]; technologies: string[];
}
interface Education {
  school: string; degree: string; field: string; location: string;
  startDate: string; endDate: string; gpa: string; highlights: string[];
}
interface SkillGroup { category: string; items: string[] }
interface Certification { name: string; issuer: string; date: string; url: string }
interface Contact {
  fullName: string; email: string; phone: string; location: string;
  linkedin: string; github: string; portfolio: string;
}

interface MasterProfile {
  _id: string;
  contact: Contact;
  summary: string;
  experiences: Experience[];
  projects: Project[];
  education: Education[];
  skills: SkillGroup[];
  certifications: Certification[];
  sourceResumeId: string | null;
  lastParsedAt: string | null;
  lastParsedProvider: string | null;
}

type SectionKey = "personal" | "experience" | "projects" | "education" | "skills" | "certifications";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "certifications", label: "Certifications" },
];

const dateRange = (start: string, end: string, current?: boolean): string => {
  const a = start || "";
  const b = current ? "Present" : (end || "");
  if (!a && !b) return "";
  return `${a} → ${b}`;
};

const stripUrlPrefix = (s: string) => s.replace(/^https?:\/\/(www\.)?/, "");

/* ============================================================== */

export default function Profile() {
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [sourceResume, setSourceResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SectionKey>("personal");
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingSection, setEditingSection] = useState<EditSectionKey | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<SectionKey, HTMLElement | null>>({
    personal: null, experience: null, projects: null, education: null, skills: null, certifications: null,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await masterProfileAPI.get()) as MasterProfile | null;
      setProfile(data);
      if (data?.sourceResumeId) {
        try {
          const all = await resumesAPI.getAll();
          setSourceResume(all.find((r) => r._id === data.sourceResumeId) ?? null);
        } catch { setSourceResume(null); }
      } else {
        setSourceResume(null);
      }
    } catch {
      setProfile(null);
      setSourceResume(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF resumes are supported.");
      return;
    }
    setUploading(true);
    try {
      await toast.promise(
        masterProfileAPI.uploadAndParse(file).then(async () => { await load(); }),
        {
          loading: "Parsing your resume…",
          success: "Profile built.",
          error: (err: { response?: { data?: { error?: string } }; message?: string }) =>
            err?.response?.data?.error || err?.message || "Failed to parse. Check your AI key in Settings.",
        }
      );
    } finally {
      setUploading(false);
    }
  }, [load]);

  // Scroll-spy: which section is currently in view becomes the active tab.
  useEffect(() => {
    if (!profile) return;
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const key = (visible[0].target as HTMLElement).dataset.section as SectionKey | undefined;
          if (key) setActive(key);
        }
      },
      { root, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    SECTIONS.forEach(({ key }) => {
      const node = sectionRefs.current[key];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [profile]);

  const scrollTo = (key: SectionKey) => {
    const node = sectionRefs.current[key];
    if (!node) return;
    setActive(key);
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stats = useMemo(() => {
    if (!profile) return null;
    return {
      experiences: profile.experiences.length,
      projects: profile.projects.length,
      skills: profile.skills.reduce((acc, g) => acc + g.items.length, 0),
      education: profile.education.length,
      certifications: profile.certifications.length,
    };
  }, [profile]);

  /* ---------- empty / loading states ---------- */

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Profile</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Profile</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Upload a resume to build your master profile. We'll extract your experience, projects, education, and skills automatically.
        </p>
        <div
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
            uploading ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/40"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Drop your resume PDF here, or</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-60"
              >
                {uploading ? "Parsing…" : "Choose a PDF"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">PDF only · parsed by your configured AI provider</p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- populated profile ---------- */

  return (
    <div className="profile-page w-full">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Last parsed {profile.lastParsedAt ? new Date(profile.lastParsedAt).toLocaleString() : "—"}
            {profile.lastParsedProvider ? ` · ${profile.lastParsedProvider}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-60"
          title="Replace by parsing a new resume PDF"
        >
          {uploading ? "Parsing…" : "Re-parse from PDF"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* ===== Main card ===== */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Underline tabs */}
          <div className="sticky top-0 z-10 bg-card border-b border-border">
            <nav className="flex gap-1 px-5 overflow-x-auto" role="tablist">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active === s.key}
                  onClick={() => scrollTo(s.key)}
                  className={`relative px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active === s.key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                  <span
                    className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-opacity ${
                      active === s.key ? "bg-primary opacity-100" : "opacity-0"
                    }`}
                  />
                </button>
              ))}
            </nav>
          </div>

          {/* Scrollable body — each section anchored for scroll-spy */}
          <div ref={scrollerRef} className="max-h-[calc(100dvh-220px)] overflow-y-auto px-7 py-6 space-y-10">
            <Section
              id="personal"
              title="Personal"
              refCallback={(el) => { sectionRefs.current.personal = el; }}
              onEdit={() => setEditingSection("personal")}
            >
              <PersonalSection profile={profile} />
            </Section>

            <Section
              id="experience"
              title="Experience"
              refCallback={(el) => { sectionRefs.current.experience = el; }}
              onEdit={() => setEditingSection("experience")}
            >
              <ExperienceSection items={profile.experiences} />
            </Section>

            <Section
              id="projects"
              title="Projects"
              refCallback={(el) => { sectionRefs.current.projects = el; }}
              onEdit={() => setEditingSection("projects")}
            >
              <ProjectsSection items={profile.projects} />
            </Section>

            <Section
              id="education"
              title="Education"
              refCallback={(el) => { sectionRefs.current.education = el; }}
              onEdit={() => setEditingSection("education")}
            >
              <EducationSection items={profile.education} />
            </Section>

            <Section
              id="skills"
              title="Skills"
              refCallback={(el) => { sectionRefs.current.skills = el; }}
              onEdit={() => setEditingSection("skills")}
            >
              <SkillsSection items={profile.skills} />
            </Section>

            <Section
              id="certifications"
              title="Certifications"
              refCallback={(el) => { sectionRefs.current.certifications = el; }}
              onEdit={() => setEditingSection("certifications")}
            >
              <CertsSection items={profile.certifications} />
            </Section>

            <p className="text-[11px] text-muted-foreground pt-6 border-t border-border">
              Edit support + AI-assisted merge across multiple resumes ships next. For now, re-parsing replaces the profile content.
            </p>
          </div>
        </div>

        {/* ===== Right sidebar ===== */}
        <aside className="space-y-4">
          {/* Source resume card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source resume</h3>
            </div>
            {sourceResume ? (
              <div className="px-4 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-14 rounded-md border border-border bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-500">
                      <path d="M12 2H5a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7l-7-5z"/>
                      <polyline points="12 2 12 7 17 7"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{sourceResume.name}</p>
                    {sourceResume.targetRole && <p className="text-xs text-muted-foreground truncate">{sourceResume.targetRole}</p>}
                    {sourceResume.uploadDate && <p className="text-[11px] text-muted-foreground mt-0.5">Uploaded {new Date(sourceResume.uploadDate).toLocaleDateString()}</p>}
                  </div>
                </div>
                {sourceResume.fileUrl && (
                  <button
                    onClick={() => setShowPreview(true)}
                    className="w-full text-xs font-medium px-3 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                  >
                    Preview PDF
                  </button>
                )}
              </div>
            ) : (
              <div className="px-4 pb-4">
                <p className="text-xs text-muted-foreground">No source resume linked. Re-parse from a PDF to attach one.</p>
              </div>
            )}
          </div>

          {/* Stats card */}
          {stats && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">At a glance</h3>
              <ul className="space-y-2 text-sm">
                <StatRow label="Experiences" value={stats.experiences} />
                <StatRow label="Projects" value={stats.projects} />
                <StatRow label="Skills" value={stats.skills} />
                <StatRow label="Education entries" value={stats.education} />
                <StatRow label="Certifications" value={stats.certifications} />
              </ul>
            </div>
          )}

          {/* Future-feature placeholder */}
          <div className="bg-card border border-dashed border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Coming next</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI-assisted merge from multiple resumes, inline edits, and per-section tagging for the resume tailor.
            </p>
          </div>
        </aside>
      </div>

      {showPreview && sourceResume && (
        <ResumePreview
          fileUrl={sourceResume.fileUrl}
          name={sourceResume.name}
          fileName={sourceResume.fileName}
          onClose={() => setShowPreview(false)}
        />
      )}

      {editingSection && (
        <EditDrawer
          section={editingSection}
          profile={profile}
          onClose={() => setEditingSection(null)}
          onSaved={(updated) => setProfile((prev) => prev ? { ...prev, ...updated } : prev)}
        />
      )}
    </div>
  );
}

/* ============================================================== */
/* Section frame                                                  */
/* ============================================================== */

function Section({
  id, title, refCallback, onEdit, children,
}: {
  id: SectionKey;
  title: string;
  refCallback: (el: HTMLElement | null) => void;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={refCallback}
      data-section={id}
      id={`profile-${id}`}
      className="scroll-mt-2"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-primary border border-transparent hover:border-border rounded-md transition-colors"
            aria-label={`Edit ${title}`}
            title={`Edit ${title}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </li>
  );
}

/* ============================================================== */
/* Per-section renderers                                          */
/* ============================================================== */

function Chip({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  if (!label) return null;
  const inner = (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-muted/60 border border-border text-foreground max-w-full transition-colors hover:bg-muted">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="hover:opacity-80 max-w-full">
      {inner}
    </a>
  );
}

function PersonalSection({ profile }: { profile: MasterProfile }) {
  const c = profile.contact;
  const linkHref = (v: string) => v ? (v.startsWith("http") ? v : `https://${v}`) : undefined;
  return (
    <div className="space-y-5">
      {c.fullName && (
        <h3 className="text-3xl font-bold text-foreground tracking-tight">{c.fullName}</h3>
      )}
      <div className="flex flex-wrap gap-2">
        <Chip
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
          label={c.location}
        />
        <Chip
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          label={c.email}
          href={c.email ? `mailto:${c.email}` : undefined}
        />
        <Chip
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
          label={c.phone}
          href={c.phone ? `tel:${c.phone.replace(/[^+0-9]/g, "")}` : undefined}
        />
        <Chip
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 0h-14C2.24 0 0 2.24 0 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5V5c0-2.76-2.24-5-5-5zM8 19H5V8h3v11zM6.5 6.73c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zM20 19h-3v-5.6c0-3.37-4-3.11-4 0V19h-3V8h3v1.76c1.4-2.59 7-2.78 7 2.48V19z"/></svg>}
          label={stripUrlPrefix(c.linkedin)}
          href={linkHref(c.linkedin)}
        />
        <Chip
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.07 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.6.24 2.78.12 3.07.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.35.78 1.04.78 2.1 0 1.52-.01 2.74-.01 3.11 0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>}
          label={stripUrlPrefix(c.github)}
          href={linkHref(c.github)}
        />
        <Chip
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
          label={stripUrlPrefix(c.portfolio)}
          href={linkHref(c.portfolio)}
        />
      </div>
      {profile.summary && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Summary</h3>
          <p className="text-sm text-foreground leading-relaxed">{profile.summary}</p>
        </div>
      )}
    </div>
  );
}

function ExperienceSection({ items }: { items: Experience[] }) {
  if (items.length === 0) return <EmptyMessage label="experience" />;
  return (
    <div className="space-y-6">
      {items.map((exp, i) => (
        <div key={i} className="border-l-2 border-border pl-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{exp.role}</h3>
            <span className="text-xs text-muted-foreground tabular-nums">{dateRange(exp.startDate, exp.endDate, exp.current)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {exp.company}{exp.location ? ` · ${exp.location}` : ""}
          </p>
          {exp.bullets.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {exp.bullets.map((b, j) => (
                <li key={j} className="text-sm text-foreground flex gap-2 leading-relaxed">
                  <span className="text-muted-foreground mt-1.5">•</span>
                  <div className="flex-1">
                    <span>{b.text}</span>
                    {b.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {b.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ProjectsSection({ items }: { items: Project[] }) {
  if (items.length === 0) return <EmptyMessage label="projects" />;
  return (
    <div className="space-y-6">
      {items.map((p, i) => (
        <div key={i} className="border-l-2 border-border pl-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
            {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[260px]">{stripUrlPrefix(p.url)}</a>}
          </div>
          {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
          {p.bullets.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {p.bullets.map((b, j) => (
                <li key={j} className="text-sm text-foreground flex gap-2 leading-relaxed">
                  <span className="text-muted-foreground mt-1.5">•</span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ul>
          )}
          {p.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {p.technologies.map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 bg-muted border border-border rounded text-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EducationSection({ items }: { items: Education[] }) {
  if (items.length === 0) return <EmptyMessage label="education" />;
  return (
    <div className="space-y-6">
      {items.map((e, i) => (
        <div key={i} className="border-l-2 border-border pl-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{e.school}</h3>
            <span className="text-xs text-muted-foreground tabular-nums">{dateRange(e.startDate, e.endDate)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {[e.degree, e.field].filter(Boolean).join(", ")}
            {e.location ? ` · ${e.location}` : ""}
            {e.gpa ? ` · GPA ${e.gpa}` : ""}
          </p>
          {e.highlights.length > 0 && (
            <ul className="mt-2 space-y-1">
              {e.highlights.map((h, j) => (
                <li key={j} className="text-sm text-foreground flex gap-2"><span className="text-muted-foreground mt-1.5">•</span><span>{h}</span></li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function SkillsSection({ items }: { items: SkillGroup[] }) {
  if (items.length === 0) return <EmptyMessage label="skills" />;
  return (
    <div className="space-y-4">
      {items.map((g, i) => (
        <div key={i}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.category}</h3>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 bg-muted border border-border rounded-md text-foreground">{s}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CertsSection({ items }: { items: Certification[] }) {
  if (items.length === 0) return <EmptyMessage label="certifications" />;
  return (
    <div className="space-y-4">
      {items.map((c, i) => (
        <div key={i} className="border-l-2 border-border pl-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
            {c.date && <span className="text-xs text-muted-foreground">{c.date}</span>}
          </div>
          {c.issuer && <p className="text-sm text-muted-foreground">{c.issuer}</p>}
          {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{stripUrlPrefix(c.url)}</a>}
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground py-4">No {label} extracted yet.</p>;
}
