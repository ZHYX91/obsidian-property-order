import { describe, expect, it } from "vitest";

// @ts-expect-error The release contract is implemented in JavaScript.
import { assertPackageVersionContract, assertReleaseTag } from "../../scripts/release-contract.mjs";

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
});
