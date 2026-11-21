import { readFile } from "node:fs/promises";

import "./check-shared-tools.mjs";

const { assertRuntimeContract, parseNpmVersion } = await import("./runtime-contract.mjs");

const [nodeVersionSource, packageSource] = await Promise.all([
  readFile(".node-version", "utf8"),
  readFile("package.json", "utf8"),
]);
const configuredNodeVersion = nodeVersionSource.trim();
const packageJson = JSON.parse(packageSource);
const currentNpmVersion = parseNpmVersion(process.env.npm_config_user_agent);

const currentNodeVersion = process.versions.node;
const [nodeMajor, nodeMinor, nodePatch] = currentNodeVersion.split(".").map(Number);
const communityBuild = process.argv[2] === "--build"
  && nodeMajor === 22
  && (nodeMinor > 23 || (nodeMinor === 23 && nodePatch >= 5))
  && /^(?:10\.9|11\.\d+)\.\d+$/u.test(currentNpmVersion);

// The Community build has its own toolchain bounds. Validate the official pin metadata
// in both modes, and compare it with the actual runtime for the official checks.
assertRuntimeContract({
  configuredNodeVersion,
  currentNodeVersion: communityBuild ? configuredNodeVersion : currentNodeVersion,
  currentNpmVersion: communityBuild ? packageJson.packageManager?.slice("npm@".length) : currentNpmVersion,
  packageJson,
});

process.stdout.write(
  `Runtime contract passed for Node.js ${currentNodeVersion} and npm ${currentNpmVersion}.\n`,
);
