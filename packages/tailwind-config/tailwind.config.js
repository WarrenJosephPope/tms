/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Inline defaults — tailwindcss/defaultTheme is not available in v4
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"],
      },
      colors: {
        brand: {
          50:  "#eff3fe",
          100: "#dce5fc",
          200: "#b2c7f8",
          300: "#7ea1f2",
          400: "#4a77e8",
          500: "#1e4dd0",  // interactive navy-blue
          600: "#1a3dab",
          700: "#1a2d85",
          800: "#1a2464",  // Tracking Management System deep navy
          900: "#111848",
          950: "#090f2f",
        },
        accent: {
          DEFAULT: "#cc2229",
          50:  "#fff1f1",
          100: "#ffddde",
          200: "#ffc0c1",
          300: "#ff9395",
          400: "#ff5659",
          500: "#ff1e22",
          600: "#ee0a0e",
          700: "#cc2229",  // Tracking Management System red
          800: "#a11b1f",
          900: "#851c1f",
          950: "#490b0d",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc",
          border: "#e2e8f0",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
      },
    },
  },
  plugins: [],
};
