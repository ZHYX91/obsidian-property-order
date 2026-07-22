import {
  access,
  link,
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIXTURES = [
  { label: "LF", newline: "\n" },
  { label: "CRLF", newline: "\r\n" },
  { label: "CR", newline: "\r" },
];

function parseArguments(arguments_) {
  const vaultIndex = arguments_.indexOf("--vault");
  const vaultPath = vaultIndex >= 0 ? arguments_[vaultIndex + 1] : undefined;
  return {
    force: arguments_.includes("--force"),
    vaultPath,
  };
}

function renderFixture(label, newline) {
  return [
    "---",
    `values: [alpha, 'beta value', \"gamma:value\"] # ${label} fixture`,
    "other: unchanged",
    "---",
    "",
    `# Property Order ${label}`,
    "",
    "Drag values in Properties, then verify every newline byte is unchanged.",
    "",
  ].join(newline);
}

async function assertIsVault(vaultPath) {
  try {
    const obsidianStats = await stat(path.join(vaultPath, ".obsidian"));

    if (!obsidianStats.isDirectory()) {
      throw new Error("not a directory");
    }
  } catch {
    throw new Error(`Not an Obsidian vault: ${vaultPath}`);
  }
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

export async function createAcceptanceFixtures(
  vaultPath,
  { force = false, install = installFixture } = {},
) {
  const absoluteVaultPath = path.resolve(vaultPath);
  await assertIsVault(absoluteVaultPath);

  const fixturePaths = FIXTURES.map(({ label }) =>
    path.join(absoluteVaultPath, `Property Order ${label}.md`),
  );
  if (!force) {
    await assertFixturesDoNotExist(fixturePaths);
  }

  const snapshots = force ? await snapshotExistingFixtures(fixturePaths) : new Map();
  const stagingDirectory = await mkdtemp(
    path.join(absoluteVaultPath, ".property-order-acceptance-"),
  );
  const attemptedWrites = [];

  try {
    const stagedPaths = [];
    const rollbackPaths = [];

    for (let index = 0; index < FIXTURES.length; index += 1) {
      const { label, newline } = FIXTURES[index];
      const stagedPath = path.join(stagingDirectory, `new-${index}.md`);
      await writeFile(stagedPath, renderFixture(label, newline), "utf8");
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
  const { force, vaultPath } = parseArguments(process.argv.slice(2));
  if (!vaultPath) {
    throw new Error(
      "Usage: npm run acceptance:fixtures -- --vault <isolated-vault> [--force]",
    );
  }

  const writtenFiles = await createAcceptanceFixtures(vaultPath, { force });
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
