import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error The local tag contract is implemented in JavaScript.
import { assertLocalTagPointsToHead } from "../../scripts/local-tag-contract.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestVersion = (JSON.parse(
  readFileSync(path.join(projectRoot, "manifest.json"), "utf8"),
) as { version: string }).version;
const differentVersion = manifestVersion.replace(
  /(\d+)$/u,
  (patch) => String(Number(patch) + 1),
);
const checkReleaseVersion = (...arguments_: string[]) => execFileSync(
  process.execPath,
  ["scripts/check-release-version.mjs", ...arguments_],
  { cwd: projectRoot, encoding: "utf8", stdio: "pipe" },
);

describe("release version and local tag contract", () => {
  it("defaults to the manifest version and preserves an explicit exact tag", () => {
    expect(checkReleaseVersion()).toContain(`Release version contract passed for ${manifestVersion}.`);
    expect(checkReleaseVersion(manifestVersion)).toContain(
      `Release version contract passed for ${manifestVersion}.`,
    );
    expect(() => checkReleaseVersion(differentVersion)).toThrow();
  });

  it("allows a missing local tag and an existing tag at HEAD", async () => {
    const missingTag = Object.assign(new Error("missing"), { code: 1 });
    const missingRunner = async (_file: string, arguments_: string[]) => {
      if (arguments_[0] === "rev-parse" && arguments_.at(-1) === "HEAD") return { stdout: "head\n" };
      if (arguments_[0] === "show-ref") throw missingTag;
      throw new Error(`Unexpected git call: ${arguments_.join(" ")}`);
    };
    await expect(assertLocalTagPointsToHead(manifestVersion, missingRunner)).resolves.toBeUndefined();

    const matchingRunner = async (_file: string, arguments_: string[]) => {
      if (arguments_[0] === "show-ref") return { stdout: "" };
      return { stdout: "head\n" };
    };
    await expect(assertLocalTagPointsToHead(manifestVersion, matchingRunner)).resolves.toBeUndefined();
  });

  it("rejects an existing local tag that points to another commit", async () => {
    const runner = async (_file: string, arguments_: string[]) => {
      if (arguments_[0] === "show-ref") return { stdout: "" };
      if (arguments_.at(-1) === "HEAD") return { stdout: "head\n" };
      return { stdout: "older\n" };
    };
    await expect(assertLocalTagPointsToHead(manifestVersion, runner)).rejects.toThrow(
      `Existing tag ${manifestVersion} points to another commit`,
    );
  });
});
