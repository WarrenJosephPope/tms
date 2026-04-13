const sharedConfig = require("@tracking_management_system/tailwind-config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...sharedConfig,
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
};
