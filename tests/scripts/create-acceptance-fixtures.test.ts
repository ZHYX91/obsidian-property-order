import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The fixture generator is an executable JavaScript module.
import { createAcceptanceFixtures } from "../../scripts/create-acceptance-fixtures.mjs";
import {
  ACCEPTANCE_FIXTURES,
  REQUIRED_ACCEPTANCE_PROPERTY_TYPES,
} from "../../scripts/acceptance-fixture-spec.mjs";
// @ts-expect-error The safety contract is implemented as an executable JavaScript module.
import * as acceptanceVaultSafety from "../../scripts/acceptance-vault-safety.mjs";

const {
  ACCEPTANCE_LOCK_NAME,
  ACCEPTANCE_MARKER_NAME,
  acquireAcceptanceVaultLock,
  releaseAcceptanceVaultLock,
  removeAcceptanceMarker,
  writeAcceptanceMarker,
} = acceptanceVaultSafety;

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const scriptPath = path.resolve("scripts/create-acceptance-fixtures.mjs");

async function createTemporaryDirectory(
  prefix = "property-order-acceptance-",
): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), prefix),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function writeCompatibleTypes(vaultPath: string): Promise<void> {
  const obsidianPath = path.join(vaultPath, ".obsidian");
  await mkdir(obsidianPath, { recursive: true });
  await writeFile(
    path.join(obsidianPath, "types.json"),
    `${JSON.stringify({ types: REQUIRED_ACCEPTANCE_PROPERTY_TYPES }, null, 2)}\n`,
    "utf8",
  );
}

function collectNewlines(content: string): string[] {
  return content.match(/\r\n|\r|\n/g) ?? [];
}

function collectErrorMessages(error: unknown): string[] {
  const messages = error instanceof Error ? [error.message] : [String(error)];
  const nestedErrors = (error as { errors?: unknown[] } | null)?.errors;

  return Array.isArray(nestedErrors)
    ? messages.concat(nestedErrors.flatMap((nested) => collectErrorMessages(nested)))
    : messages;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("acceptance fixture generator", () => {
  it("rejects unknown, duplicate, and valueless CLI flags before resolving a Vault", async () => {
    await expect(
      execFileAsync(process.execPath, [scriptPath, "--unknown", "value"]),
    ).rejects.toThrow(/Unknown acceptance-fixture argument/);
    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        "first",
        "--vault",
        "second",
      ]),
    ).rejects.toThrow(/Duplicate acceptance-fixture argument/);
    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault"]),
    ).rejects.toThrow(/Missing value for acceptance-fixture argument/);
    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault", ""]),
    ).rejects.toThrow(/Missing value for acceptance-fixture argument/);
  });

  it("writes LF, CRLF, and CR fixtures without mixing newline bytes", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));

    await execFileAsync(process.execPath, [
      scriptPath,
      "--vault",
      vaultPath,
      "--initialize-types",
    ]);

    const marker = JSON.parse(
      await readFile(path.join(vaultPath, ACCEPTANCE_MARKER_NAME), "utf8"),
    );
    expect(marker).toMatchObject({
      kind: "property-order-acceptance-vault",
      markerVersion: 1,
      state: "ready",
    });
    expect(marker.runId).toMatch(/^[a-f\d-]{36}$/i);
    expect(marker.generatedFiles).toEqual(
      Object.fromEntries(
        ACCEPTANCE_FIXTURES.map(({ content, fileName }) => [
          fileName,
          createHash("sha256").update(content).digest("hex"),
        ]),
      ),
    );

    for (const { fileName } of ACCEPTANCE_FIXTURES) {
      await expect(readFile(path.join(vaultPath, fileName), "utf8")).resolves.toBeDefined();
    }

    for (const [label, expectedNewline] of [
      ["LF", "\n"],
      ["CRLF", "\r\n"],
      ["CR", "\r"],
    ] as const) {
      const content = await readFile(
        path.join(vaultPath, `Property Order ${label}.md`),
        "utf8",
      );
      const newlines = collectNewlines(content);
      expect(newlines.length).toBeGreaterThan(0);
      expect(new Set(newlines)).toEqual(new Set([expectedNewline]));
      expect(content).toContain(`# ${label} fixture`);
    }

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault", vaultPath]),
    ).rejects.toThrow();
    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--force",
      ]),
    ).resolves.toBeDefined();
  });

  it("requires explicit initialization when the acceptance marker is missing", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const typesPath = path.join(obsidianPath, "types.json");
    await mkdir(obsidianPath);

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault", vaultPath]),
    ).rejects.toThrow(/acceptance Vault|marker is missing/i);
    await expect(readFile(typesPath, "utf8")).rejects.toThrow();
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);

    await execFileAsync(process.execPath, [
      scriptPath,
      "--vault",
      vaultPath,
      "--initialize-types",
    ]);

    expect(JSON.parse(await readFile(typesPath, "utf8"))).toEqual({
      types: REQUIRED_ACCEPTANCE_PROPERTY_TYPES,
    });
  });

  it("validates an existing compatible types file without rewriting it", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const typesPath = path.join(obsidianPath, "types.json");
    await mkdir(obsidianPath);
    const originalTypes = `${JSON.stringify(
      { types: { ...REQUIRED_ACCEPTANCE_PROPERTY_TYPES, extra_property: "text" } },
      null,
      4,
    )}\n`;
    await writeFile(typesPath, originalTypes, "utf8");

    await execFileAsync(process.execPath, [
      scriptPath,
      "--vault",
      vaultPath,
      "--initialize-types",
    ]);

    await expect(readFile(typesPath, "utf8")).resolves.toBe(originalTypes);
  });

  it("rejects incompatible property types before writing any fixture", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    await mkdir(obsidianPath);
    await writeFile(
      path.join(obsidianPath, "types.json"),
      JSON.stringify({ types: { po_source: "text" } }),
      "utf8",
    );

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--initialize-types",
      ]),
    ).rejects.toThrow(/missing or incompatible/);
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("rejects a types-file symlink without touching its target", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const externalTypesPath = path.join(
      await createTemporaryDirectory(),
      "external-types.json",
    );
    const externalContent = `${JSON.stringify({
      types: REQUIRED_ACCEPTANCE_PROPERTY_TYPES,
    })}\n`;
    await mkdir(obsidianPath);
    await writeFile(externalTypesPath, externalContent, "utf8");

    try {
      await symlink(externalTypesPath, path.join(obsidianPath, "types.json"), "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        return;
      }
      throw error;
    }

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--force",
        "--initialize-types",
      ]),
    ).rejects.toThrow(/not a regular file/);
    await expect(readFile(externalTypesPath, "utf8")).resolves.toBe(externalContent);
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("rejects a Vault root junction without following it", async () => {
    const parentPath = await createTemporaryDirectory();
    const realVaultPath = path.join(parentPath, "real-vault");
    const linkedVaultPath = path.join(parentPath, "linked-vault");
    await writeCompatibleTypes(realVaultPath);

    try {
      await symlink(
        realVaultPath,
        linkedVaultPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        return;
      }
      throw error;
    }

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        linkedVaultPath,
        "--initialize-types",
      ]),
    ).rejects.toThrow(/Not an isolated Property Order acceptance Vault/);
    expect((await readdir(realVaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("rejects a linked .obsidian directory without touching its target", async () => {
    const vaultPath = await createTemporaryDirectory();
    const externalObsidianPath = path.join(vaultPath, "external-obsidian");
    const linkedObsidianPath = path.join(vaultPath, ".obsidian");
    await mkdir(externalObsidianPath);
    await writeFile(path.join(externalObsidianPath, "sentinel"), "unchanged\n", "utf8");

    try {
      await symlink(
        externalObsidianPath,
        linkedObsidianPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        return;
      }
      throw error;
    }

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--initialize-types",
      ]),
    ).rejects.toThrow(/Not an isolated Property Order acceptance Vault/);
    await expect(
      readFile(path.join(externalObsidianPath, "sentinel"), "utf8"),
    ).resolves.toBe("unchanged\n");
    await expect(readFile(path.join(externalObsidianPath, "types.json"), "utf8")).rejects.toThrow();
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("refuses to write outside an Obsidian vault", async () => {
    const directory = await createTemporaryDirectory();

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault", directory]),
    ).rejects.toThrow(/Not an isolated Property Order acceptance Vault/);
  });

  it("refuses an ordinary Vault even when it is under the temporary root", async () => {
    const vaultPath = await createTemporaryDirectory("ordinary-vault-");
    await mkdir(path.join(vaultPath, ".obsidian"));

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--initialize-types",
      ]),
    ).rejects.toThrow(/Not an isolated Property Order acceptance Vault/);
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("rejects an acceptance marker copied from another Vault path", async () => {
    const sourceVaultPath = await createTemporaryDirectory();
    await mkdir(path.join(sourceVaultPath, ".obsidian"));
    await createAcceptanceFixtures(sourceVaultPath, { initializeTypes: true });
    const targetVaultPath = await createTemporaryDirectory();
    await mkdir(path.join(targetVaultPath, ".obsidian"));
    await writeFile(
      path.join(targetVaultPath, ACCEPTANCE_MARKER_NAME),
      await readFile(path.join(sourceVaultPath, ACCEPTANCE_MARKER_NAME)),
    );

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        targetVaultPath,
        "--force",
      ]),
    ).rejects.toThrow(/bound to a different path/);
    expect((await readdir(targetVaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("rejects fixture drift before a forced reset", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const lfPath = path.join(vaultPath, "Property Order LF.md");
    await writeFile(lfPath, "keep this content\n");

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--force",
      ]),
    ).rejects.toThrow(/marker hash/);

    await expect(readFile(lfPath, "utf8")).resolves.toBe("keep this content\n");
  });

  it("rejects forced fixture symlinks without touching their targets", async () => {
    const vaultPath = await createTemporaryDirectory();
    const externalPath = path.join(await createTemporaryDirectory(), "external.md");
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    await rm(fixturePath);
    await writeFile(externalPath, "outside the vault\n");

    try {
      await symlink(externalPath, fixturePath, "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        return;
      }
      throw error;
    }

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--force",
      ]),
    ).rejects.toThrow(/not a regular file/);
    await expect(readFile(externalPath, "utf8")).resolves.toBe(
      "outside the vault\n",
    );
  });

  it("restores completed replacements when a later overwrite fails before mutation", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const fixturePaths = ACCEPTANCE_FIXTURES.map(({ fileName }) =>
      path.join(vaultPath, fileName),
    );
    const originals = ACCEPTANCE_FIXTURES.map(({ content }) => content);

    await expect(
      createAcceptanceFixtures(vaultPath, {
        beforeInstall: ({ index }: { index: number }) => {
          if (index === 1) {
            throw new Error("injected commit failure");
          }
        },
        force: true,
      }),
    ).rejects.toThrow(/injected commit failure/);

    for (let index = 0; index < fixturePaths.length; index += 1) {
      await expect(readFile(fixturePaths[index], "utf8")).resolves.toBe(
        originals[index],
      );
    }
    await expect(readdir(vaultPath)).resolves.not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^\.property-order-acceptance-/)]),
    );
  });

  it("preserves a write that lands immediately before forced replacement", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const fixturePath = path.join(vaultPath, ACCEPTANCE_FIXTURES[0]!.fileName);
    const markerPath = path.join(vaultPath, ACCEPTANCE_MARKER_NAME);
    const originalMarker = await readFile(markerPath);
    let thrownError: unknown;

    try {
      await createAcceptanceFixtures(vaultPath, {
        beforeReplace: async ({ index }: { index: number }) => {
          if (index === 0) {
            await writeFile(fixturePath, "pre-replace writer must survive\n", "utf8");
          }
        },
        force: true,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    expect(message).toMatch(/Retained rollback backup/);
    const backupPath = message.match(
      /Retained rollback backup\(s\): ([^,]+rollback-0\.md)/,
    )?.[1];
    expect(backupPath).toBeDefined();
    await expect(readFile(fixturePath, "utf8")).resolves.toBe(
      "pre-replace writer must survive\n",
    );
    await expect(readFile(backupPath!, "utf8")).resolves.toBe(
      "pre-replace writer must survive\n",
    );
    await expect(readFile(markerPath)).resolves.toEqual(originalMarker);
  });

  it("preserves a racing write and retains the unique rollback backup", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const fixturePaths = ACCEPTANCE_FIXTURES.map(({ fileName }) =>
      path.join(vaultPath, fileName),
    );
    const firstPath = fixturePaths[0]!;
    const firstOriginal = ACCEPTANCE_FIXTURES[0]!.content;
    let thrownError: unknown;

    try {
      await createAcceptanceFixtures(vaultPath, {
        beforeInstall: ({ index }: { index: number }) => {
          if (index === 1) {
            throw new Error("injected rollback trigger");
          }
        },
        beforeRollback: async ({ index }: { index: number }) => {
          if (index === 0) {
            await writeFile(firstPath, "racing writer must survive\n", "utf8");
          }
        },
        force: true,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    expect(message).toMatch(/Retained rollback backup/);
    const backupPath = message.match(
      /Retained rollback backup\(s\): ([^,]+rollback-0\.md)/,
    )?.[1];
    expect(backupPath).toBeDefined();
    await expect(readFile(firstPath, "utf8")).resolves.toBe(
      "racing writer must survive\n",
    );
    await expect(readFile(backupPath!, "utf8")).resolves.toBe(firstOriginal);
  });

  it("fails closed while another process owns the Vault lock", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const originalMarker = await readFile(
      path.join(vaultPath, ACCEPTANCE_MARKER_NAME),
    );
    let releaseInstall!: () => void;
    let announceInstall!: () => void;
    const installStarted = new Promise<void>((resolve) => {
      announceInstall = resolve;
    });
    const continueInstall = new Promise<void>((resolve) => {
      releaseInstall = resolve;
    });
    const firstOperation = createAcceptanceFixtures(vaultPath, {
      beforeInstall: async ({ index }: { index: number }) => {
        if (index === 0) {
          announceInstall();
          await continueInstall;
        }
      },
      force: true,
    });
    await installStarted;

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--force",
      ]),
    ).rejects.toThrow(/locked.*stale lock/i);

    releaseInstall();
    await expect(firstOperation).resolves.toBeDefined();
    await expect(readFile(path.join(vaultPath, ACCEPTANCE_MARKER_NAME))).resolves.toEqual(
      originalMarker,
    );
    await expect(readFile(path.join(vaultPath, ACCEPTANCE_LOCK_NAME))).rejects.toThrow();
  });

  it("does not automatically break an old Vault lock", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const lockPath = path.join(vaultPath, ACCEPTANCE_LOCK_NAME);
    await writeFile(lockPath, "stale lock requires manual inspection\n", "utf8");
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(fixturePath);

    await expect(
      createAcceptanceFixtures(vaultPath, { force: true }),
    ).rejects.toThrow(/locked.*stale lock/i);
    await expect(readFile(lockPath, "utf8")).resolves.toBe(
      "stale lock requires manual inspection\n",
    );
    await expect(readFile(fixturePath)).resolves.toEqual(original);
  });

  it("does not adopt a replacement lock that arrives before acquisition verification", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const lockPath = path.join(vaultPath, ACCEPTANCE_LOCK_NAME);

    await expect(
      acquireAcceptanceVaultLock(vaultPath, {
        beforeVerify: async () => {
          await rm(lockPath);
          await writeFile(lockPath, "replacement lock must survive\n", "utf8");
        },
      }),
    ).rejects.toThrow(/lock changed while it was acquired/);

    await expect(readFile(lockPath, "utf8")).resolves.toBe(
      "replacement lock must survive\n",
    );
  });

  it("preserves a replacement lock that arrives at release cleanup", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const lock = await acquireAcceptanceVaultLock(vaultPath);
    let thrownError: unknown;

    try {
      await releaseAcceptanceVaultLock(lock, {
        beforeRemove: async () => {
          await writeFile(lock.lockPath, "replacement release lock must survive\n", "utf8");
        },
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    const preservedPath = message.match(/preserved path: (.+[\\/]preserved)$/u)?.[1];
    expect(preservedPath).toBeDefined();
    await expect(readFile(lock.lockPath, "utf8")).resolves.toBe(
      "replacement release lock must survive\n",
    );
    await expect(readFile(preservedPath!, "utf8")).resolves.toBe(
      "replacement release lock must survive\n",
    );
  });

  it("preserves marker races during replacement and cleanup", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const markerPath = path.join(vaultPath, ACCEPTANCE_MARKER_NAME);
    const marker = JSON.parse(await readFile(markerPath, "utf8"));

    await expect(
      writeAcceptanceMarker(markerPath, marker, {
        beforeReplace: async () => {
          await writeFile(markerPath, "replacement marker must survive\n", "utf8");
        },
        expectedMarker: marker,
      }),
    ).rejects.toThrow(/Acceptance marker changed before replacement; preserved path:/);
    await expect(readFile(markerPath, "utf8")).resolves.toBe(
      "replacement marker must survive\n",
    );

    await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
    let cleanupError: unknown;
    try {
      await removeAcceptanceMarker(markerPath, marker.runId, {
        beforeRemove: async () => {
          await writeFile(markerPath, "cleanup marker must survive\n", "utf8");
        },
      });
    } catch (error) {
      cleanupError = error;
    }

    expect(cleanupError).toBeInstanceOf(Error);
    expect((cleanupError as Error).message).toMatch(/preserved path:/);
    await expect(readFile(markerPath, "utf8")).resolves.toBe(
      "cleanup marker must survive\n",
    );
  });

  it("commits the reset but preserves an old inode changed through an open handle", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    const handle = await open(fixturePath, "r+");
    let thrownError: unknown;

    try {
      await createAcceptanceFixtures(vaultPath, {
        beforeInstall: async ({ index }: { index: number }) => {
          if (index === 1) {
            await handle.truncate(0);
            await handle.writeFile("open handle writer must survive\n", "utf8");
          }
        },
        force: true,
      });
    } catch (error) {
      thrownError = error;
    } finally {
      await handle.close();
    }

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    expect(message).toMatch(/Acceptance staging cleanup retained paths:/);
    const retainedPath = message.match(/([^, ]+rollback-0\.md)/u)?.[1];
    expect(retainedPath).toBeDefined();
    await expect(readFile(retainedPath!, "utf8")).resolves.toBe(
      "open handle writer must survive\n",
    );
    await expect(readFile(fixturePath, "utf8")).resolves.toBe(
      ACCEPTANCE_FIXTURES[0]?.content,
    );
  });

  it("removes a newly created types file when fixture installation fails", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const typesPath = path.join(obsidianPath, "types.json");
    await mkdir(obsidianPath);

    await expect(
      createAcceptanceFixtures(vaultPath, {
        beforeInstall: async () => {
          throw new Error("injected install failure");
        },
        initializeTypes: true,
      }),
    ).rejects.toThrow(/injected install failure/);

    await expect(readFile(typesPath, "utf8")).rejects.toThrow();
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });

  it("preserves a replacement types file that arrives during rollback cleanup", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const typesPath = path.join(obsidianPath, "types.json");
    await mkdir(obsidianPath);
    let thrownError: unknown;

    try {
      await createAcceptanceFixtures(vaultPath, {
        beforeInstall: async () => {
          throw new Error("injected install failure");
        },
        beforeTypesCleanup: async () => {
          await writeFile(typesPath, "replacement types must survive\n", "utf8");
        },
        initializeTypes: true,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(collectErrorMessages(thrownError).join(" ")).toMatch(
      /fully roll back partial writes/,
    );
    await expect(readFile(typesPath, "utf8")).resolves.toBe(
      "replacement types must survive\n",
    );
    const preservedPath = collectErrorMessages(thrownError)
      .join(" ")
      .match(/preserved path: (.+?[\\/]preserved)(?:\s|$)/u)?.[1];
    expect(preservedPath).toBeDefined();
    await expect(readFile(preservedPath!, "utf8")).resolves.toBe(
      "replacement types must survive\n",
    );
  });
});
