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

    await execFileAsync(process.execPath, [scriptPath, "--vault", vaultPath]);

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

  it("refuses to write outside an Obsidian vault", async () => {
    const directory = await createTemporaryDirectory();

    await expect(
      execFileAsync(process.execPath, [scriptPath, "--vault", directory]),
    ).rejects.toThrow(/Not an Obsidian vault/);
  });

  it("preflights every forced destination before overwriting any fixture", async () => {
    const vaultPath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
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
    await mkdir(path.join(vaultPath, ".obsidian"));
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
    await mkdir(path.join(vaultPath, ".obsidian"));
    const fixturePaths = ["LF", "CRLF", "CR"].map((label) =>
      path.join(vaultPath, `Property Order ${label}.md`),
    );
    const originals = ["original LF\n", "original CRLF\r\n", "original CR\r"];

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
});
