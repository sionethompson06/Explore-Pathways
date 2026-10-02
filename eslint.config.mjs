import nextConfig from "eslint-config-next";

/**
 * eslint-config-next 16.x ships a native flat-config array (core web
 * vitals + TypeScript rules already combined) -- no FlatCompat legacy
 * shim needed. Using FlatCompat here previously caused
 * "Converting circular structure to JSON" during config validation,
 * because eslint-plugin-react's flat-config plugin object
 * intentionally self-references and FlatCompat's eslintrc-style
 * validator cannot serialize that. The native import avoids the
 * legacy bridge entirely.
 */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "docs/pathways/pack/**",
      "contracts/**",
      "fixtures/**",
    ],
  },
];

export default eslintConfig;
