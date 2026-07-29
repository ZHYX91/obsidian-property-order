import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("coverage configuration", () => {
  it("keeps every runtime TypeScript source in the coverage inventory", () => {
    const config = readFileSync(path.join(projectRoot, "vitest.config.mts"), "utf8");

    expect(config).toContain('include: ["main.ts", "src/**/*.ts"]');
    expect(config).toContain('provider: "v8"');
  });

  it("exposes coverage as an explicit diagnostic command", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["test:coverage"]).toBe("vitest run --coverage");
  });
});
