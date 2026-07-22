import { readFile } from "node:fs/promises";

import {
  assertPackageVersionContract,
  assertReleaseTag,
} from "./release-contract.mjs";

const releaseTag = process.argv[2];
if (releaseTag === undefined) {
  throw new Error("Usage: node scripts/check-release-version.mjs <release-tag>");
}

const [manifestSource, packageSource, versionsSource] = await Promise.all([
  readFile("manifest.json", "utf8"),
  readFile("package.json", "utf8"),
  readFile("versions.json", "utf8"),
]);
const manifest = JSON.parse(manifestSource);
const packageJson = JSON.parse(packageSource);
const versions = JSON.parse(versionsSource);

assertPackageVersionContract(manifest, packageJson, versions);
assertReleaseTag(releaseTag, manifest.version);

process.stdout.write(`Release version contract passed for ${releaseTag}.\n`);
