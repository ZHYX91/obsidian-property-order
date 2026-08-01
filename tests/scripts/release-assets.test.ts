import { execFile } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptPath = path.join(projectRoot, "scripts", "release-assets.mjs");
const temporaryDirectories: string[] = [];
const version = "1.2.3";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("Release asset contract", () => {
  it("builds a byte-deterministic ZIP with fixed metadata and entry order", async () => {
    const root = await createTemporaryDirectory();
    const distDirectory = path.join(root, "dist");
    const firstArchive = path.join(root, "first.zip");
    const secondArchive = path.join(root, "second.zip");
    await writeReleaseAssets(distDirectory);

    await runReleaseAssets([
      "archive",
      "--version",
      version,
      "--dist-dir",
      distDirectory,
      "--output",
      firstArchive,
    ]);

    const changedTime = new Date("2026-07-29T12:34:56.000Z");
    for (const fileName of ["main.js", "manifest.json", "styles.css"]) {
      const filePath = path.join(distDirectory, fileName);
      await utimes(filePath, changedTime, changedTime);
      await chmod(filePath, 0o600);
    }

    await runReleaseAssets([
      "archive",
      "--version",
      version,
      "--dist-dir",
      distDirectory,
      "--output",
      secondArchive,
    ]);

    const first = await readFile(firstArchive);
    const second = await readFile(secondArchive);
    expect(second).toEqual(first);
    const archive = inspectZip(first);
    expect(archive.commentLength).toBe(0);
    expect(archive.entries.map((entry) => entry.name)).toEqual([
      "property-order/main.js",
      "property-order/manifest.json",
      "property-order/styles.css",
    ]);
    expect(
      archive.entries.map(({ content, crc32, ...metadata }) => metadata),
    ).toEqual([
      fixedEntryMetadata("property-order/main.js"),
      fixedEntryMetadata("property-order/manifest.json"),
      fixedEntryMetadata("property-order/styles.css"),
    ]);
    expect(archive.entries.map((entry) => entry.content.toString("utf8"))).toEqual([
      "123456789",
      `${JSON.stringify({ id: "property-order", version })}\n`,
      ".property-order { color: red; }\n",
    ]);
    expect(archive.entries[0]?.crc32).toBe(0xcbf43926);
  });

  it("accepts an existing Release only when all four assets have identical hashes", async () => {
    const root = await createTemporaryDirectory();
    const localDirectory = path.join(root, "local");
    const existingDirectory = path.join(root, "existing");
    await writeReleaseAssets(localDirectory);
    await mkdir(existingDirectory);
    await runReleaseAssets([
      "archive",
      "--version",
      version,
      "--dist-dir",
      localDirectory,
    ]);

    for (const fileName of [
      "main.js",
      "manifest.json",
      "styles.css",
      `property-order-${version}.zip`,
    ]) {
      await copyFile(
        path.join(localDirectory, fileName),
        path.join(existingDirectory, fileName),
      );
    }

    await expect(
      runReleaseAssets([
        "compare",
        "--version",
        version,
        "--local-dir",
        localDirectory,
        "--existing-dir",
        existingDirectory,
      ]),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining("publication is a no-op"),
    });

    await rm(path.join(existingDirectory, "manifest.json"));
    await expect(
      runReleaseAssets([
        "compare",
        "--version",
        version,
        "--local-dir",
        localDirectory,
        "--existing-dir",
        existingDirectory,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringMatching(/Publish a new version instead[\s\S]*manifest\.json/u),
    });
    await copyFile(
      path.join(localDirectory, "manifest.json"),
      path.join(existingDirectory, "manifest.json"),
    );

    await writeFile(path.join(existingDirectory, "styles.css"), "changed\n", "utf8");
    await expect(
      runReleaseAssets([
        "compare",
        "--version",
        version,
        "--local-dir",
        localDirectory,
        "--existing-dir",
        existingDirectory,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringMatching(/Publish a new version instead[\s\S]*styles\.css/u),
    });

    await copyFile(
      path.join(localDirectory, "styles.css"),
      path.join(existingDirectory, "styles.css"),
    );
    await writeFile(
      path.join(existingDirectory, "unexpected-installer.exe"),
      "unexpected\n",
      "utf8",
    );
    await expect(
      runReleaseAssets([
        "compare",
        "--version",
        version,
        "--local-dir",
        localDirectory,
        "--existing-dir",
        existingDirectory,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringMatching(
        /Publish a new version instead[\s\S]*unexpected assets: unexpected-installer\.exe/u,
      ),
    });
  });

  it("rejects an archive version that differs from the built manifest", async () => {
    const root = await createTemporaryDirectory();
    const distDirectory = path.join(root, "dist");
    await writeReleaseAssets(distDirectory);

    await expect(
      runReleaseAssets([
        "archive",
        "--version",
        "1.2.4",
        "--dist-dir",
        distDirectory,
      ]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("does not match dist/manifest.json version"),
    });
  });

  it("rejects non-canonical stable versions before building an archive", async () => {
    const root = await createTemporaryDirectory();
    const distDirectory = path.join(root, "dist");
    await writeReleaseAssets(distDirectory);

    for (const invalidVersion of ["01.2.3", "1.02.3", "1.2.03", "1.2.3-rc.1"]) {
      await expect(
        runReleaseAssets([
          "archive",
          "--version",
          invalidVersion,
          "--dist-dir",
          distDirectory,
        ]),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining("without a v prefix or leading zeroes"),
      });
    }
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "property-order-release-assets-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeReleaseAssets(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, "main.js"), "123456789", "utf8"),
    writeFile(
      path.join(directory, "manifest.json"),
      `${JSON.stringify({ id: "property-order", version })}\n`,
      "utf8",
    ),
    writeFile(
      path.join(directory, "styles.css"),
      ".property-order { color: red; }\n",
      "utf8",
    ),
  ]);
}

function runReleaseAssets(arguments_: string[]) {
  return execFileAsync(process.execPath, [scriptPath, ...arguments_], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

interface ZipEntryInspection {
  commentLength: number;
  compressionMethod: number;
  content: Buffer;
  crc32: number;
  dosDate: number;
  dosTime: number;
  extraLength: number;
  localExtraLength: number;
  mode: number;
  name: string;
  versionMadeBy: number;
}

function inspectZip(archive: Buffer): {
  commentLength: number;
  entries: ZipEntryInspection[];
} {
  const endOffset = archive.length - 22;
  expect(archive.readUInt32LE(endOffset)).toBe(0x06054b50);
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  const commentLength = archive.readUInt16LE(endOffset + 20);
  const entries: ZipEntryInspection[] = [];
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    expect(archive.readUInt32LE(offset)).toBe(0x02014b50);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const entryCommentLength = archive.readUInt16LE(offset + 32);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    expect(archive.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const contentOffset = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({
      commentLength: entryCommentLength,
      compressionMethod: archive.readUInt16LE(offset + 10),
      content: archive.subarray(contentOffset, contentOffset + compressedSize),
      crc32: archive.readUInt32LE(offset + 16),
      dosDate: archive.readUInt16LE(offset + 14),
      dosTime: archive.readUInt16LE(offset + 12),
      extraLength,
      localExtraLength,
      mode: archive.readUInt32LE(offset + 38) >>> 16,
      name,
      versionMadeBy: archive.readUInt16LE(offset + 4),
    });
    offset += 46 + nameLength + extraLength + entryCommentLength;
  }

  return { commentLength, entries };
}

function fixedEntryMetadata(
  name: string,
): Omit<ZipEntryInspection, "content" | "crc32"> {
  return {
    commentLength: 0,
    compressionMethod: 0,
    dosDate: 0x0021,
    dosTime: 0,
    extraLength: 0,
    localExtraLength: 0,
    mode: 0o100644,
    name,
    versionMadeBy: 0x0314,
  };
}
