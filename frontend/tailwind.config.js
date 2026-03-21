/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#1b2432",
          hover: "#243044",
          active: "#2d3d56",
          text: "#8899b0",
        },
        accent: {
          DEFAULT: "#378add",
          light: "#e6f1fb",
          dark: "#185fa5",
          hover: "#2a7acc",
        },
        success: { DEFAULT: "#1d9e75", light: "#e1f5ee" },
        warning: { DEFAULT: "#ef9f27", light: "#faeeda" },
        danger: { DEFAULT: "#e24b4a", light: "#fcebeb" },
        page: "#f0f2f5",
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
