import {
  access,
  link,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACCEPTANCE_FIXTURES,
  REQUIRED_ACCEPTANCE_PROPERTY_TYPES,
} from "./acceptance-fixture-spec.mjs";
import {
  acquireAcceptanceVaultLock,
  areSameRegularFileState,
  assertRegularFileState,
  assertSafeAcceptanceVaultInitialization,
  captureRegularFileState,
  createAcceptanceMarker,
  releaseAcceptanceVaultLock,
  removeAcceptanceMarker,
  removeRegularFileIfUnchanged,
  resolveIsolatedAcceptanceVaultPath,
  sha256,
  verifyAcceptanceFixtureManifest,
  writeAcceptanceMarker,
} from "./acceptance-vault-safety.mjs";

const TYPES_FILE_NAME = "types.json";

function parseArguments(arguments_) {
  const values = new Map();
  const valueFlags = new Set(["--vault"]);
  const booleanFlags = new Set(["--force", "--initialize-types"]);

  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];

    if (!valueFlags.has(flag) && !booleanFlags.has(flag)) {
      throw new Error(`Unknown acceptance-fixture argument: ${flag}`);
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate acceptance-fixture argument: ${flag}`);
    }

    if (valueFlags.has(flag)) {
      const value = arguments_[index + 1];
      if (value == null || value.length === 0 || value.startsWith("--")) {
        throw new Error(`Missing value for acceptance-fixture argument: ${flag}`);
      }
      values.set(flag, value);
      index += 1;
    } else {
      values.set(flag, true);
    }
  }

  return {
    force: values.get("--force") === true,
    initializeTypes: values.get("--initialize-types") === true,
    vaultPath: values.get("--vault"),
  };
}

async function assertFixturesDoNotExist(filePaths) {
  for (const filePath of filePaths) {
    try {
      await access(filePath);
    } catch {
      continue;
    }
    throw new Error(`Acceptance fixture already exists: ${filePath}`);
  }
}

async function snapshotExistingFixtures(filePaths) {
  const snapshots = new Map();

  for (const filePath of filePaths) {
    try {
      const fileStats = await lstat(filePath);

      if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
        throw new Error(`Acceptance fixture is not a regular file: ${filePath}`);
      }

      const content = await readFile(filePath);
      snapshots.set(filePath, {
        content,
        dev: fileStats.dev,
        exists: true,
        hash: sha256(content),
        ino: fileStats.ino,
      });
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return snapshots;
}

async function assertForcedFixturesUnchanged(snapshots) {
  for (const [filePath, snapshot] of snapshots) {
    await assertRegularFileState(
      filePath,
      snapshot,
      "Acceptance fixture changed before forced reset",
    );
  }
}

async function restorePreservedFileExclusively({
  filePath,
  preservedPath,
  preservedState,
  reason,
}) {
  await assertRegularFileState(
    preservedPath,
    preservedState,
    "Acceptance preservation copy changed before restore",
  );

  try {
    await link(preservedPath, filePath);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `${reason}; destination is occupied, so the preserved file remains at ${preservedPath}`,
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

async function installFixtureExclusively({
  attemptedWrite,
  beforeReplace,
  force,
  index,
  stagedPath,
  stagedState,
}) {
  const { beforeState, filePath, rollbackPath } = attemptedWrite;

  if (force) {
    await beforeReplace?.({ filePath, index, rollbackPath });
    await rename(filePath, rollbackPath);
    const preservedState = await captureRegularFileState(rollbackPath);
    attemptedWrite.rollbackState = preservedState;

    if (!areSameRegularFileState(preservedState, beforeState)) {
      await restorePreservedFileExclusively({
        filePath,
        preservedPath: rollbackPath,
        preservedState,
        reason: "Acceptance fixture changed before forced replacement",
      });
      throw new Error(
        `Acceptance fixture changed before forced replacement; preserved copy: ${rollbackPath}`,
      );
    }
  }

  // Hard-link creation is an atomic, cross-platform create-if-absent operation.
  // A writer that appears after preservation wins without being overwritten.
  await link(stagedPath, filePath);
  const installedState = await captureRegularFileState(filePath);
  if (!areSameRegularFileState(installedState, stagedState)) {
    throw new Error(`Acceptance fixture installation could not be verified: ${filePath}`);
  }
  attemptedWrite.installedState = installedState;
}

async function rollbackFixtureWrites(attemptedWrites, beforeRollback) {
  const rollbackErrors = [];
  const retainedBackupPaths = [];

  for (const attemptedWrite of attemptedWrites.slice().reverse()) {
    const {
      beforeState,
      filePath,
      installedState,
      index,
      rollbackPath,
      rollbackState,
      quarantinePath,
    } = attemptedWrite;

    try {
      if (rollbackPath == null) {
        if (installedState == null) {
          const currentState = await captureRegularFileState(filePath, {
            allowMissing: true,
          });
          if (!currentState.exists) {
            continue;
          }
          throw new Error(
            `Acceptance fixture exists after an uncertain create; refusing cleanup: ${filePath}`,
          );
        } else {
          await beforeRollback?.({ filePath, index });
          await rename(filePath, quarantinePath);
          const quarantinedState = await captureRegularFileState(quarantinePath);

          if (!areSameRegularFileState(quarantinedState, installedState)) {
            retainedBackupPaths.push(quarantinePath);
            await restorePreservedFileExclusively({
              filePath,
              preservedPath: quarantinePath,
              preservedState: quarantinedState,
              reason: "Acceptance fixture changed before rollback",
            });
            throw new Error(
              `Acceptance fixture changed before rollback; preserved copy: ${quarantinePath}`,
            );
          }

          const destinationState = await captureRegularFileState(filePath, {
            allowMissing: true,
          });
          if (destinationState.exists) {
            retainedBackupPaths.push(quarantinePath);
            throw new Error(
              `Acceptance fixture was recreated during rollback and was left unchanged: ${filePath}`,
            );
          }
        }
      } else {
        if (installedState == null) {
          const currentState = await captureRegularFileState(filePath, {
            allowMissing: true,
          });
          if (!currentState.exists) {
            if (rollbackState == null) {
              throw new Error(
                `Acceptance fixture disappeared before it could be preserved: ${filePath}`,
              );
            }
            await restorePreservedFileExclusively({
              filePath,
              preservedPath: rollbackPath,
              preservedState: rollbackState,
              reason: "Acceptance fixture installation failed",
            });
            continue;
          }
          if (
            currentState.dev === beforeState.dev &&
            currentState.ino === beforeState.ino &&
            currentState.hash === beforeState.hash
          ) {
            continue;
          }
          throw new Error(
            `Acceptance fixture changed after an uncertain overwrite; refusing rollback: ${filePath}`,
          );
        }

        await beforeRollback?.({ filePath, index });
        await rename(filePath, quarantinePath);
        const quarantinedState = await captureRegularFileState(quarantinePath);

        if (!areSameRegularFileState(quarantinedState, installedState)) {
          retainedBackupPaths.push(rollbackPath, quarantinePath);
          await restorePreservedFileExclusively({
            filePath,
            preservedPath: quarantinePath,
            preservedState: quarantinedState,
            reason: "Acceptance fixture changed before rollback",
          });
          throw new Error(
            `Acceptance fixture changed before rollback; preserved copies: ${rollbackPath}, ${quarantinePath}`,
          );
        }

        await restorePreservedFileExclusively({
          filePath,
          preservedPath: rollbackPath,
          preservedState: rollbackState,
          reason: "Acceptance fixture rollback failed",
        });
      }
    } catch (error) {
      rollbackErrors.push(error);
      if (
        rollbackPath != null &&
        rollbackState != null &&
        !retainedBackupPaths.includes(rollbackPath)
      ) {
        retainedBackupPaths.push(rollbackPath);
      }
    }
  }

  return { retainedBackupPaths, rollbackErrors };
}

async function inspectAcceptanceTypesFile(typesPath) {
  let fileStats;

  try {
    fileStats = await lstat(typesPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }

  if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
    throw new Error(`Acceptance types file is not a regular file: ${typesPath}`);
  }

  let parsed;

  try {
    parsed = JSON.parse(await readFile(typesPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid Obsidian property types file: ${typesPath}`, { cause: error });
  }

  const types =
    parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed.types
      : null;

  if (types == null || typeof types !== "object" || Array.isArray(types)) {
    throw new Error(`Missing object field "types" in ${typesPath}`);
  }

  const conflicts = Object.entries(REQUIRED_ACCEPTANCE_PROPERTY_TYPES).flatMap(
    ([propertyKey, requiredType]) =>
      types[propertyKey] === requiredType
        ? []
        : [`${propertyKey}: expected ${requiredType}, found ${String(types[propertyKey])}`],
  );

  if (conflicts.length > 0) {
    throw new Error(
      `Acceptance property types are missing or incompatible in ${typesPath}: ${conflicts.join(
        "; ",
      )}`,
    );
  }

  return true;
}

async function rollbackCreatedTypesFile(typesPath, createdStats, beforeRemove) {
  await removeRegularFileIfUnchanged(typesPath, createdStats, {
    beforeRemove,
    label: "Acceptance property types file",
  });
}

async function cleanupAcceptanceStagingDirectory({
  attemptedWrites,
  stagedPaths,
  stagedStates,
  stagedTypesPath,
  stagedTypesState,
  stagingDirectory,
}) {
  const expectedStates = new Map(
    stagedPaths.map((filePath, index) => [filePath, stagedStates[index]]),
  );

  if (stagedTypesPath != null && stagedTypesState != null) {
    expectedStates.set(stagedTypesPath, stagedTypesState);
  }

  for (const attemptedWrite of attemptedWrites) {
    if (attemptedWrite.rollbackPath != null && attemptedWrite.rollbackState != null) {
      expectedStates.set(attemptedWrite.rollbackPath, attemptedWrite.rollbackState);
    }
    if (attemptedWrite.installedState != null) {
      expectedStates.set(attemptedWrite.quarantinePath, attemptedWrite.installedState);
    }
  }

  const errors = [];
  const retainedPaths = [];
  const entries = await readdir(stagingDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(stagingDirectory, entry.name);
    const expectedState = expectedStates.get(filePath);

    if (!entry.isFile() || expectedState == null) {
      retainedPaths.push(filePath);
      errors.push(new Error(`Unexpected acceptance staging entry was retained: ${filePath}`));
      continue;
    }

    try {
      await removeRegularFileIfUnchanged(filePath, expectedState, {
        allowMissing: true,
        label: "Acceptance staging file",
      });
    } catch (error) {
      retainedPaths.push(filePath);
      errors.push(error);
    }
  }

  const remainingEntries = await readdir(stagingDirectory);
  if (remainingEntries.length === 0) {
    try {
      await rmdir(stagingDirectory);
    } catch (error) {
      retainedPaths.push(stagingDirectory);
      errors.push(
        new Error(`Empty acceptance staging directory was retained: ${stagingDirectory}`, {
          cause: error,
        }),
      );
    }
  } else {
    for (const entry of remainingEntries) {
      const retainedPath = path.join(stagingDirectory, entry);
      if (!retainedPaths.includes(retainedPath)) {
        retainedPaths.push(retainedPath);
        errors.push(
          new Error(`Acceptance staging entry appeared during cleanup and was retained: ${retainedPath}`),
        );
      }
    }
  }

  return { errors, retainedPaths };
}

export async function createAcceptanceFixtures(
  vaultPath,
  {
    beforeInstall,
    beforeReplace,
    beforeRollback,
    beforeTypesCleanup,
    force = false,
    initializeTypes = false,
  } = {},
) {
  const preliminaryVault = await resolveIsolatedAcceptanceVaultPath(vaultPath, {
    allowUninitialized: initializeTypes,
  });
  const lock = await acquireAcceptanceVaultLock(preliminaryVault.vaultPath);
  let operationError;
  let result;

  try {
    result = await createAcceptanceFixturesWhileLocked(preliminaryVault.vaultPath, {
      force,
      initializeTypes,
      beforeInstall,
      beforeReplace,
      beforeRollback,
      beforeTypesCleanup,
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
      `Acceptance operation failed and its lock could not be released: ${lock.lockPath}`,
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

async function createAcceptanceFixturesWhileLocked(
  vaultPath,
  {
    beforeInstall,
    beforeReplace,
    beforeRollback,
    beforeTypesCleanup,
    force,
    initializeTypes,
  },
) {
  const resolvedVault = await resolveIsolatedAcceptanceVaultPath(vaultPath, {
    allowUninitialized: initializeTypes,
  });
  const absoluteVaultPath = resolvedVault.vaultPath;
  let marker = resolvedVault.marker;

  if (marker == null) {
    await assertSafeAcceptanceVaultInitialization(absoluteVaultPath);
  } else {
    await verifyAcceptanceFixtureManifest(
      absoluteVaultPath,
      marker,
      ACCEPTANCE_FIXTURES.map(({ fileName }) => fileName),
    );
  }

  const fixturePaths = ACCEPTANCE_FIXTURES.map(({ fileName }) =>
    path.join(absoluteVaultPath, fileName),
  );
  if (!force) {
    await assertFixturesDoNotExist(fixturePaths);
  }

  const typesPath = path.join(absoluteVaultPath, ".obsidian", TYPES_FILE_NAME);
  const typesFileExists = await inspectAcceptanceTypesFile(typesPath);

  if (!typesFileExists && !initializeTypes) {
    throw new Error(
      `Missing acceptance property types file: ${typesPath}. Re-run with --initialize-types in a new isolated Vault.`,
    );
  }

  const snapshots = force ? await snapshotExistingFixtures(fixturePaths) : new Map();
  const stagingDirectory = await mkdtemp(
    path.join(absoluteVaultPath, ".property-order-acceptance-"),
  );
  const attemptedWrites = [];
  const stagedPaths = [];
  const stagedStates = [];
  const rollbackPaths = [];
  let createdMarker = false;
  let createdTypesStats = null;
  let committedMarker = null;
  let preserveStagingDirectory = false;
  let operationError = null;
  let stagedTypesPath = null;
  let stagedTypesState = null;
  let transactionSucceeded = false;

  try {
    if (marker == null) {
      marker = await createAcceptanceMarker(
        resolvedVault.markerPath,
        absoluteVaultPath,
      );
      createdMarker = true;
    }

    for (let index = 0; index < ACCEPTANCE_FIXTURES.length; index += 1) {
      const fixture = ACCEPTANCE_FIXTURES[index];
      const stagedPath = path.join(stagingDirectory, `new-${index}.md`);
      await writeFile(stagedPath, fixture.content, "utf8");
      stagedPaths.push(stagedPath);
      stagedStates.push(await captureRegularFileState(stagedPath));

      const originalSnapshot = snapshots.get(fixturePaths[index]);
      if (originalSnapshot == null) {
        rollbackPaths.push(undefined);
      } else {
        const rollbackPath = path.join(stagingDirectory, `rollback-${index}.md`);
        rollbackPaths.push({
          path: rollbackPath,
        });
      }
    }

    if (!typesFileExists && initializeTypes) {
      stagedTypesPath = path.join(stagingDirectory, TYPES_FILE_NAME);
      await writeFile(
        stagedTypesPath,
        `${JSON.stringify({ types: REQUIRED_ACCEPTANCE_PROPERTY_TYPES }, null, 2)}\n`,
        "utf8",
      );
      stagedTypesState = await captureRegularFileState(stagedTypesPath);
      await link(stagedTypesPath, typesPath);
      const installedTypesState = await captureRegularFileState(typesPath);
      if (!areSameRegularFileState(installedTypesState, stagedTypesState)) {
        throw new Error(
          `Acceptance property types changed during exclusive initialization: ${typesPath}`,
        );
      }
      createdTypesStats = installedTypesState;
    }

    if (force) {
      await verifyAcceptanceFixtureManifest(
        absoluteVaultPath,
        marker,
        ACCEPTANCE_FIXTURES.map(({ fileName }) => fileName),
      );
      await assertForcedFixturesUnchanged(snapshots);
    }

    for (let index = 0; index < fixturePaths.length; index += 1) {
      const filePath = fixturePaths[index];
      const beforeState = snapshots.get(filePath) ?? { exists: false };
      const rollback = rollbackPaths[index];
      const attemptedWrite = {
        beforeState,
        filePath,
        index,
        installedState: null,
        quarantinePath: path.join(stagingDirectory, `quarantine-${index}.md`),
        rollbackPath: rollback?.path,
        rollbackState: null,
      };

      // Register the destination before preservation or installation so rollback
      // can distinguish absent, preserved, installed, and raced states. Exclusive
      // hard-link creation never deletes a racing writer's destination.
      if (force) {
        await assertRegularFileState(
          filePath,
          beforeState,
          "Acceptance fixture changed immediately before forced replacement",
        );
      }
      attemptedWrites.push(attemptedWrite);

      await beforeInstall?.({ filePath, index });
      await installFixtureExclusively({
        attemptedWrite,
        beforeReplace,
        force,
        index,
        stagedPath: stagedPaths[index],
        stagedState: stagedStates[index],
      });
    }

    for (const attemptedWrite of attemptedWrites) {
      await assertRegularFileState(
        attemptedWrite.filePath,
        attemptedWrite.installedState,
        "Acceptance fixture changed before marker commit",
      );
    }
    const generatedFiles = Object.fromEntries(
      ACCEPTANCE_FIXTURES.map(({ content, fileName }) => [
        fileName,
        sha256(content),
      ]),
    );
    const nextMarker = {
      ...marker,
      generatedFiles,
      state: "ready",
    };
    await writeAcceptanceMarker(resolvedVault.markerPath, nextMarker, {
      expectedMarker: marker,
    });
    committedMarker = nextMarker;
    for (const attemptedWrite of attemptedWrites) {
      await assertRegularFileState(
        attemptedWrite.filePath,
        attemptedWrite.installedState,
        "Acceptance fixture changed before marker commit completed",
      );
    }
    transactionSucceeded = true;
  } catch (error) {
    const { retainedBackupPaths, rollbackErrors } = await rollbackFixtureWrites(
      attemptedWrites,
      beforeRollback,
    );

    if (createdTypesStats != null) {
      try {
        await rollbackCreatedTypesFile(
          typesPath,
          createdTypesStats,
          beforeTypesCleanup,
        );
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (createdMarker) {
      try {
        await removeAcceptanceMarker(resolvedVault.markerPath, marker.runId);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    } else if (committedMarker != null && rollbackErrors.length === 0) {
      try {
        await writeAcceptanceMarker(resolvedVault.markerPath, marker, {
          expectedMarker: committedMarker,
        });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (rollbackErrors.length > 0) {
      preserveStagingDirectory = retainedBackupPaths.length > 0;
      const backupMessage =
        retainedBackupPaths.length > 0
          ? ` Retained rollback backup(s): ${retainedBackupPaths.join(", ")}`
          : "";
      operationError = new AggregateError(
        [error, ...rollbackErrors],
        `Failed to create acceptance fixtures and fully roll back partial writes.${backupMessage}`,
      );
    } else {
      operationError = error;
    }
  }

  let cleanupError = null;
  if (!preserveStagingDirectory) {
    const cleanup = await cleanupAcceptanceStagingDirectory({
      attemptedWrites,
      stagedPaths,
      stagedStates,
      stagedTypesPath,
      stagedTypesState,
      stagingDirectory,
    });

    if (cleanup.errors.length > 0) {
      cleanupError = new AggregateError(
        cleanup.errors,
        `Acceptance staging cleanup retained paths: ${cleanup.retainedPaths.join(", ")}`,
      );
    }
  }

  if (transactionSucceeded && cleanupError != null) {
    throw cleanupError;
  }
  if (operationError != null && cleanupError != null) {
    throw new AggregateError(
      [operationError, cleanupError],
      `Acceptance operation failed and staging cleanup retained paths: ${cleanupError.message}`,
    );
  }
  if (operationError != null) {
    throw operationError;
  }
  if (cleanupError != null) {
    throw cleanupError;
  }

  return fixturePaths;
}

async function main() {
  const { force, initializeTypes, vaultPath } = parseArguments(process.argv.slice(2));
  if (!vaultPath) {
    throw new Error(
      "Usage: npm run acceptance:fixtures -- --vault <isolated-vault> [--force] [--initialize-types]",
    );
  }

  const writtenFiles = await createAcceptanceFixtures(vaultPath, { force, initializeTypes });
  console.log(`Created ${writtenFiles.length} acceptance fixtures:`);
  for (const filePath of writtenFiles) {
    console.log(filePath);
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === entryPoint) {
  await main();
}
