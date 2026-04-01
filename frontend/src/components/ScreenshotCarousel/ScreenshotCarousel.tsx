import { useState, useEffect } from "react";

const slides = [
  { src: "/screenshot-dashboard.png", caption: "Customizable analytics dashboard" },
  { src: "/screenshot-kanban.png", caption: "Visual Kanban pipeline" },
];

export default function ScreenshotCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-lg">
      <div className="relative rounded-xl overflow-hidden shadow-lg border border-border/60 bg-white aspect-[16/10]">
        {slides.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt={s.caption}
            className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-[600ms]"
            style={{ opacity: i === active ? 1 : 0 }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-center mt-3 min-h-[20px] transition-opacity duration-300">
        {slides[active].caption}
      </p>
      <div className="flex justify-center gap-2 mt-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-2 h-2 rounded-full transition-all ${i === active ? "bg-primary w-5" : "bg-muted-foreground/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
