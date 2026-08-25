import { readFile } from "node:fs/promises";

import { assertLocalTagPointsToHead } from "./local-tag-contract.mjs";
import {
  assertPackageLockContract,
  assertPackageVersionContract,
  assertReleaseTag,
} from "./release-contract.mjs";

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
const releaseTag = process.argv[2] ?? manifest.version;

assertPackageVersionContract(manifest, packageJson, versions);
assertPackageLockContract(packageJson, packageLock);
assertReleaseTag(releaseTag, manifest.version);
await assertLocalTagPointsToHead(releaseTag);

process.stdout.write(`Release version contract passed for ${releaseTag}.\n`);
