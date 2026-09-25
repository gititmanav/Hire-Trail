/** "Why people switch." — a quiet, typographic comparison. The middle column
 *  describes trackers in general, so it stays general. Phones get the same
 *  rows stacked (each feature over its three answers) instead of a table
 *  that scrolls sideways. */
import { Check, Minus } from "lucide-react";
import Reveal from "../engine/Reveal.tsx";

type Cell = true | false | string;
const COLUMNS = ["A spreadsheet", "A typical tracker", "HireTrail"] as const;
const ROWS: { label: string; sheet: Cell; tracker: Cell; us: Cell }[] = [
  { label: "Tailors your resume to each job", sheet: false, tracker: "Often a paid plan", us: "Included" },
  { label: "Updates from your inbox", sheet: false, tracker: "Rarely", us: "You confirm each change" },
  { label: "Saves jobs in one click", sheet: false, tracker: true, us: "Six job boards" },
  { label: "Your choice of AI", sheet: false, tracker: false, us: "40+ providers" },
  { label: "Open source", sheet: false, tracker: false, us: true },
  { label: "Price", sheet: "Free", tracker: "Freemium", us: "Free" },
];

function Value({ v, strong }: { v: Cell; strong?: boolean }) {
  if (v === true) return <Check size={18} strokeWidth={2.4} className={strong ? "text-[hsl(var(--lp-ink))]" : "text-black/45"} aria-label="Yes" />;
  if (v === false) return <Minus size={18} strokeWidth={2} className="text-black/20" aria-label="No" />;
  return <span className={strong ? "font-semibold text-[hsl(var(--lp-ink))]" : "text-[hsl(var(--lp-fog-light))]"}>{v}</span>;
}

export default function Compare() {
  return (
    <section id="compare" className="relative bg-white lp-on-light scroll-mt-20" data-lp-tone="light" aria-labelledby="lp-compare-title">
      <div className="max-w-[1180px] mx-auto px-6 pt-[10vh] pb-[12vh]">
        <Reveal>
          <p className="lp-eyebrow text-[hsl(var(--lp-fog-light))]">Compare</p>
          <h2 id="lp-compare-title" className="lp-h2 mt-2 text-[hsl(var(--lp-ink))]">Why people switch.</h2>
        </Reveal>
        {/* Phones: each feature over its three answers, HireTrail's in a lit column. */}
        <Reveal delay={80} className="sm:hidden mt-10">
          <div className="grid grid-cols-3 gap-3 pb-3 text-[12.5px] font-medium text-[hsl(var(--lp-fog-light))]" aria-hidden>
            <span>{COLUMNS[0]}</span>
            <span>{COLUMNS[1]}</span>
            <span className="-mx-2.5 px-2.5 font-semibold text-[hsl(var(--lp-ink))]">{COLUMNS[2]}</span>
          </div>
          <dl>
            {ROWS.map((r) => (
              <div key={r.label} className="border-t border-black/[0.08] pt-4 pb-4">
                <dt className="text-[15px] font-medium leading-snug text-[hsl(var(--lp-ink))]">{r.label}</dt>
                <dd className="mt-2.5 grid grid-cols-3 gap-3 items-center text-[14px] leading-snug">
                  <span><span className="sr-only">{COLUMNS[0]}: </span><Value v={r.sheet} /></span>
                  <span><span className="sr-only">{COLUMNS[1]}: </span><Value v={r.tracker} /></span>
                  <span className="-mx-2.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--lp-mist))]"><span className="sr-only">{COLUMNS[2]}: </span><Value v={r.us} strong /></span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={80} className="hidden sm:block mt-12">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="text-left">
                <th scope="col" className="w-[34%] pb-4 font-medium text-[13px] text-[hsl(var(--lp-fog-light))]"><span className="sr-only">Feature</span></th>
                <th scope="col" className="w-[20%] pb-4 font-medium text-[13px] text-[hsl(var(--lp-fog-light))]">{COLUMNS[0]}</th>
                <th scope="col" className="w-[22%] pb-4 font-medium text-[13px] text-[hsl(var(--lp-fog-light))]">{COLUMNS[1]}</th>
                <th scope="col" className="w-[24%] pb-4 pl-5 font-semibold text-[13px] text-[hsl(var(--lp-ink))] rounded-t-2xl bg-[hsl(var(--lp-mist))] pt-4">{COLUMNS[2]}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.label} className="border-t border-black/[0.08]">
                  <th scope="row" className="py-5 pr-4 text-left font-medium text-[hsl(var(--lp-ink))]">{r.label}</th>
                  <td className="py-5 pr-4"><Value v={r.sheet} /></td>
                  <td className="py-5 pr-4"><Value v={r.tracker} /></td>
                  <td className={`py-5 pl-5 bg-[hsl(var(--lp-mist))] ${i === ROWS.length - 1 ? "rounded-b-2xl" : ""}`}><Value v={r.us} strong /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}
