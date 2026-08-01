import { readFile } from "node:fs/promises";

import {
  assertPackageLockContract,
  assertPackageVersionContract,
  assertReleaseTag,
} from "./release-contract.mjs";

const releaseTag = process.argv[2];
if (releaseTag === undefined) {
  throw new Error("Usage: node scripts/check-release-version.mjs <release-tag>");
}

const [manifestSource, packageSource, packageLockSource, versionsSource] = await Promise.all([
  readFile("manifest.json", "utf8"),
  readFile("package.json", "utf8"),
  readFile("package-lock.json", "utf8"),
  readFile("versions.json", "utf8"),
]);
const manifest = JSON.parse(manifestSource);
const packageJson = JSON.parse(packageSource);
const packageLock = JSON.parse(packageLockSource);
const versions = JSON.parse(versionsSource);

assertPackageVersionContract(manifest, packageJson, versions);
assertPackageLockContract(packageJson, packageLock);
assertReleaseTag(releaseTag, manifest.version);

process.stdout.write(`Release version contract passed for ${releaseTag}.\n`);
