import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "node_modules/**",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The custom three-tab UI supports the declared pre-1.13 minimum.
      // A partial declarative definition would replace, not index, that UI.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
      // Native creation is always performed through the target ownerDocument
      // so suggestion menus, settings, and drag UI work in popout documents.
      "obsidianmd/prefer-create-el": "off",
    },
  },
]);
