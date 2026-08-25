import { describe, expect, it } from "vitest";

// @ts-expect-error The runtime contract is implemented in JavaScript.
import { assertRuntimeContract, parseNpmVersion } from "../../scripts/runtime-contract.mjs";

const packageJson = {
  engines: { node: "24.19.0" },
  packageManager: "npm@11.17.0",
};

describe("runtime contract", () => {
  it("accepts one exact Node.js and npm toolchain", () => {
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24.19.0",
      currentNodeVersion: "24.19.0",
      currentNpmVersion: "11.17.0",
      packageJson,
    })).not.toThrow();
    expect(parseNpmVersion("npm/11.17.0 node/v24.19.0 win32 x64")).toBe("11.17.0");
  });

  it("rejects floating or mismatched runtime declarations", () => {
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24",
      currentNodeVersion: "24.19.0",
      currentNpmVersion: "11.17.0",
      packageJson,
    })).toThrow(/pin an exact Node\.js version/u);
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24.19.0",
      currentNodeVersion: "24.17.0",
      currentNpmVersion: "11.17.0",
      packageJson,
    })).toThrow(/Node\.js 24\.19\.0 is required/u);
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24.19.0",
      currentNodeVersion: "24.19.0",
      currentNpmVersion: "11.15.0",
      packageJson,
    })).toThrow(/npm 11\.17\.0 is required/u);
    expect(() => parseNpmVersion("node/v24.19.0 win32 x64")).toThrow(/through npm/u);
  });
});
