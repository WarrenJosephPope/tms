const reactPlugin = require("eslint-plugin-react");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ...reactPlugin.configs.flat.recommended,
    settings: { react: { version: "detect" } },
  },
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
