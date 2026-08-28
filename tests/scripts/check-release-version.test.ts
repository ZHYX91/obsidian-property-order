import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
const releaseCheckFiles = [
  "manifest.json",
  "package.json",
  "package-lock.json",
  "versions.json",
  "scripts/check-release-version.mjs",
  "scripts/local-tag-contract.mjs",
  "scripts/release-contract.mjs",
];

function createIsolatedReleaseCheckProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), "property-order-release-version-"));
  for (const relativePath of releaseCheckFiles) {
    const destination = path.join(root, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(path.join(projectRoot, relativePath), destination);
  }
  execFileSync("git", ["init"], { cwd: root, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "Release Contract Test"], { cwd: root });
  execFileSync("git", ["config", "user.email", "release-contract@example.invalid"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "test fixture"], { cwd: root, stdio: "pipe" });
  return root;
}

const checkReleaseVersion = (cwd: string, ...arguments_: string[]) => execFileSync(
  process.execPath,
  ["scripts/check-release-version.mjs", ...arguments_],
  { cwd, encoding: "utf8", stdio: "pipe" },
);

describe("release version and local tag contract", () => {
  it("defaults to the manifest version and preserves an explicit exact tag", () => {
    const isolatedProject = createIsolatedReleaseCheckProject();
    try {
      expect(checkReleaseVersion(isolatedProject)).toContain(
        `Release version contract passed for ${manifestVersion}.`,
      );
      expect(checkReleaseVersion(isolatedProject, manifestVersion)).toContain(
        `Release version contract passed for ${manifestVersion}.`,
      );
      expect(() => checkReleaseVersion(isolatedProject, differentVersion)).toThrow();
    } finally {
      rmSync(isolatedProject, { recursive: true, force: true });
    }
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
