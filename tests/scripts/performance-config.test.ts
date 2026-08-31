import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("performance benchmark configuration", () => {
  it("keeps benchmarks explicit and outside the ordinary offline gate", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const ordinaryConfig = readFileSync(
      path.join(projectRoot, "vitest.config.mts"),
      "utf8",
    );

    expect(packageJson.scripts?.check).toBe(
      "npm run check:runtime && npm run lint && npm run format:check && npm run check:readme-i18n && npm run check:docs-i18n && npm run typecheck && npm run test:coverage && npm run build && npm run check:release",
    );
    expect(packageJson.scripts?.check).not.toMatch(/bench|curl|gh api|https?:\/\//u);
    expect(packageJson.scripts?.["release:check"]).toBe(
      "npm run check && npm run release:validate-tag && npm run bench:usage",
    );
    expect(ordinaryConfig).toContain('"benchmarks/**"');
  });

  it("runs deterministic 10k and 50k fixtures serially through a dedicated config", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const performanceConfig = readFileSync(
      path.join(projectRoot, "vitest.performance.config.mts"),
      "utf8",
    );

    expect(packageJson.scripts?.["bench:usage"]).toContain(
      "--config vitest.performance.config.mts --mode quick",
    );
    expect(packageJson.scripts?.["bench:usage:large"]).toContain(
      "--config vitest.performance.config.mts --mode large",
    );
    expect(performanceConfig).toContain('include: ["benchmarks/**/*.test.ts"]');
    expect(performanceConfig).toContain("mode === \"large\" ? 50_000 : 10_000");
    expect(performanceConfig).toContain("fileParallelism: false");
  });
});
