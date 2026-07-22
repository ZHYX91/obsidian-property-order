import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8",
);

describe("release workflow contract", () => {
  it("keeps the loose Obsidian assets and adds one install-ready archive", () => {
    expect(workflow).toContain("dist/property-order/main.js");
    expect(workflow).toContain("dist/property-order/manifest.json");
    expect(workflow).toContain("dist/property-order/styles.css");
    expect(workflow).toContain("property-order-${GITHUB_REF_NAME}.zip");
    expect(workflow).toContain("property-order/main.js");
    expect(workflow).toContain("property-order/manifest.json");
    expect(workflow).toContain("property-order/styles.css");
  });

  it("updates an existing tagged release without duplicating it", () => {
    expect(workflow).toContain('gh release view "$GITHUB_REF_NAME"');
    expect(workflow).toContain('gh release upload "$GITHUB_REF_NAME"');
    expect(workflow).toContain("--clobber");
    expect(workflow).toContain('gh release create "$GITHUB_REF_NAME"');
  });
});
