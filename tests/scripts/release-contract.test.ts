import { describe, expect, it } from "vitest";

// @ts-expect-error The release contract is implemented in JavaScript.
import { assertPackageLockContract, assertPackageVersionContract, assertReleaseTag } from "../../scripts/release-contract.mjs";

describe("release contract", () => {
  it("accepts synchronized package metadata and an exact version tag", () => {
    const manifest = { version: "0.1.0", minAppVersion: "1.5.7" };

    expect(() =>
      assertPackageVersionContract(
        manifest,
        { version: "0.1.0" },
        { "0.1.0": "1.5.7" },
      )
    ).not.toThrow();
    expect(() => assertReleaseTag("0.1.0", manifest.version)).not.toThrow();
  });

  it("rejects prefixed, malformed, and mismatched tags", () => {
    expect(() => assertReleaseTag("v0.1.0", "0.1.0")).toThrow(/without a v prefix/);
    expect(() => assertReleaseTag("0.1", "0.1.0")).toThrow(/must use x\.y\.z/);
    expect(() => assertReleaseTag("00.1.0", "00.1.0")).toThrow(/must use x\.y\.z/);
    expect(() => assertReleaseTag("0.1.1", "0.1.0")).toThrow(/must match/);
  });

  it("rejects inconsistent package and compatibility versions", () => {
    const manifest = { version: "0.1.0", minAppVersion: "1.5.7" };

    expect(() =>
      assertPackageVersionContract(manifest, { version: "0.2.0" }, { "0.1.0": "1.5.7" })
    ).toThrow(/versions must match/);
    expect(() =>
      assertPackageVersionContract(manifest, { version: "0.1.0" }, { "0.1.0": "1.6.0" })
    ).toThrow(/must map/);
  });

  it("requires the lockfile root identity to match package.json", () => {
    const packageJson = { name: "obsidian-property-order", version: "0.4.1" };
    const packageLock = {
      name: "obsidian-property-order",
      packages: {
        "": { name: "obsidian-property-order", version: "0.4.1" },
      },
      version: "0.4.1",
    };

    expect(() => assertPackageLockContract(packageJson, packageLock)).not.toThrow();
    expect(() => assertPackageLockContract(packageJson, {
      ...packageLock,
      version: "0.4.0",
    })).toThrow(/package-lock\.json and package\.json versions must match/u);
    expect(() => assertPackageLockContract(packageJson, {
      ...packageLock,
      packages: { "": { ...packageLock.packages[""], version: "0.4.0" } },
    })).toThrow(/root package version/u);
  });
});
