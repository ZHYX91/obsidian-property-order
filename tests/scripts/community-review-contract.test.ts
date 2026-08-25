import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Obsidian community review contract", () => {
  it("keeps the manifest description host-name neutral", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(projectRoot, "manifest.json"), "utf8"),
    ) as { description: string };

    expect(manifest.description).not.toMatch(/\bObsidian\b/i);
  });

  it("does not add redundant or raw HTML headings to the tab content", () => {
    const settingsTab = readFileSync(
      path.join(projectRoot, "src", "app", "settings-tab.ts"),
      "utf8",
    );

    expect(settingsTab).not.toContain(".setHeading()");
    expect(settingsTab).not.toMatch(/createEl\(["']h[1-6]["']/);
  });
});
