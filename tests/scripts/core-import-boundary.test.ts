import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

// @ts-expect-error The flat ESLint config is an executable JavaScript module.
import eslintConfig from "../../eslint.config.mjs";

const coreConfig = eslintConfig.find(
  (entry: { files?: string[] }) => entry.files?.includes("src/core/**/*.ts") === true,
) as { rules?: Record<string, Linter.RuleEntry> } | undefined;
const typescriptConfig = eslintConfig.find(
  (entry: { files?: string[] }) => entry.files?.includes("**/*.{ts,mts}") === true,
) as { languageOptions?: { parser?: Linter.Parser } } | undefined;
const coreImportBoundary = coreConfig?.rules?.["no-restricted-imports"];
const typescriptParser = typescriptConfig?.languageOptions?.parser;

function lintImports(source: string): Linter.LintMessage[] {
  if (coreImportBoundary == null || typescriptParser == null) {
    throw new Error("Missing TypeScript parser or core no-restricted-imports boundary");
  }

  return new Linter().verify(source, {
    languageOptions: {
      ecmaVersion: "latest",
      parser: typescriptParser,
      sourceType: "module",
    },
    rules: {
      "no-restricted-imports": coreImportBoundary,
    },
  });
}

describe("core import boundary", () => {
  it("rejects runtime and upper-layer imports from core modules", () => {
    const messages = lintImports(
      [
        'import type { App } from "obsidian";',
        'import "obsidian/internals";',
        'import "../../app";',
        'import "../../app/plugin";',
        'import "../../features/value-order/value-alignment";',
        'import "../../obsidian/metadata";',
      ].join("\n"),
    );
    const boundaryMessages = messages.filter(
      ({ ruleId }) => ruleId === "no-restricted-imports",
    );

    expect(boundaryMessages).toHaveLength(6);
    expect(boundaryMessages.map(({ line }) => line)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("allows core-local and shared contract imports", () => {
    const messages = lintImports(
      [
        'import "../../shared/types";',
        'import "./types";',
      ].join("\n"),
    );

    expect(
      messages.filter(({ ruleId }) => ruleId === "no-restricted-imports"),
    ).toEqual([]);
  });
});
