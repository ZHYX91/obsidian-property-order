import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error The release adapter is an executable JavaScript module without declarations.
import { releaseConfig, verifyReleaseCorePin } from "../../scripts/release.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vendorRoot = path.join(projectRoot, "scripts", "vendor");

describe("release-core adapter", () => {
  it("declares only Property Order's standalone release policy", () => {
    expect(releaseConfig).toEqual({
      schemaVersion: 1,
      plugin: {
        id: "property-order",
        name: "Property Order",
        minAppVersion: "1.12.7",
        isDesktopOnly: false,
      },
      assets: { styles: "required" },
      publication: { repository: "ZHYX91/obsidian-property-order" },
    });
  });

  it("binds the vendored runtime to the exact lock version and hash", async () => {
    const lock = JSON.parse(
      readFileSync(path.join(vendorRoot, "obsidian-release-core.lock.json"), "utf8"),
    ) as { version: string; sha256: string };
    const runtime = readFileSync(path.join(vendorRoot, "obsidian-release-core.mjs"));
    expect(createHash("sha256").update(runtime).digest("hex")).toBe(lock.sha256);
    await expect(verifyReleaseCorePin()).resolves.toBeUndefined();
  });

  it("contains no workspace, sibling, absolute-path, or mutable package dependency", () => {
    const adapter = readFileSync(path.join(projectRoot, "scripts", "release.mjs"), "utf8");
    const runtime = readFileSync(
      path.join(vendorRoot, "obsidian-release-core.mjs"),
      "utf8",
    );
    const packageJson = readFileSync(path.join(projectRoot, "package.json"), "utf8");
    for (const source of [adapter, runtime, packageJson]) {
      expect(source).not.toMatch(
        /(?:[A-Za-z]:[\\/]|obsidian-plugin-workspace|\.\.\/obsidian-|"(?:file|link|workspace):)/u,
      );
    }
    expect(adapter).toContain('from "./vendor/obsidian-release-core.mjs"');
    for (const match of runtime.matchAll(/\bfrom\s+["']([^"']+)["']/gu)) {
      expect(match[1]).toMatch(/^node:/u);
    }
  });
});
