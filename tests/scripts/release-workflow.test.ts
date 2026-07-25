import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8",
);
const ciWorkflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "ci.yml"),
  "utf8",
);

describe("release workflow contract", () => {
  it("uploads the three standard build files from the top level of dist", () => {
    expect(ciWorkflow).toContain("dist/main.js");
    expect(ciWorkflow).toContain("dist/manifest.json");
    expect(ciWorkflow).toContain("dist/styles.css");
    expect(ciWorkflow).not.toContain("dist/property-order/");
  });

  it("keeps the loose Obsidian assets and adds one install-ready archive", () => {
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
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

  it("attests every published release asset", () => {
    expect(workflow).toContain("attestations: write");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("uses: actions/attest@v4");
    expect(workflow).toContain("dist/main.js");
    expect(workflow).toContain("dist/manifest.json");
    expect(workflow).toContain("dist/styles.css");
    expect(workflow).toContain("dist/property-order-${{ github.ref_name }}.zip");
  });
});
