/** @type {import('tailwindcss').Config} */
const withOpacity = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: withOpacity("--background"),
        surface: {
          DEFAULT: withOpacity("--surface"),
          2: withOpacity("--surface-2"),
        },
        border: withOpacity("--border"),
        foreground: withOpacity("--foreground"),
        muted: {
          foreground: withOpacity("--muted-foreground"),
        },
        primary: {
          DEFAULT: withOpacity("--primary"),
          foreground: withOpacity("--primary-foreground"),
        },
        accent: {
          DEFAULT: withOpacity("--accent"),
          foreground: withOpacity("--accent-foreground"),
        },
        success: withOpacity("--success"),
        danger: withOpacity("--danger"),
        warning: withOpacity("--warning"),
        // legacy tokens kept for safety during transition
        quai: { orange: "#FF5E00", dark: "#0F0F11", gray: "#1C1C21" },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 50px -12px rgb(var(--primary) / 0.45)",
        "glow-accent": "0 0 50px -12px rgb(var(--accent) / 0.45)",
        card: "0 1px 0 0 rgb(var(--border) / 0.6), 0 20px 40px -24px rgb(0 0 0 / 0.8)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "route-draw": { to: { "stroke-dashoffset": "0" } },
        blink: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        blink: "blink 1.1s step-end infinite",
        marquee: "marquee 22s linear infinite",
      },
    },
  },
  plugins: [],
};
