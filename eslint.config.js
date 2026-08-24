import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `supabase/.temp` entsteht bei `supabase start` (gitignored, aber auf der
  // Platte) und enthält gebündeltes Edge-Runtime-JS. Ohne diesen Eintrag meldet
  // `pnpm lint` lokal ~190 Fehler aus einer Datei, die niemand geschrieben hat —
  // und ist damit als Gate wertlos, sobald jemand den lokalen Stack laufen lässt.
  { ignores: ["dist", "coverage", "node_modules", "docs", "public", "supabase/.temp"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  // Die Sondenskripte unter `scripts/` laufen in Node, nicht im Browser. Fuer
  // die .ts-Dateien dort spielt das keine Rolle — typescript-eslint schaltet
  // `no-undef` fuer TypeScript ab, weil der Compiler die Frage besser
  // beantwortet. Eine .mjs-Datei faellt aber unter `js.configs.recommended`,
  // und dort meldet `no-undef` dann `process` und `console` als undefiniert.
  // Ohne diesen Block ist `pnpm lint` rot, sobald jemand ein Node-Skript in
  // JavaScript schreibt (AGE-581, 23.08.).
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
