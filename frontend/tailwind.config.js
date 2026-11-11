/** @type {import('tailwindcss').Config} */
// Design tokens. Warm paper neutrals, near-black ink, one civic-blue accent.
// Hierarchy comes from type and spacing; corners are small and shadows are reserved for overlays.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Noto Sans Devanagari"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Source Serif 4"', '"Noto Serif Devanagari"', "Georgia", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      colors: {
        // Single accent: civic blue. Lighter steps are tints for selected states only.
        brand: {
          50: "#EEF2F8", 100: "#DCE5F1", 200: "#B7C8E2", 300: "#8AA6CF", 400: "#5A80B8",
          500: "#2F5F9E", 600: "#244E86", 700: "#1D416F", 800: "#17345A", 900: "#112846",
        },
        // Reserved for the SYNTHETIC-data notice (a caution signal, not decoration).
        saffron: { 50: "#FBF3E6", 100: "#F3E0BF", 500: "#B9701D", 600: "#985B15", 700: "#7A4810" },
        ink: { DEFAULT: "#1B1D21", soft: "#3E4148", muted: "#5D6068" },
        line: "#DFDBD1",
        canvas: "#F6F4EF", // page background (warm paper, never pure white)
        surface: "#FCFBF8", // raised surfaces
        status: { good: "#1E7B34", warning: "#9A6A00", serious: "#B4532A", critical: "#B42828" },
      },
      borderRadius: {
        DEFAULT: "3px",
        sm: "2px",
        md: "4px",
        lg: "5px",
        xl: "6px",
      },
      boxShadow: {
        card: "none",
        overlay: "0 12px 32px rgba(27, 29, 33, 0.14)",
      },
      maxWidth: { prose: "68ch" },
    },
  },
  plugins: [],
};
