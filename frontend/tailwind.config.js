/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        quai: {
          orange: "#FF5E00",
          dark: "#0F0F11",
          gray: "#1C1C21",
        }
      }
    },
  },
  plugins: [],
};
