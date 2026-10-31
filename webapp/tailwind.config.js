/** @type {import('tailwindcss').Config} */
// Palette and type taken from the TUM Blockchain Conference 26 judging deck: Montserrat, a near-black wine
// background, translucent cards and the amber → orange → red → rose → violet gradient.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Montserrat"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        pixel: ['"Silkscreen"', '"Montserrat"', "monospace"],
      },
      colors: {
        night: { DEFAULT: "#0f070b", 900: "#0f070b", 800: "#170b11", 700: "#211218", wine: "#401821" },
        ink: { DEFAULT: "#ffffff", soft: "#d8d3da", mute: "#9d97a2" },
        grad: { amber: "#ffbc15", orange: "#fd632d", red: "#eb4048", rose: "#d33d6a", violet: "#753dde" },
        brand: { 50: "#24122a", 100: "#3a1d47", 300: "#cdb4ff", 400: "#b391ff", 500: "#7142de", 600: "#753dde", 700: "#5b2fb3" },
        proof: { DEFAULT: "#34d399", 50: "#0f2a20", 600: "#16a36f" },
      },
      boxShadow: { card: "0 1px 0 rgba(255,255,255,.04) inset, 0 12px 40px rgba(0,0,0,.35)" },
    },
  },
  plugins: [],
};
