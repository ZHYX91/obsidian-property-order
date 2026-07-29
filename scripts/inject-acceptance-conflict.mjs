import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACCEPTANCE_CONFLICT_MARKERS,
  ACCEPTANCE_FIXTURE_FILE_NAMES,
} from "./acceptance-fixture-spec.mjs";
import { resolveIsolatedAcceptanceVaultPath } from "./acceptance-vault-safety.mjs";

function parseArguments(arguments_) {
  const fileIndex = arguments_.indexOf("--file");
  const vaultIndex = arguments_.indexOf("--vault");
  const delayIndex = arguments_.indexOf("--delay-ms");
  const expectedHashIndex = arguments_.indexOf("--expected-sha256");
  const modeIndex = arguments_.indexOf("--mode");
  const delayText = delayIndex >= 0 ? arguments_[delayIndex + 1] : "0";
  const delayMs = Number(delayText);
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error(`Invalid --delay-ms value: ${delayText}`);
  }
  return {
    delayMs,
    expectedSha256:
      expectedHashIndex >= 0 ? arguments_[expectedHashIndex + 1] : undefined,
    filePath: fileIndex >= 0 ? arguments_[fileIndex + 1] : undefined,
    mode: modeIndex >= 0 ? arguments_[modeIndex + 1] : "source",
    vaultPath: vaultIndex >= 0 ? arguments_[vaultIndex + 1] : undefined,
  };
}

function replaceSingleMarker(content, mode) {
  const markers = ACCEPTANCE_CONFLICT_MARKERS[mode];
  if (markers == null) {
    throw new Error(`Invalid conflict mode: ${mode}`);
  }

  const matches = markers.flatMap((marker) => {
    const markerIndex = content.indexOf(marker.expected);

    if (markerIndex < 0) {
      return [];
    }

    if (content.indexOf(marker.expected, markerIndex + 1) >= 0) {
      throw new Error(`Acceptance marker is not unique: ${marker.expected}`);
    }

    return [{ marker, markerIndex }];
  });

  if (matches.length === 0) {
    throw new Error(`Missing acceptance marker for mode: ${mode}`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple acceptance markers match mode: ${mode}`);
  }

  const [{ marker, markerIndex }] = matches;
  return `${content.slice(0, markerIndex)}${marker.replacement}${content.slice(
    markerIndex + marker.expected.length,
  )}`;
}

export async function injectAcceptanceConflict({
  filePath,
  delayMs = 0,
  expectedSha256,
  mode = "source",
  vaultPath,
}) {
  if (!filePath || !vaultPath) {
    throw new Error(
      "Usage: npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> [--delay-ms <ms>]",
    );
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error(`Invalid delay: ${delayMs}`);
  }
  if (expectedSha256 != null && !/^[a-f\d]{64}$/i.test(expectedSha256)) {
    throw new Error(`Invalid expected SHA-256: ${expectedSha256}`);
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const absoluteFilePath = await resolveVaultFixture(vaultPath, filePath);
  const content = await readFile(absoluteFilePath, "utf8");
  const originalSha256 = createHash("sha256").update(content).digest("hex");

  if (expectedSha256 != null && originalSha256 !== expectedSha256.toLowerCase()) {
    throw new Error(
      `Acceptance fixture SHA-256 changed: expected ${expectedSha256.toLowerCase()}, found ${originalSha256}`,
    );
  }

  const updatedContent = replaceSingleMarker(content, mode);
  const temporaryPath = path.join(
    path.dirname(absoluteFilePath),
    `.${path.basename(absoluteFilePath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, updatedContent, { encoding: "utf8", flag: "wx" });
    const latestContent = await readFile(absoluteFilePath, "utf8");
    const latestSha256 = createHash("sha256").update(latestContent).digest("hex");

    if (latestSha256 !== originalSha256) {
      throw new Error(
        `Acceptance fixture changed before conflict injection: ${absoluteFilePath}`,
      );
    }

    await rename(temporaryPath, absoluteFilePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  return {
    filePath: absoluteFilePath,
    mode,
    sha256: createHash("sha256").update(updatedContent).digest("hex"),
  };
}

async function resolveVaultFixture(vaultPath, filePath) {
  const absoluteVaultPath = await resolveIsolatedAcceptanceVaultPath(vaultPath);

  const requestedFilePath = path.resolve(filePath);
  const requestedStats = await lstat(requestedFilePath);

  if (requestedStats.isSymbolicLink() || !requestedStats.isFile()) {
    throw new Error(`Acceptance fixture is not a regular file: ${requestedFilePath}`);
  }

  const absoluteFilePath = await realpath(requestedFilePath);
  const relativePath = path.relative(absoluteVaultPath, absoluteFilePath);

  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Acceptance fixture is outside the selected vault: ${absoluteFilePath}`);
  }

  if (
    path.dirname(relativePath) !== "." ||
    !ACCEPTANCE_FIXTURE_FILE_NAMES.has(path.basename(absoluteFilePath))
  ) {
    throw new Error(`Not a generated Property Order fixture: ${absoluteFilePath}`);
  }

  return absoluteFilePath;
}

async function main() {
  const result = await injectAcceptanceConflict(
    parseArguments(process.argv.slice(2)),
  );
  console.log(`Injected acceptance conflict: ${result.filePath}`);
  console.log(`SHA-256: ${result.sha256.toUpperCase()}`);
}

const entryPoint = typeof process !== "undefined" && process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === entryPoint) {
  await main();
}
