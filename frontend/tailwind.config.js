/** @type {import('tailwindcss').Config} */
// GRIEVANCE design tokens.
//   Deep Navy  #101D2B  text, navigation, dark sections
//   Muted Teal #174C50  trust, links, secondary actions, selected states (the "brand" scale)
//   Warm Amber #D58A43  primary call to action only (navy text on amber, 6.9:1)
//   Soft Stone #E8E5DC  dividers and quiet backgrounds
//   Off-white  #FAF9F6  page background (never pure white)
// Input borders use a darker stone so form controls keep a 3:1 boundary contrast.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', '"Noto Sans Devanagari"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Manrope"', '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      colors: {
        navy: { DEFAULT: "#101D2B", 800: "#18283A", 700: "#22354B" },
        brand: {
          50: "#EAF2F2", 100: "#D2E4E4", 200: "#A9CACB", 300: "#76A9AB", 400: "#3F8285",
          500: "#24666A", 600: "#1C585C", 700: "#174C50", 800: "#113B3F", 900: "#0C2C2F",
        },
        amber: { DEFAULT: "#D58A43", hover: "#C27632", active: "#AE6626", soft: "#F6E7D6" },
        // Caution colour for the SYNTHETIC-data notice.
        saffron: { 50: "#F8EEDF", 100: "#EED8B6", 500: "#B9701D", 600: "#985B15", 700: "#7A4810" },
        ink: { DEFAULT: "#101D2B", soft: "#3A4655", muted: "#5B6573" },
        stone: { DEFAULT: "#E8E5DC", dark: "#C7C2B5" },
        line: "#E8E5DC",
        canvas: "#FAF9F6",
        surface: "#FFFFFE",
        status: { good: "#1E7B34", warning: "#8A5F00", serious: "#A84B22", critical: "#B42828" },
      },
      borderRadius: {
        DEFAULT: "4px",
        sm: "3px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      boxShadow: {
        card: "none",
        lift: "0 1px 2px rgba(16, 29, 43, 0.04), 0 6px 16px rgba(16, 29, 43, 0.06)",
        overlay: "0 16px 40px rgba(16, 29, 43, 0.16)",
      },
      transitionDuration: { DEFAULT: "180ms" },
      maxWidth: { prose: "66ch" },
    },
  },
  plugins: [],
};
