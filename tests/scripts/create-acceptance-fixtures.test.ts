import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
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

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const scriptPath = path.resolve("scripts/create-acceptance-fixtures.mjs");

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "property-order-acceptance-"),
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("acceptance fixture generator", () => {
  it("writes LF, CRLF, and CR fixtures without mixing newline bytes", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));

    await execFileAsync(process.execPath, [
      scriptPath,
      "--vault",
      vaultPath,
      "--initialize-types",
    ]);

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

  it("requires explicit initialization when the property types file is missing", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const typesPath = path.join(obsidianPath, "types.json");
    await mkdir(obsidianPath);

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault", vaultPath]),
    ).rejects.toThrow(/Missing acceptance property types file/);
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
      execFileAsync(process.execPath, [scriptPath, "--vault", vaultPath, "--force"]),
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
    ).rejects.toThrow(/Not an Obsidian vault/);
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
    ).rejects.toThrow(/Not an Obsidian vault/);
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
    ).rejects.toThrow(/Not an Obsidian vault/);
  });

  it("preflights every forced destination before overwriting any fixture", async () => {
    const vaultPath = await createTemporaryDirectory();
    await writeCompatibleTypes(vaultPath);
    const lfPath = path.join(vaultPath, "Property Order LF.md");
    await writeFile(lfPath, "keep this content\n");
    await mkdir(path.join(vaultPath, "Property Order CRLF.md"));

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--force",
      ]),
    ).rejects.toThrow();

    await expect(readFile(lfPath, "utf8")).resolves.toBe("keep this content\n");
  });

  it("rejects forced fixture symlinks without touching their targets", async () => {
    const vaultPath = await createTemporaryDirectory();
    const externalPath = path.join(await createTemporaryDirectory(), "external.md");
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    await writeCompatibleTypes(vaultPath);
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

  it("restores every destination when an overwrite mutates and then fails", async () => {
    const vaultPath = await createTemporaryDirectory();
    await writeCompatibleTypes(vaultPath);
    const fixturePaths = ACCEPTANCE_FIXTURES.map(({ fileName }) =>
      path.join(vaultPath, fileName),
    );
    const originals = ACCEPTANCE_FIXTURES.map(
      ({ fileName }, index) => `original ${index}: ${fileName}\n`,
    );

    await Promise.all(
      fixturePaths.map((filePath, index) => writeFile(filePath, originals[index])),
    );

    let installCount = 0;
    await expect(
      createAcceptanceFixtures(vaultPath, {
        force: true,
        install: async ({ filePath, stagedPath }: {
          filePath: string;
          stagedPath: string;
        }) => {
          installCount += 1;
          if (installCount === 2) {
            await writeFile(filePath, "partially replaced");
            throw new Error("injected commit failure");
          }
          await rename(stagedPath, filePath);
        },
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

  it("removes a newly created types file when fixture installation fails", async () => {
    const vaultPath = await createTemporaryDirectory();
    const obsidianPath = path.join(vaultPath, ".obsidian");
    const typesPath = path.join(obsidianPath, "types.json");
    await mkdir(obsidianPath);

    await expect(
      createAcceptanceFixtures(vaultPath, {
        initializeTypes: true,
        install: async () => {
          throw new Error("injected install failure");
        },
      }),
    ).rejects.toThrow(/injected install failure/);

    await expect(readFile(typesPath, "utf8")).rejects.toThrow();
    expect((await readdir(vaultPath)).filter((name) => name.endsWith(".md"))).toEqual([]);
  });
});
