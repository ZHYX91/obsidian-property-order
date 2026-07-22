import { createHash } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MARKERS = {
  source: {
    expected: "values: [alpha, 'beta value', \"gamma:value\"]",
    replacement: "values: [external-alpha, 'beta value', \"gamma:value\"]",
  },
  unrelated: {
    expected: "other: unchanged",
    replacement: "other: external-conflict",
  },
};

function parseArguments(arguments_) {
  const fileIndex = arguments_.indexOf("--file");
  const vaultIndex = arguments_.indexOf("--vault");
  const delayIndex = arguments_.indexOf("--delay-ms");
  const modeIndex = arguments_.indexOf("--mode");
  const delayText = delayIndex >= 0 ? arguments_[delayIndex + 1] : "0";
  const delayMs = Number(delayText);
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error(`Invalid --delay-ms value: ${delayText}`);
  }
  return {
    delayMs,
    filePath: fileIndex >= 0 ? arguments_[fileIndex + 1] : undefined,
    mode: modeIndex >= 0 ? arguments_[modeIndex + 1] : "source",
    vaultPath: vaultIndex >= 0 ? arguments_[vaultIndex + 1] : undefined,
  };
}

function replaceSingleMarker(content, mode) {
  const marker = MARKERS[mode];
  if (!marker) {
    throw new Error(`Invalid conflict mode: ${mode}`);
  }
  const markerIndex = content.indexOf(marker.expected);
  if (markerIndex < 0) {
    throw new Error(`Missing acceptance marker: ${marker.expected}`);
  }
  if (content.indexOf(marker.expected, markerIndex + 1) >= 0) {
    throw new Error(`Acceptance marker is not unique: ${marker.expected}`);
  }
  return `${content.slice(0, markerIndex)}${marker.replacement}${content.slice(
    markerIndex + marker.expected.length,
  )}`;
}

export async function injectAcceptanceConflict({
  filePath,
  delayMs = 0,
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

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const absoluteFilePath = await resolveVaultFixture(vaultPath, filePath);
  const content = await readFile(absoluteFilePath, "utf8");
  const updatedContent = replaceSingleMarker(content, mode);
  await writeFile(absoluteFilePath, updatedContent, "utf8");
  return {
    filePath: absoluteFilePath,
    mode,
    sha256: createHash("sha256").update(updatedContent).digest("hex"),
  };
}

async function resolveVaultFixture(vaultPath, filePath) {
  const absoluteVaultPath = await realpath(path.resolve(vaultPath));
  const obsidianDirectory = path.join(absoluteVaultPath, ".obsidian");
  let obsidianStats;

  try {
    obsidianStats = await stat(obsidianDirectory);
  } catch {
    throw new Error(`Not an Obsidian vault: ${absoluteVaultPath}`);
  }

  if (!obsidianStats.isDirectory()) {
    throw new Error(`Not an Obsidian vault: ${absoluteVaultPath}`);
  }

  const absoluteFilePath = await realpath(path.resolve(filePath));
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
    !/^Property Order (?:LF|CRLF|CR)\.md$/.test(path.basename(absoluteFilePath))
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
