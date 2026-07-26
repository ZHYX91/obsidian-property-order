import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

const TEST_FILES = ["tests/**/*.ts"];
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
  {
    files: ["main.ts", "src/**/*.ts"],
    rules: {
      // The custom three-tab UI supports the declared pre-1.13 minimum.
      // A partial declarative definition would replace, not index, that UI.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
]);
