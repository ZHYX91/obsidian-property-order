import {
  access,
  link,
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ACCEPTANCE_FIXTURES,
  REQUIRED_ACCEPTANCE_PROPERTY_TYPES,
} from "./acceptance-fixture-spec.mjs";
import { resolveIsolatedAcceptanceVaultPath } from "./acceptance-vault-safety.mjs";

const TYPES_FILE_NAME = "types.json";

function parseArguments(arguments_) {
  const vaultIndex = arguments_.indexOf("--vault");
  const vaultPath = vaultIndex >= 0 ? arguments_[vaultIndex + 1] : undefined;
  return {
    force: arguments_.includes("--force"),
    initializeTypes: arguments_.includes("--initialize-types"),
    vaultPath,
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

      snapshots.set(filePath, await readFile(filePath));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return snapshots;
}

async function installFixture({ filePath, force, stagedPath }) {
  if (force) {
    await rename(stagedPath, filePath);
    return;
  }

  // A hard link gives the no-force path atomic create-if-absent semantics. Both
  // paths are inside the vault, so they are guaranteed to be on one filesystem.
  await link(stagedPath, filePath);
}

async function rollbackFixtureWrites(attemptedWrites) {
  const rollbackErrors = [];

  for (const { filePath, rollbackPath } of attemptedWrites.slice().reverse()) {
    try {
      if (rollbackPath == null) {
        await rm(filePath, { force: true });
      } else {
        // Replace the destination with the pre-staged original in one filesystem
        // operation; rollback never rewrites a possibly visible file in place.
        await rename(rollbackPath, filePath);
      }
    } catch (error) {
      rollbackErrors.push(error);
    }
  }

  return rollbackErrors;
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

async function rollbackCreatedTypesFile(typesPath, createdStats) {
  const currentStats = await lstat(typesPath);

  if (
    currentStats.isSymbolicLink() ||
    !currentStats.isFile() ||
    currentStats.dev !== createdStats.dev ||
    currentStats.ino !== createdStats.ino
  ) {
    throw new Error(`Acceptance types file changed before rollback: ${typesPath}`);
  }

  await rm(typesPath, { force: true });
}

export async function createAcceptanceFixtures(
  vaultPath,
  { force = false, initializeTypes = false, install = installFixture } = {},
) {
  const absoluteVaultPath = await resolveIsolatedAcceptanceVaultPath(vaultPath);

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
  let createdTypesStats = null;

  try {
    const stagedPaths = [];
    const rollbackPaths = [];

    for (let index = 0; index < ACCEPTANCE_FIXTURES.length; index += 1) {
      const fixture = ACCEPTANCE_FIXTURES[index];
      const stagedPath = path.join(stagingDirectory, `new-${index}.md`);
      await writeFile(stagedPath, fixture.content, "utf8");
      stagedPaths.push(stagedPath);

      const originalContent = snapshots.get(fixturePaths[index]);
      if (originalContent == null) {
        rollbackPaths.push(undefined);
      } else {
        const rollbackPath = path.join(stagingDirectory, `rollback-${index}.md`);
        await writeFile(rollbackPath, originalContent);
        rollbackPaths.push(rollbackPath);
      }
    }

    if (!typesFileExists && initializeTypes) {
      const stagedTypesPath = path.join(stagingDirectory, TYPES_FILE_NAME);
      await writeFile(
        stagedTypesPath,
        `${JSON.stringify({ types: REQUIRED_ACCEPTANCE_PROPERTY_TYPES }, null, 2)}\n`,
        "utf8",
      );
      await link(stagedTypesPath, typesPath);
      createdTypesStats = await lstat(typesPath);
    }

    for (let index = 0; index < fixturePaths.length; index += 1) {
      const filePath = fixturePaths[index];
      const attemptedWrite = {
        filePath,
        rollbackPath: rollbackPaths[index],
      };

      // Register the destination before an overwrite attempt. Even a custom or
      // platform filesystem operation that mutates and then rejects is rolled back.
      // The exclusive hard-link path is atomic, so a failed no-force attempt has
      // not created anything and must not delete a racing writer's destination.
      if (force) {
        attemptedWrites.push(attemptedWrite);
      }

      await install({ filePath, force, stagedPath: stagedPaths[index] });

      if (!force) {
        attemptedWrites.push(attemptedWrite);
      }
    }
  } catch (error) {
    const rollbackErrors = await rollbackFixtureWrites(attemptedWrites);

    if (createdTypesStats != null) {
      try {
        await rollbackCreatedTypesFile(typesPath, createdTypesStats);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Failed to create acceptance fixtures and fully roll back partial writes",
      );
    }

    throw error;
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
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
