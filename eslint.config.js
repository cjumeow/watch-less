import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["**/dist/", "artifacts/"] },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["scripts/**", "*.js"],
    languageOptions: { globals: globals.node },
  },
  // Last, so formatting is Prettier's job and no lint rule fights it.
  prettier,
);
