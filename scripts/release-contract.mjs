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

export function assertPackageLockContract(packageJson, packageLock) {
  assert.equal(
    packageLock.name,
    packageJson.name,
    "package-lock.json and package.json names must match",
  );
  assert.equal(
    packageLock.version,
    packageJson.version,
    "package-lock.json and package.json versions must match",
  );
  assert.equal(
    packageLock.packages?.[""]?.name,
    packageJson.name,
    "package-lock.json root package name must match package.json",
  );
  assert.equal(
    packageLock.packages?.[""]?.version,
    packageJson.version,
    "package-lock.json root package version must match package.json",
  );
}

export function assertReleaseTag(releaseTag, manifestVersion) {
  assert.match(
    releaseTag,
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u,
    "Release tag must use x.y.z without a v prefix",
  );
  assert.equal(
    releaseTag,
    manifestVersion,
    "Release tag must match manifest.json version",
  );
}
