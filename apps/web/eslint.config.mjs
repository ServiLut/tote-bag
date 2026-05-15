import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-investigate/**",
<<<<<<< HEAD
<<<<<<< HEAD
    ".next-routecheck/**",
=======
>>>>>>> 20d450f (fix: checkpoin 11-02-2026)
=======
    ".next-routecheck/**",
>>>>>>> 2b2a468 (refactor: finance dashboard, api environment handling and bug fixes)
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
