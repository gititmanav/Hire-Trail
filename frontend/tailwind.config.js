/** Tailwind's palette families, read from CSS variables (App.css) so a
 *  Custom theme can re-tint them; presets hold Tailwind's exact values. */
const PALETTE = ["slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green",
  "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const rgbVar = (name) => `rgb(var(--palette-${name}) / <alpha-value>)`;
const paletteColors = Object.fromEntries(
  PALETTE.map((family) => [family, Object.fromEntries(SHADES.map((shade) => [shade, rgbVar(`${family}-${shade}`)]))]),
);

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        control: "hsl(var(--control))",
        paper: "hsl(var(--paper))",
        scrim: "hsl(var(--scrim))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        ...paletteColors,
        // Status colours (values in App.css; a Custom theme re-tints `light`).
        success: { DEFAULT: rgbVar("success"), light: rgbVar("success-light") },
        warning: { DEFAULT: rgbVar("warning"), light: rgbVar("warning-light") },
        danger: { DEFAULT: rgbVar("danger"), light: rgbVar("danger-light") },
      },
      // `text-primary` is the accent *as text* — a Custom theme can pick a
      // light accent, so text reads `--brand-text` (solved to ≥ 4.5:1) while
      // fills, borders and rings keep the accent itself.
      textColor: {
        primary: { DEFAULT: "hsl(var(--brand-text))", foreground: "hsl(var(--primary-foreground))" },
      },
      // Named so they can't collide with colour keys (`shadow-card` would
      // resolve to a shadow *colour*).
      boxShadow: {
        panel: "var(--shadow-panel)",
        floating: "var(--shadow-floating)",
        pill: "var(--shadow-pill)",
      },
      transitionTimingFunction: {
        // `ease-smooth` — the app's one motion curve (Tailwind's own ease-out stays as is).
        smooth: "var(--ease-out)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans, -apple-system)", "BlinkMacSystemFont", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
