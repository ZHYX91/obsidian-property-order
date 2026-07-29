import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const scriptPath = path.resolve("scripts/inject-acceptance-conflict.mjs");

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "property-order-conflict-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("acceptance conflict injector", () => {
  it("changes the source list and preserves CRLF bytes", async () => {
    const directory = await createTemporaryDirectory();
    await mkdir(path.join(directory, ".obsidian"));
    const filePath = path.join(directory, "Property Order CRLF.md");
    await writeFile(
      filePath,
      [
        "---",
        "values: [alpha, 'beta value', \"gamma:value\"]",
        "other: unchanged",
        "---",
        "",
      ].join("\r\n"),
      "utf8",
    );

    await execFileAsync(process.execPath, [
      scriptPath,
      "--vault",
      directory,
      "--file",
      filePath,
    ]);

    const content = await readFile(filePath, "utf8");
    expect(content).toContain(
      "values: [external-alpha, 'beta value', \"gamma:value\"]",
    );
    expect(new Set(content.match(/\r\n|\r|\n/g))).toEqual(
      new Set(["\r\n"]),
    );
    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        directory,
        "--file",
        filePath,
      ]),
    ).rejects.toThrow(/Missing acceptance marker/);
  });

  it.each([
    ["source", "po_source: [external-alpha, beta]"],
    ["target", "po_target: [external-gamma]"],
    ["unrelated", "po_unrelated: external-conflict"],
    ["body", "Acceptance body marker changed externally."],
  ])("injects a %s conflict into the core drag fixture", async (mode, expected) => {
    const directory = await createTemporaryDirectory();
    await mkdir(path.join(directory, ".obsidian"));
    const filePath = path.join(directory, "Property Order Drag Core.md");
    const content = [
      "---",
      "po_source: [alpha, beta]",
      "po_target: [gamma]",
      "po_unrelated: unchanged",
      "---",
      "Acceptance body marker.",
      "",
    ].join("\n");
    await writeFile(filePath, content, "utf8");

    await execFileAsync(process.execPath, [
      scriptPath,
      "--vault",
      directory,
      "--file",
      filePath,
      "--mode",
      mode,
      "--expected-sha256",
      createHash("sha256").update(content).digest("hex"),
    ]);

    expect(await readFile(filePath, "utf8")).toContain(expected);
  });

  it("rejects a stale expected hash without changing the fixture", async () => {
    const directory = await createTemporaryDirectory();
    await mkdir(path.join(directory, ".obsidian"));
    const filePath = path.join(directory, "Property Order LF.md");
    const content = "values: [alpha, 'beta value', \"gamma:value\"]\n";
    await writeFile(filePath, content, "utf8");

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        directory,
        "--file",
        filePath,
        "--expected-sha256",
        "0".repeat(64),
      ]),
    ).rejects.toThrow(/SHA-256 changed/);
    await expect(readFile(filePath, "utf8")).resolves.toBe(content);
  });

  it("rejects invalid delays before editing", async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, "fixture.md");
    await writeFile(filePath, "other: unchanged\n", "utf8");

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--file",
        filePath,
        "--delay-ms",
        "-1",
      ]),
    ).rejects.toThrow(/Invalid --delay-ms value/);
    await expect(readFile(filePath, "utf8")).resolves.toBe(
      "other: unchanged\n",
    );
  });

  it("refuses files outside the selected vault and non-generated note names", async () => {
    const vaultPath = await createTemporaryDirectory();
    const outsidePath = await createTemporaryDirectory();
    await mkdir(path.join(vaultPath, ".obsidian"));
    const outsideFile = path.join(outsidePath, "Property Order LF.md");
    const ordinaryNote = path.join(vaultPath, "ordinary.md");
    const nestedDirectory = path.join(vaultPath, "nested");
    const nestedFixture = path.join(nestedDirectory, "Property Order LF.md");
    const content = "values: [alpha, 'beta value', \"gamma:value\"]\n";
    await mkdir(nestedDirectory);
    await writeFile(outsideFile, content, "utf8");
    await writeFile(ordinaryNote, content, "utf8");
    await writeFile(nestedFixture, content, "utf8");

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--file",
        outsideFile,
      ]),
    ).rejects.toThrow(/outside the selected vault/);
    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--file",
        ordinaryNote,
      ]),
    ).rejects.toThrow(/Not a generated Property Order fixture/);
    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--file",
        nestedFixture,
      ]),
    ).rejects.toThrow(/Not a generated Property Order fixture/);
  });

  it("rejects a generated-name symlink without touching its target", async () => {
    const vaultPath = await createTemporaryDirectory();
    const externalPath = path.join(await createTemporaryDirectory(), "external.md");
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    await mkdir(path.join(vaultPath, ".obsidian"));
    await writeFile(
      externalPath,
      "values: [alpha, 'beta value', \"gamma:value\"]\n",
      "utf8",
    );

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
        "--file",
        fixturePath,
      ]),
    ).rejects.toThrow(/not a regular file/);
    await expect(readFile(externalPath, "utf8")).resolves.toBe(
      "values: [alpha, 'beta value', \"gamma:value\"]\n",
    );
  });

  it("rejects a linked Vault root without touching its fixture", async () => {
    const parentPath = await createTemporaryDirectory();
    const realVaultPath = path.join(parentPath, "real-vault");
    const linkedVaultPath = path.join(parentPath, "linked-vault");
    const fixturePath = path.join(realVaultPath, "Property Order LF.md");
    const content = "values: [alpha, 'beta value', \"gamma:value\"]\n";
    await mkdir(path.join(realVaultPath, ".obsidian"), { recursive: true });
    await writeFile(fixturePath, content, "utf8");

    try {
      await symlink(
        realVaultPath,
        linkedVaultPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (isLinkPermissionError(error)) {
        return;
      }
      throw error;
    }

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        linkedVaultPath,
        "--file",
        path.join(linkedVaultPath, path.basename(fixturePath)),
      ]),
    ).rejects.toThrow(/Not an Obsidian vault/);
    await expect(readFile(fixturePath, "utf8")).resolves.toBe(content);
  });

  it("rejects a linked .obsidian directory without touching the fixture", async () => {
    const vaultPath = await createTemporaryDirectory();
    const externalObsidianPath = path.join(
      await createTemporaryDirectory(),
      "external-obsidian",
    );
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    const content = "values: [alpha, 'beta value', \"gamma:value\"]\n";
    await mkdir(externalObsidianPath);
    await writeFile(path.join(externalObsidianPath, "sentinel"), "unchanged\n", "utf8");
    await writeFile(fixturePath, content, "utf8");

    try {
      await symlink(
        externalObsidianPath,
        path.join(vaultPath, ".obsidian"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (isLinkPermissionError(error)) {
        return;
      }
      throw error;
    }

    await expect(
      execFileAsync(process.execPath, [
        scriptPath,
        "--vault",
        vaultPath,
        "--file",
        fixturePath,
      ]),
    ).rejects.toThrow(/Not an Obsidian vault/);
    await expect(readFile(fixturePath, "utf8")).resolves.toBe(content);
    await expect(
      readFile(path.join(externalObsidianPath, "sentinel"), "utf8"),
    ).resolves.toBe("unchanged\n");
  });
});

function isLinkPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EACCES" || code === "EPERM";
}
