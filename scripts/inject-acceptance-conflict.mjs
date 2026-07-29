import { randomUUID } from "node:crypto";
import { link, lstat, readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACCEPTANCE_CONFLICT_MARKERS,
  ACCEPTANCE_FIXTURE_FILE_NAMES,
} from "./acceptance-fixture-spec.mjs";
import {
  acquireAcceptanceVaultLock,
  areSameRegularFileState,
  assertRegularFileState,
  captureRegularFileState,
  releaseAcceptanceVaultLock,
  removeRegularFileIfUnchanged,
  resolveIsolatedAcceptanceVaultPath,
  sha256,
  verifyAcceptanceFixtureManifest,
  writeAcceptanceMarker,
} from "./acceptance-vault-safety.mjs";

function parseArguments(arguments_) {
  const values = new Map();
  const allowedFlags = new Set([
    "--delay-ms",
    "--expected-sha256",
    "--file",
    "--mode",
    "--vault",
  ]);

  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];
    if (!allowedFlags.has(flag)) {
      throw new Error(`Unknown conflict-injection argument: ${flag}`);
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate conflict-injection argument: ${flag}`);
    }
    const value = arguments_[index + 1];
    if (value == null || value.length === 0 || value.startsWith("--")) {
      throw new Error(`Missing value for conflict-injection argument: ${flag}`);
    }
    values.set(flag, value);
    index += 1;
  }

  const delayText = values.get("--delay-ms") ?? "0";
  const delayMs = Number(delayText);
  if (!isValidDelay(delayMs)) {
    throw new Error(`Invalid --delay-ms value: ${delayText}`);
  }
  return {
    delayMs,
    expectedSha256: values.get("--expected-sha256"),
    filePath: values.get("--file"),
    mode: values.get("--mode") ?? "source",
    vaultPath: values.get("--vault"),
  };
}

function isValidDelay(delayMs) {
  return Number.isSafeInteger(delayMs) && delayMs >= 0 && delayMs <= 0x7fffffff;
}

function replaceSingleMarker(content, mode) {
  if (!Object.prototype.hasOwnProperty.call(ACCEPTANCE_CONFLICT_MARKERS, mode)) {
    throw new Error(`Invalid conflict mode: ${mode}`);
  }
  const markers = ACCEPTANCE_CONFLICT_MARKERS[mode];

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
  beforeReplace,
  beforeRollback,
  filePath,
  delayMs = 0,
  expectedSha256,
  mode = "source",
  updateMarker = writeAcceptanceMarker,
  vaultPath,
}) {
  if (!filePath || !vaultPath) {
    throw new Error(
      "Usage: npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --expected-sha256 <sha256> [--delay-ms <ms>]",
    );
  }
  if (!isValidDelay(delayMs)) {
    throw new Error(`Invalid delay: ${delayMs}`);
  }
  if (expectedSha256 == null) {
    throw new Error("--expected-sha256 is required for conflict injection");
  }
  if (!/^[a-f\d]{64}$/i.test(expectedSha256)) {
    throw new Error(`Invalid expected SHA-256: ${expectedSha256}`);
  }
  if (!Object.prototype.hasOwnProperty.call(ACCEPTANCE_CONFLICT_MARKERS, mode)) {
    throw new Error(`Invalid conflict mode: ${mode}`);
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const preliminaryVault = await resolveIsolatedAcceptanceVaultPath(vaultPath);
  const lock = await acquireAcceptanceVaultLock(preliminaryVault.vaultPath);
  let operationError;
  let result;

  try {
    result = await injectAcceptanceConflictWhileLocked({
      expectedSha256,
      beforeReplace,
      beforeRollback,
      filePath,
      mode,
      updateMarker,
      vaultPath: preliminaryVault.vaultPath,
    });
  } catch (error) {
    operationError = error;
  }

  let releaseError;
  try {
    await releaseAcceptanceVaultLock(lock);
  } catch (error) {
    releaseError = error;
  }

  if (operationError != null && releaseError != null) {
    throw new AggregateError(
      [operationError, releaseError],
      `Acceptance conflict injection failed and its lock could not be released: ${lock.lockPath}`,
    );
  }
  if (operationError != null) {
    throw operationError;
  }
  if (releaseError != null) {
    throw releaseError;
  }

  return result;
}

async function injectAcceptanceConflictWhileLocked({
  beforeReplace,
  beforeRollback,
  expectedSha256,
  filePath,
  mode,
  updateMarker,
  vaultPath,
}) {
  const resolvedFixture = await resolveVaultFixture(vaultPath, filePath);
  const {
    absoluteFilePath,
    fileState,
    marker,
    markerPath,
    resolvedVaultPath,
  } = resolvedFixture;
  await verifyAcceptanceFixtureManifest(
    resolvedVaultPath,
    marker,
    ACCEPTANCE_FIXTURE_FILE_NAMES,
  );
  const content = await readFile(absoluteFilePath, "utf8");
  const originalSha256 = sha256(content);

  if (
    fileState.hash !== originalSha256 ||
    originalSha256 !== expectedSha256.toLowerCase()
  ) {
    throw new Error(
      `Acceptance fixture SHA-256 changed: expected ${expectedSha256.toLowerCase()}, found ${originalSha256}`,
    );
  }

  const updatedContent = replaceSingleMarker(content, mode);
  const temporaryPath = path.join(
    path.dirname(absoluteFilePath),
    `.${path.basename(absoluteFilePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const rollbackPath = `${temporaryPath}.rollback`;
  let temporaryState = null;
  let rollbackState = null;
  let installedState = null;
  let markerUpdated = false;
  let preserveRollback = false;
  const updatedSha256 = sha256(updatedContent);
  const updatedMarker = {
    ...marker,
    generatedFiles: {
      ...marker.generatedFiles,
      [path.basename(absoluteFilePath)]: updatedSha256,
    },
  };

  try {
    await writeFile(temporaryPath, updatedContent, { encoding: "utf8", flag: "wx" });
    temporaryState = await captureRegularFileState(temporaryPath);
    await assertRegularFileState(
      absoluteFilePath,
      fileState,
      "Acceptance fixture changed before conflict injection",
    );

    await beforeReplace?.({ filePath: absoluteFilePath, rollbackPath });
    await rename(absoluteFilePath, rollbackPath);
    rollbackState = await captureRegularFileState(rollbackPath);
    preserveRollback = true;
    if (!areSameRegularFileState(rollbackState, fileState)) {
      preserveRollback = true;
      await restoreFileExclusively({
        filePath: absoluteFilePath,
        preservedPath: rollbackPath,
        preservedState: rollbackState,
        reason: "Acceptance fixture changed before conflict replacement",
      });
      throw new Error(
        `Acceptance fixture changed before conflict replacement; preserved copy: ${rollbackPath}`,
      );
    }

    try {
      await link(temporaryPath, absoluteFilePath);
    } catch (error) {
      if (error?.code === "EEXIST") {
        preserveRollback = true;
        throw new Error(
          `Acceptance fixture was recreated before conflict installation; original preserved at ${rollbackPath}`,
          { cause: error },
        );
      }
      throw error;
    }
    const candidateInstalledState = await captureRegularFileState(absoluteFilePath);
    if (!areSameRegularFileState(candidateInstalledState, temporaryState)) {
      preserveRollback = true;
      throw new Error(
        `Acceptance conflict replacement could not be verified: ${absoluteFilePath}`,
      );
    }
    installedState = candidateInstalledState;
    await removeRegularFileIfUnchanged(temporaryPath, temporaryState);
    temporaryState = null;

    await updateMarker(
      markerPath,
      updatedMarker,
      { expectedMarker: marker },
    );
    markerUpdated = true;
    await assertRegularFileState(
      absoluteFilePath,
      installedState,
      "Acceptance fixture changed before conflict commit completed",
    );
    preserveRollback = false;
  } catch (error) {
    const rollbackErrors = [];
    let rollbackCompleted = false;
    if (installedState != null) {
      try {
        await restoreConflictFixture({
          absoluteFilePath,
          fileState,
          installedState,
          beforeRollback,
          rollbackPath,
          rollbackState,
          updatedSha256,
        });
        rollbackCompleted = true;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (markerUpdated && rollbackErrors.length === 0) {
      try {
        await writeAcceptanceMarker(markerPath, marker, {
          expectedMarker: updatedMarker,
        });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (rollbackErrors.length > 0) {
      preserveRollback = rollbackState != null;
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Conflict injection failed and rollback was refused. Retained rollback backup: ${rollbackPath}. ${rollbackErrors.map((rollbackError) => rollbackError.message).join(" ")}`,
      );
    }
    if (rollbackCompleted) {
      preserveRollback = false;
    }
    throw error;
  } finally {
    if (temporaryState != null) {
      await removeRegularFileIfUnchanged(temporaryPath, temporaryState, {
        allowMissing: true,
      });
    }
    if (!preserveRollback && rollbackState != null) {
      await removeRegularFileIfUnchanged(rollbackPath, rollbackState, {
        allowMissing: true,
      });
    }
  }

  return {
    filePath: absoluteFilePath,
    mode,
    sha256: updatedSha256,
  };
}

async function restoreConflictFixture({
  absoluteFilePath,
  beforeRollback,
  fileState,
  installedState,
  rollbackPath,
  rollbackState,
  updatedSha256,
}) {
  await beforeRollback?.({ filePath: absoluteFilePath, rollbackPath });
  const quarantinePath = `${rollbackPath}.replaced-${randomUUID()}`;
  await rename(absoluteFilePath, quarantinePath);
  const quarantinedState = await captureRegularFileState(quarantinePath);

  if (
    !areSameRegularFileState(quarantinedState, installedState) ||
    quarantinedState.hash !== updatedSha256
  ) {
    await restoreFileExclusively({
      filePath: absoluteFilePath,
      preservedPath: quarantinePath,
      preservedState: quarantinedState,
      reason: "Acceptance fixture changed before conflict rollback",
    });
    throw new Error(
      `Acceptance fixture changed before conflict rollback; preserved copies: ${rollbackPath}, ${quarantinePath}`,
    );
  }

  await restoreFileExclusively({
    filePath: absoluteFilePath,
    preservedPath: rollbackPath,
    preservedState: rollbackState,
    reason: "Acceptance conflict rollback failed",
  });
  const restoredState = await captureRegularFileState(absoluteFilePath);
  if (restoredState.hash !== fileState.hash) {
    throw new Error(`Acceptance conflict rollback could not be verified: ${absoluteFilePath}`);
  }
  await removeRegularFileIfUnchanged(quarantinePath, quarantinedState);
}

async function restoreFileExclusively({
  filePath,
  preservedPath,
  preservedState,
  reason,
}) {
  await assertRegularFileState(
    preservedPath,
    preservedState,
    "Acceptance preserved file changed before restore",
  );
  try {
    await link(preservedPath, filePath);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `${reason}; destination is occupied, preserved file remains at ${preservedPath}`,
        { cause: error },
      );
    }
    throw error;
  }
  const restoredState = await captureRegularFileState(filePath);
  if (!areSameRegularFileState(restoredState, preservedState)) {
    throw new Error(`${reason}; exclusive restore could not be verified: ${filePath}`);
  }
}

async function resolveVaultFixture(vaultPath, filePath) {
  const resolvedVault = await resolveIsolatedAcceptanceVaultPath(vaultPath);
  const absoluteVaultPath = resolvedVault.vaultPath;

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

  return {
    absoluteFilePath,
    fileState: await captureRegularFileState(absoluteFilePath),
    marker: resolvedVault.marker,
    markerPath: resolvedVault.markerPath,
    resolvedVaultPath: absoluteVaultPath,
  };
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
