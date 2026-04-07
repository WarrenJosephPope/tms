const sharedConfig = require("@eparivahan/tailwind-config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...sharedConfig,
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
};
