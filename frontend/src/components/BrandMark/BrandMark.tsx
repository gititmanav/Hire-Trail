/** HireTrail's mark in one ink: a rounded square with the H cut out of it.
 *  `tone` is the surface it sits on — a white plate on dark, an ink plate on light. */
export default function BrandMark({ size = 28, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const plate = tone === "dark" ? "#fff" : "hsl(0 0% 9%)";
  const letter = tone === "dark" ? "#000" : "#fff";
  const ease = { transition: "fill 320ms cubic-bezier(0.16,1,0.3,1)" };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill={plate} style={ease} />
      <path d="M10 8h3v6h6V8h3v16h-3v-7h-6v7h-3V8z" fill={letter} style={ease} />
    </svg>
  );
}
