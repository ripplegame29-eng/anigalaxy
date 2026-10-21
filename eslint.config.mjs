import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Постеры идут с внешних CDN (AniLibria, Shikimori, Kodik) с динамическими
      // размерами: next/image тут только мешает, обычный <img> — осознанный выбор
      "@next/next/no-img-element": "off",
      // Префикс «_» — осознанно неиспользуемый аргумент
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Промежуточная сборка tsc для тестов (`tools/run-tests.mjs`)
    ".tsc-tests/**",
  ]),
]);

export default eslintConfig;
