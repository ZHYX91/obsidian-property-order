import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error The README checker is an executable JavaScript module.
import { checkReadmeI18n } from "../../scripts/check-readme-i18n.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];
let fixtureRoot = "";

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "property-order-readme-"));
  temporaryDirectories.push(fixtureRoot);
  await Promise.all([
    cp(path.join(projectRoot, "README.md"), path.join(fixtureRoot, "README.md")),
    cp(path.join(projectRoot, "manifest.json"), path.join(fixtureRoot, "manifest.json")),
    cp(path.join(projectRoot, "LICENSE"), path.join(fixtureRoot, "LICENSE")),
    cp(path.join(projectRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true }),
  ]);
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("README marketplace link contract", () => {
  it("accepts the synchronized repository READMEs", () => {
    expect(checkReadmeI18n(fixtureRoot)).toEqual([]);
  });

  it("rejects a repository-relative target in the English marketplace README", async () => {
    await replaceInReadme(
      "README.md",
      "[English](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md)",
      "[English](README.md)",
    );

    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "README.md must use a canonical absolute GitHub target for repository content: README.md",
    );
  });

  it("rejects an absolute repository target in a translated README", async () => {
    await replaceInReadme(
      "docs/i18n/README.zh-CN.md",
      "[English](../../README.md)",
      "[English](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md)",
    );

    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "docs/i18n/README.zh-CN.md must use a relative target for repository content: https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md",
    );
  });

  it("rejects a missing translated image target", async () => {
    await replaceInReadme(
      "docs/i18n/README.zh-CN.md",
      "../assets/property-order-settings.png",
      "../assets/missing-settings.png",
    );

    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "docs/i18n/README.zh-CN.md contains a missing relative target: ../assets/missing-settings.png",
    );
  });
});

async function replaceInReadme(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const source = await readFile(absolutePath, "utf8");
  expect(source).toContain(search);
  await writeFile(absolutePath, source.replace(search, replacement));
}
