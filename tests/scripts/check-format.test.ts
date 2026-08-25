import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The format checker is an executable JavaScript module.
import { checkFormatting } from "../../scripts/check-format.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("format checker", () => {
  it("accepts the repository's deterministic text format", async () => {
    await expect(checkFormatting(projectRoot)).resolves.toBeGreaterThan(0);
  });

  it("checks supported files recursively and ignores generated directories", async () => {
    const root = await createFixture();
    await mkdir(path.join(root, "docs"));
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, ".node-version"), "24.19.0\n");
    await writeFile(path.join(root, "docs", "guide.md"), "# Guide\n");
    await writeFile(path.join(root, "dist", "generated.js"), "ignored \r\n");
    await writeFile(path.join(root, "image.bin"), Buffer.from([0xff]));

    await expect(checkFormatting(root)).resolves.toBe(2);
  });

  it("reports encoding, line-ending, whitespace, NUL, and final-newline failures", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "bom.md"), "\uFEFF# Heading\n");
    await writeFile(path.join(root, "crlf.ts"), "export {};\r\n");
    await writeFile(path.join(root, "invalid.md"), Buffer.from([0xff]));
    await writeFile(path.join(root, "nul.json"), "{}\0\n");
    await writeFile(path.join(root, "trailing.mjs"), "export {}; \n");
    await writeFile(path.join(root, "unfinished.css"), "body {}");

    await expect(checkFormatting(root)).rejects.toThrow(/must be valid UTF-8/u);
    await expect(checkFormatting(root)).rejects.toThrow(/UTF-8 BOM is forbidden/u);
    await expect(checkFormatting(root)).rejects.toThrow(/line endings must be LF/u);
    await expect(checkFormatting(root)).rejects.toThrow(/NUL bytes are forbidden/u);
    await expect(checkFormatting(root)).rejects.toThrow(/trailing whitespace is forbidden/u);
    await expect(checkFormatting(root)).rejects.toThrow(/final newline is required/u);
  });
});

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "property-order-format-"));
  temporaryDirectories.push(root);
  return root;
}
