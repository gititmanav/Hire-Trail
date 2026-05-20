import { Reveal, Counter } from "./motion";

/* ─────────────────────────── Stats strip (upgraded: gradient bg, gradient numbers) ─────────────────────────── */

export default function StatsStrip() {
  const stats: Array<{ v: number; suffix: string; l: string; tone: string }> = [
    { v: 12, suffix: "s", l: "to a tailored resume", tone: "from-[#3B82F6] to-[#1E3A8A]" },
    { v: 6, suffix: "", l: "supported job boards", tone: "from-emerald-500 to-emerald-700" },
    { v: 5, suffix: "", l: "stages, zero manual updates", tone: "from-purple-500 to-purple-700" },
    { v: 1, suffix: "", l: "page, every time", tone: "from-amber-500 to-amber-700" },
  ];
  return (
    <section className="relative py-14 sm:py-18 overflow-hidden rounded-t-[40px] sm:rounded-t-[64px] rounded-b-[40px] sm:rounded-b-[64px]">
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none rounded-t-[40px] sm:rounded-t-[64px] rounded-b-[40px] sm:rounded-b-[64px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.18),transparent)] animate-[ht-drift_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.14),transparent)] animate-[ht-drift_24s_ease-in-out_-6s_infinite]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
      </div>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300 mb-3">By the numbers</div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Built fast. Stays fast.</h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-6">
          {stats.map((s, i) => (
            <Reveal key={s.l} delay={i * 80}>
              <div className="text-center group">
                <div className={`text-5xl sm:text-6xl md:text-7xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br ${s.tone} drop-shadow-[0_2px_20px_rgba(59,130,246,0.25)] group-hover:scale-105 transition-transform`}>
                  <Counter value={s.v} suffix={s.suffix} />
                </div>
                <div className="text-[13px] text-slate-300 mt-3">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
