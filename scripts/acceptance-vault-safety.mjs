import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const ACCEPTANCE_MARKER_NAME = ".property-order-acceptance.json";
export const ACCEPTANCE_LOCK_NAME = ".property-order-acceptance.lock";
export const ACCEPTANCE_VAULT_PREFIX = "property-order-acceptance-";

const ACCEPTANCE_MARKER_KIND = "property-order-acceptance-vault";
const ACCEPTANCE_MARKER_VERSION = 1;
const SHA256_PATTERN = /^[a-f\d]{64}$/u;
const UUID_PATTERN =
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iu;

export async function resolveIsolatedAcceptanceVaultPath(
  vaultPath,
  { allowUninitialized = false } = {},
) {
  const requestedVaultPath = path.resolve(vaultPath);

  try {
    const vaultStats = await lstat(requestedVaultPath);

    if (vaultStats.isSymbolicLink() || !vaultStats.isDirectory()) {
      throw new Error("vault root is not a regular directory");
    }

    const [resolvedVaultPath, resolvedTemporaryRoot] = await Promise.all([
      realpath(requestedVaultPath),
      realpath(tmpdir()),
    ]);
    assertDirectAcceptanceChild(resolvedTemporaryRoot, resolvedVaultPath);

    const obsidianPath = path.join(resolvedVaultPath, ".obsidian");
    const obsidianStats = await lstat(obsidianPath);

    if (obsidianStats.isSymbolicLink() || !obsidianStats.isDirectory()) {
      throw new Error(".obsidian is not a regular directory");
    }

    const resolvedObsidianPath = await realpath(obsidianPath);

    if (!areSamePath(resolvedObsidianPath, obsidianPath)) {
      throw new Error(".obsidian resolves outside the vault");
    }

    const markerPath = path.join(resolvedVaultPath, ACCEPTANCE_MARKER_NAME);
    const marker = await readAcceptanceMarker(markerPath, { allowMissing: allowUninitialized });
    if (marker != null && !areSamePath(marker.vaultPath, resolvedVaultPath)) {
      throw new Error("Acceptance Vault marker is bound to a different path");
    }

    return { marker, markerPath, vaultPath: resolvedVaultPath };
  } catch (error) {
    throw new Error(`Not an isolated Property Order acceptance Vault: ${requestedVaultPath}`, {
      cause: error,
    });
  }
}

export async function assertSafeAcceptanceVaultInitialization(vaultPath) {
  const rootEntries = await readdir(vaultPath, { withFileTypes: true });
  const expectedNames = new Set([".obsidian", ACCEPTANCE_LOCK_NAME]);

  if (
    rootEntries.length !== expectedNames.size ||
    rootEntries.some((entry) => !expectedNames.has(entry.name)) ||
    !rootEntries.some((entry) => entry.name === ".obsidian" && entry.isDirectory()) ||
    !rootEntries.some((entry) => entry.name === ACCEPTANCE_LOCK_NAME && entry.isFile())
  ) {
    throw new Error(
      "A new acceptance Vault may contain only a regular .obsidian directory and its active acceptance lock",
    );
  }

  const obsidianPath = path.join(vaultPath, ".obsidian");
  const obsidianEntries = await readdir(obsidianPath, { withFileTypes: true });

  for (const entry of obsidianEntries) {
    if (entry.name !== "types.json" || !entry.isFile()) {
      throw new Error(
        "A new acceptance Vault .obsidian directory may contain only a regular types.json",
      );
    }
  }
}

export async function acquireAcceptanceVaultLock(vaultPath, { beforeVerify } = {}) {
  const lockPath = path.join(vaultPath, ACCEPTANCE_LOCK_NAME);
  const creationDirectory = await mkdtemp(
    path.join(vaultPath, `.${ACCEPTANCE_LOCK_NAME}.create-`),
  );
  const stagedLockPath = path.join(creationDirectory, "lock");
  const lock = {
    createdAt: new Date().toISOString(),
    pid: process.pid,
    runId: randomUUID(),
  };
  const content = `${JSON.stringify(lock, null, 2)}\n`;
  let lockCommitted = false;
  let operationError = null;
  let result;
  let stagedState = null;

  try {
    await writeFile(stagedLockPath, content, { encoding: "utf8", flag: "wx" });
    stagedState = await captureRegularFileState(stagedLockPath);

    try {
      await link(stagedLockPath, lockPath);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new Error(
          `Acceptance Vault is locked; inspect and remove a stale lock manually: ${lockPath}`,
          { cause: error },
        );
      }
      throw error;
    }

    await beforeVerify?.({ lockPath });
    const installedState = await captureRegularFileState(lockPath);
    if (!areSameRegularFileState(installedState, stagedState)) {
      throw new Error(`Acceptance Vault lock changed while it was acquired: ${lockPath}`);
    }
    lockCommitted = true;
    result = { lockPath, state: stagedState };
  } catch (error) {
    operationError = error;
  }

  let cleanupError = null;
  try {
    if (stagedState != null) {
      await removeRegularFileIfUnchanged(stagedLockPath, stagedState, {
        allowMissing: true,
        label: "Staged acceptance Vault lock",
      });
      await removeEmptyPrivateDirectory(creationDirectory);
    } else {
      await removeEmptyPrivateDirectory(creationDirectory);
    }
  } catch (error) {
    cleanupError = error;
  }

  if (lockCommitted && cleanupError != null) {
    console.warn(
      `Property Order: acceptance Vault lock acquired, but private cleanup was retained under ${creationDirectory}`,
      cleanupError,
    );
  } else if (operationError != null && cleanupError != null) {
    throw new AggregateError(
      [operationError, cleanupError],
      `Acceptance Vault lock acquisition failed and private cleanup was retained under ${creationDirectory}`,
    );
  } else if (cleanupError != null) {
    throw cleanupError;
  }

  if (operationError != null) {
    throw operationError;
  }

  return result;
}

export async function releaseAcceptanceVaultLock(lock, { beforeRemove } = {}) {
  await removeRegularFileIfUnchanged(lock.lockPath, lock.state, {
    beforeRemove,
    label: "Acceptance Vault lock",
  });
}

export async function captureRegularFileState(filePath, { allowMissing = false } = {}) {
  let beforeStats;

  try {
    beforeStats = await lstat(filePath);
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") {
      return { exists: false };
    }
    throw error;
  }

  if (beforeStats.isSymbolicLink() || !beforeStats.isFile()) {
    throw new Error(`File is not a regular file: ${filePath}`);
  }

  const content = await readFile(filePath);
  const afterStats = await lstat(filePath);

  if (
    afterStats.isSymbolicLink() ||
    !afterStats.isFile() ||
    afterStats.dev !== beforeStats.dev ||
    afterStats.ino !== beforeStats.ino
  ) {
    throw new Error(`File identity changed while it was inspected: ${filePath}`);
  }

  return {
    dev: afterStats.dev,
    exists: true,
    hash: sha256(content),
    ino: afterStats.ino,
  };
}

export async function assertRegularFileState(filePath, expectedState, message) {
  const currentState = await captureRegularFileState(filePath, { allowMissing: true });

  if (!areSameRegularFileState(currentState, expectedState)) {
    throw new Error(`${message}: ${filePath}`);
  }
}

export async function removeRegularFileIfUnchanged(
  filePath,
  expectedState,
  {
    allowMissing = false,
    beforeRemove,
    label = "File",
  } = {},
) {
  const isolationDirectory = await mkdtemp(
    path.join(path.dirname(filePath), `.${path.basename(filePath)}.cleanup-`),
  );
  const isolatedPath = path.join(isolationDirectory, "preserved");
  await beforeRemove?.({ filePath, isolatedPath });

  try {
    await rename(filePath, isolatedPath);
  } catch (error) {
    await removeEmptyPrivateDirectory(isolationDirectory);
    if (allowMissing && error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  let isolatedState;
  try {
    isolatedState = await captureRegularFileState(isolatedPath);
  } catch (error) {
    throw new Error(
      `${label} could not be verified after isolation; preserved path: ${isolatedPath}`,
      { cause: error },
    );
  }

  if (!areSameRegularFileState(isolatedState, expectedState)) {
    await restoreIsolatedRegularFile({
      filePath,
      isolatedPath,
      isolatedState,
      reason: `${label} changed before cleanup`,
    });
    throw new Error(
      `${label} changed before cleanup; preserved path: ${isolatedPath}`,
    );
  }

  try {
    await rm(isolatedPath);
  } catch (error) {
    throw new Error(
      `${label} cleanup failed; preserved path: ${isolatedPath}`,
      { cause: error },
    );
  }

  await removeEmptyPrivateDirectory(isolationDirectory);
}

export async function createAcceptanceMarker(markerPath, vaultPath) {
  const marker = {
    createdAt: new Date().toISOString(),
    generatedFiles: {},
    kind: ACCEPTANCE_MARKER_KIND,
    markerVersion: ACCEPTANCE_MARKER_VERSION,
    runId: randomUUID(),
    state: "creating",
    vaultPath,
  };
  await writeFile(markerPath, serializeMarker(marker), { encoding: "utf8", flag: "wx" });
  return marker;
}

export async function writeAcceptanceMarker(
  markerPath,
  marker,
  { beforeReplace, expectedMarker } = {},
) {
  if (expectedMarker == null) {
    throw new Error("An expected acceptance marker is required for replacement");
  }

  validateAcceptanceMarker(marker, { requireReady: marker.state === "ready" });
  const replacementDirectory = await mkdtemp(
    path.join(path.dirname(markerPath), `.${path.basename(markerPath)}.replace-`),
  );
  const temporaryPath = path.join(replacementDirectory, "next");
  const preservedPath = path.join(replacementDirectory, "previous");
  let retainReplacementDirectory = false;
  let markerCommitted = false;
  let previousState = null;
  let temporaryState = null;

  try {
    await writeFile(temporaryPath, serializeMarker(marker), { encoding: "utf8", flag: "wx" });
    temporaryState = await captureRegularFileState(temporaryPath);
    const currentMarker = await readFile(markerPath, "utf8");
    if (currentMarker !== serializeMarker(expectedMarker)) {
      throw new Error(`Acceptance marker changed before update: ${markerPath}`);
    }
    const expectedState = await captureRegularFileState(markerPath);
    if (expectedState.hash !== sha256(currentMarker)) {
      throw new Error(`Acceptance marker changed while it was inspected: ${markerPath}`);
    }

    await beforeReplace?.({ markerPath, preservedPath });
    await rename(markerPath, preservedPath);
    retainReplacementDirectory = true;
    previousState = await captureRegularFileState(preservedPath);

    if (!areSameRegularFileState(previousState, expectedState)) {
      retainReplacementDirectory = true;
      await restoreIsolatedRegularFile({
        filePath: markerPath,
        isolatedPath: preservedPath,
        isolatedState: previousState,
        reason: "Acceptance marker changed before replacement",
      });
      throw new Error(
        `Acceptance marker changed before replacement; preserved path: ${preservedPath}`,
      );
    }

    try {
      await link(temporaryPath, markerPath);
    } catch (error) {
      retainReplacementDirectory = true;
      throw new Error(
        `Acceptance marker replacement was blocked; previous marker preserved at ${preservedPath}`,
        { cause: error },
      );
    }

    const installedState = await captureRegularFileState(markerPath);
    if (!areSameRegularFileState(installedState, temporaryState)) {
      throw new Error(
        `Acceptance marker replacement could not be verified; previous marker preserved at ${preservedPath}`,
      );
    }
    markerCommitted = true;
    retainReplacementDirectory = false;
  } finally {
    if (markerCommitted) {
      await cleanupCommittedMarkerReplacement({
        preservedPath,
        previousState,
        replacementDirectory,
        temporaryPath,
        temporaryState,
      });
    } else if (!retainReplacementDirectory) {
      if (temporaryState != null) {
        await removeRegularFileIfUnchanged(temporaryPath, temporaryState, {
          allowMissing: true,
          label: "Staged acceptance marker",
        });
      }
      await removeEmptyPrivateDirectory(replacementDirectory);
    }
  }
}

export async function removeAcceptanceMarker(
  markerPath,
  runId,
  { beforeRemove } = {},
) {
  const marker = await readAcceptanceMarker(markerPath, { requireReady: false });
  if (marker.runId !== runId) {
    throw new Error(`Acceptance marker changed before cleanup: ${markerPath}`);
  }
  const expectedContent = serializeMarker(marker);
  const currentContent = await readFile(markerPath, "utf8");
  if (currentContent !== expectedContent) {
    throw new Error(`Acceptance marker changed before cleanup: ${markerPath}`);
  }
  const markerState = await captureRegularFileState(markerPath);
  if (markerState.hash !== sha256(currentContent)) {
    throw new Error(`Acceptance marker changed while it was inspected: ${markerPath}`);
  }
  await removeRegularFileIfUnchanged(markerPath, markerState, {
    beforeRemove,
    label: "Acceptance marker",
  });
}

export async function verifyAcceptanceFixtureManifest(
  vaultPath,
  marker,
  expectedFileNames,
) {
  const expectedNames = [...expectedFileNames].sort();
  const recordedNames = Object.keys(marker.generatedFiles).sort();

  if (
    expectedNames.length !== recordedNames.length ||
    expectedNames.some((name, index) => name !== recordedNames[index])
  ) {
    throw new Error("Acceptance marker fixture manifest is incomplete or unexpected");
  }

  for (const fileName of expectedNames) {
    const filePath = path.join(vaultPath, fileName);
    const fileState = await captureRegularFileState(filePath);
    const actualHash = fileState.hash;
    if (actualHash !== marker.generatedFiles[fileName]) {
      throw new Error(
        `Acceptance fixture does not match its marker hash: ${filePath}`,
      );
    }
  }
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function readAcceptanceMarker(
  markerPath,
  { allowMissing = false, requireReady = true } = {},
) {
  let stats;

  try {
    stats = await lstat(markerPath);
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") {
      return null;
    }
    throw new Error(`Acceptance Vault marker is missing: ${markerPath}`, { cause: error });
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`Acceptance Vault marker is not a regular file: ${markerPath}`);
  }

  let marker;
  let markerContent;
  try {
    markerContent = await readFile(markerPath, "utf8");
    marker = JSON.parse(markerContent);
  } catch (error) {
    throw new Error(`Invalid acceptance Vault marker: ${markerPath}`, { cause: error });
  }

  const stableState = await captureRegularFileState(markerPath);
  if (
    stableState.dev !== stats.dev ||
    stableState.ino !== stats.ino ||
    stableState.hash !== sha256(markerContent)
  ) {
    throw new Error(`Acceptance Vault marker changed while it was inspected: ${markerPath}`);
  }

  validateAcceptanceMarker(marker, { requireReady });
  return marker;
}

function validateAcceptanceMarker(marker, { requireReady }) {
  if (
    marker == null ||
    typeof marker !== "object" ||
    Array.isArray(marker) ||
    marker.kind !== ACCEPTANCE_MARKER_KIND ||
    marker.markerVersion !== ACCEPTANCE_MARKER_VERSION ||
    !UUID_PATTERN.test(marker.runId) ||
    typeof marker.createdAt !== "string" ||
    !Number.isFinite(Date.parse(marker.createdAt)) ||
    (requireReady && marker.state !== "ready") ||
    (!requireReady && marker.state !== "creating" && marker.state !== "ready") ||
    marker.generatedFiles == null ||
    typeof marker.generatedFiles !== "object" ||
    Array.isArray(marker.generatedFiles) ||
    typeof marker.vaultPath !== "string" ||
    !path.isAbsolute(marker.vaultPath)
  ) {
    throw new Error("Acceptance Vault marker contract is invalid");
  }

  for (const [fileName, hash] of Object.entries(marker.generatedFiles)) {
    if (
      path.basename(fileName) !== fileName ||
      fileName === ACCEPTANCE_MARKER_NAME ||
      typeof hash !== "string" ||
      !SHA256_PATTERN.test(hash)
    ) {
      throw new Error("Acceptance Vault marker file manifest is invalid");
    }
  }
}

function assertDirectAcceptanceChild(temporaryRoot, vaultPath) {
  const relativePath = path.relative(temporaryRoot, vaultPath);
  if (
    relativePath.length === 0 ||
    path.dirname(relativePath) !== "." ||
    !path.basename(relativePath).startsWith(ACCEPTANCE_VAULT_PREFIX)
  ) {
    throw new Error(
      `acceptance Vault must be a direct ${ACCEPTANCE_VAULT_PREFIX}* child of ${temporaryRoot}`,
    );
  }
}

function serializeMarker(marker) {
  return `${JSON.stringify(marker, null, 2)}\n`;
}

async function restoreIsolatedRegularFile({
  filePath,
  isolatedPath,
  isolatedState,
  reason,
}) {
  try {
    await link(isolatedPath, filePath);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `${reason}; destination is occupied and the isolated file remains at ${isolatedPath}`,
        { cause: error },
      );
    }
    throw new Error(`${reason}; isolated file remains at ${isolatedPath}`, {
      cause: error,
    });
  }

  const restoredState = await captureRegularFileState(filePath);
  if (!areSameRegularFileState(restoredState, isolatedState)) {
    throw new Error(
      `${reason}; exclusive restore could not be verified and the isolated file remains at ${isolatedPath}`,
    );
  }
}

async function cleanupCommittedMarkerReplacement({
  preservedPath,
  previousState,
  replacementDirectory,
  temporaryPath,
  temporaryState,
}) {
  const cleanupErrors = [];

  for (const [filePath, state, label] of [
    [temporaryPath, temporaryState, "Staged acceptance marker"],
    [preservedPath, previousState, "Previous acceptance marker"],
  ]) {
    if (state == null) {
      continue;
    }

    try {
      await removeRegularFileIfUnchanged(filePath, state, { label });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  try {
    await removeEmptyPrivateDirectory(replacementDirectory);
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    console.warn(
      `Property Order: acceptance marker committed, but private cleanup retained files under ${replacementDirectory}`,
      new AggregateError(cleanupErrors),
    );
  }
}

async function removeEmptyPrivateDirectory(directoryPath) {
  try {
    await rmdir(directoryPath);
  } catch (error) {
    throw new Error(
      `Private acceptance directory is not empty and was retained: ${directoryPath}`,
      { cause: error },
    );
  }
}

function areSamePath(left, right) {
  const normalize = (value) =>
    process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}

export function areSameRegularFileState(left, right) {
  return (
    left?.exists === right?.exists &&
    (!left?.exists ||
      (left.dev === right.dev && left.ino === right.ino && left.hash === right.hash))
  );
}
