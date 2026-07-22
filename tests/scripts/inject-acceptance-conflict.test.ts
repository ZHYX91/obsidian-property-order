import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
});
