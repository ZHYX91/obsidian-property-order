import assert from "node:assert/strict";

export function assertPackageVersionContract(manifest, packageJson, versions) {
  assert.equal(
    manifest.version,
    packageJson.version,
    "manifest.json and package.json versions must match",
  );
  assert.equal(
    versions[manifest.version],
    manifest.minAppVersion,
    "versions.json must map the package version to manifest.json minAppVersion",
  );
}

export function assertReleaseTag(releaseTag, manifestVersion) {
  assert.match(
    releaseTag,
    /^\d+\.\d+\.\d+$/u,
    "Release tag must use x.y.z without a v prefix",
  );
  assert.equal(
    releaseTag,
    manifestVersion,
    "Release tag must match manifest.json version",
  );
}
