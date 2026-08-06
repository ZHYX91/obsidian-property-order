import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

const TEST_FILES = ["benchmarks/**/*.ts", "tests/**/*.ts"];
const NODE_SCRIPT_FILES = ["*.mjs", "*.mts", "scripts/**/*.mjs"];
const disabledObsidianRules = Object.fromEntries(
  Object.keys(obsidianmd.rules).map((ruleName) => [`obsidianmd/${ruleName}`, "off"]),
);

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "node_modules/**",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.{ts,mts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message: "Core modules must remain independent of the Obsidian runtime.",
              name: "obsidian",
            },
          ],
          patterns: [
            {
              regex: "^(?:obsidian/|(?:\\.\\./)+(?:app|features|obsidian)(?:/|$))",
              message: "Core modules may only depend on core or shared contracts.",
            },
          ],
        },
      ],
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: TEST_FILES,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      ...disabledObsidianRules,
      "@microsoft/sdl/no-inner-html": "off",
      "no-undef": "off",
      "no-unsanitized/method": "off",
      "no-unsanitized/property": "off",
    },
  },
  {
    files: NODE_SCRIPT_FILES,
    languageOptions: {
      globals: {
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      ...disabledObsidianRules,
      "no-unsanitized/method": "off",
      "no-unsanitized/property": "off",
    },
  },
]);
