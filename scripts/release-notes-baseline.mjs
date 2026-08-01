import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function selectReleaseNotesBaseline(releases, currentVersion) {
  const current = parseVersion(currentVersion, "Current release version");
  const publishedVersions = flattenReleases(releases)
    .filter((release) =>
      release != null &&
      release.draft === false &&
      release.prerelease === false &&
      typeof release.published_at === "string" &&
      release.published_at.length > 0
    )
    .flatMap((release) => {
      if (typeof release.tag_name !== "string" || !SEMVER_PATTERN.test(release.tag_name)) {
        return [];
      }

      return [{ release, version: parseVersion(release.tag_name, "Release tag") }];
    });

  for (const candidate of publishedVersions) {
    assert.ok(
      compareVersions(candidate.version, current) < 0,
      `Published Release ${candidate.release.tag_name} is not older than ${currentVersion}; release versions must advance`,
    );
  }

  publishedVersions.sort((left, right) => compareVersions(right.version, left.version));
  return publishedVersions[0]?.release.tag_name ?? null;
}

function flattenReleases(value) {
  assert.ok(Array.isArray(value), "GitHub Releases response must be an array");
  return value.flatMap((item) => Array.isArray(item) ? item : [item]);
}

function parseVersion(value, label) {
  const match = SEMVER_PATTERN.exec(value);
  assert.ok(match, `${label} must use x.y.z without a v prefix`);
  const version = match.slice(1).map((part) => Number.parseInt(part, 10));
  assert.ok(
    version.every(Number.isSafeInteger),
    `${label} components must be safe integers`,
  );
  return version;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

async function main() {
  const currentVersionIndex = process.argv.indexOf("--current-version");
  const currentVersion = currentVersionIndex === -1
    ? undefined
    : process.argv[currentVersionIndex + 1];
  assert.ok(currentVersion, "Usage: release-notes-baseline.mjs --current-version <x.y.z>");

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const releases = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const baseline = selectReleaseNotesBaseline(releases, currentVersion);
  if (baseline != null) {
    process.stdout.write(`${baseline}\n`);
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;
if (import.meta.url === entryPoint) {
  await main();
}
