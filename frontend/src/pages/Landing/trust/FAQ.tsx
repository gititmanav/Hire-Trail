/** Questions, answered — a hairline list on the app's Collapse. */
import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import Collapse from "../../../components/ui/Collapse.tsx";
import Reveal from "../engine/Reveal.tsx";

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "Is HireTrail really free?",
    a: "Yes. The web app and the Chrome extension are free, and AI is built in. Prefer your own AI provider? Add your key in Settings and pay them directly — never us.",
  },
  {
    q: "Can HireTrail read or send my email?",
    a: "It asks for read-only access, so it can read messages but never send, edit or delete them. It looks for interview invites, offers and rejections, and you can disconnect whenever you like.",
  },
  {
    q: "Will the AI make things up on my resume?",
    a: "No. It rewrites the experience you already have in the job’s language. Employers, titles and dates stay exactly as you wrote them, it’s told never to invent a number, and you see every change before you download.",
  },
  {
    q: "Which job boards does the extension support?",
    a: "LinkedIn, Indeed, Greenhouse, Lever, Glassdoor and Workday. On any other site you can still save a job by hand.",
  },
  {
    q: "Can I bring my spreadsheet?",
    a: "Yes. Import applications or contacts from a CSV, and export everything as CSV or JSON whenever you like.",
  },
  {
    q: "What happens if I delete my account?",
    a: "Your account and everything in it is deleted immediately, and HireTrail’s access to your inbox is revoked.",
  },
];

function Item({ q, a, id }: { q: string; a: ReactNode; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-black/[0.09]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-6 py-6 text-left text-[hsl(var(--lp-ink))] rounded-md"
      >
        <span className="text-[18px] sm:text-[19px] font-semibold tracking-[-0.015em]">{q}</span>
        <Plus
          size={20}
          strokeWidth={2}
          className={`shrink-0 text-black/45 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
          aria-hidden
        />
      </button>
      <Collapse open={open} id={id}>
        <p className="pb-7 pr-10 text-[16px] leading-relaxed text-[hsl(var(--lp-fog-light))] max-w-[640px]">{a}</p>
      </Collapse>
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="relative bg-white lp-on-light scroll-mt-20" data-lp-tone="light" aria-labelledby="lp-faq-title">
      <div className="max-w-[1180px] mx-auto px-6 pt-[8vh] pb-[16vh] grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16">
        <Reveal>
          <p className="lp-eyebrow text-[hsl(var(--lp-fog-light))]">FAQ</p>
          <h2 id="lp-faq-title" className="lp-h2 mt-2 text-[hsl(var(--lp-ink))]">Questions, answered.</h2>
        </Reveal>
        <Reveal delay={80} className="border-b border-black/[0.09]">
          {FAQS.map((f, i) => <Item key={f.q} q={f.q} a={f.a} id={`lp-faq-${i}`} />)}
        </Reveal>
      </div>
    </section>
  );
}
