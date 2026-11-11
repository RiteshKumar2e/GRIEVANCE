/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
        display: ['"Source Serif 4"', "Georgia", "serif"],
      },
      colors: {
        // Civic navy primary, used sparingly; neutrals carry most of the UI.
        brand: {
          50: "#eef3fb", 100: "#d9e4f5", 200: "#b3c8eb", 300: "#86a6dc", 400: "#5a82c9",
          500: "#3a64b1", 600: "#2a4f94", 700: "#223f77", 800: "#1c3260", 900: "#15264a",
        },
        saffron: { 50: "#fff7ed", 100: "#ffedd5", 500: "#e8892b", 600: "#c96f17", 700: "#9a5212" },
        ink: { DEFAULT: "#16181d", soft: "#3d424d", muted: "#6b7180" },
        line: "#e3e5ea",
        canvas: "#f6f7f9",
        status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
      },
    },
  },
  plugins: [],
};
