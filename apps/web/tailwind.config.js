const sharedConfig = require("@eparivahan/tailwind-config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...sharedConfig,
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/lib/**/*.{js,jsx}",
    "../../packages/tailwind-config/tailwind.config.js",
  ],
};
