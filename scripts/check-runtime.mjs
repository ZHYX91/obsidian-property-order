import { readFile } from "node:fs/promises";

import { assertRuntimeContract, parseNpmVersion } from "./runtime-contract.mjs";

const [nodeVersionSource, packageSource] = await Promise.all([
  readFile(".node-version", "utf8"),
  readFile("package.json", "utf8"),
]);
const configuredNodeVersion = nodeVersionSource.trim();
const packageJson = JSON.parse(packageSource);
const currentNpmVersion = parseNpmVersion(process.env.npm_config_user_agent);

assertRuntimeContract({
  configuredNodeVersion,
  currentNodeVersion: process.versions.node,
  currentNpmVersion,
  packageJson,
});

process.stdout.write(
  `Runtime contract passed for Node.js ${configuredNodeVersion} and npm ${currentNpmVersion}.\n`,
);
