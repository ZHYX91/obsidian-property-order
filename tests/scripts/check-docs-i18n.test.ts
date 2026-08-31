import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error The documentation checker is an executable JavaScript module.
import { checkDocsI18n } from "../../scripts/check-docs-i18n.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];
let fixtureRoot = "";

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "property-order-docs-"));
  temporaryDirectories.push(fixtureRoot);
  await cp(path.join(projectRoot, "docs"), path.join(fixtureRoot, "docs"), {
    recursive: true,
  });
  await cp(path.join(projectRoot, "CHANGELOG.md"), path.join(fixtureRoot, "CHANGELOG.md"));
  await cp(path.join(projectRoot, "SECURITY.md"), path.join(fixtureRoot, "SECURITY.md"));
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("stable documentation i18n checker", () => {
  it("accepts the synchronized repository documents", () => {
    expect(checkDocsI18n(fixtureRoot)).toEqual([]);
  });

  it("rejects a complete stable document pair that is not registered", async () => {
    await writeFile(path.join(fixtureRoot, "docs/unregistered.zh-CN.md"), "placeholder\n");
    await writeFile(path.join(fixtureRoot, "docs/unregistered.en.md"), "placeholder\n");

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "Unregistered stable document pair: docs/unregistered.zh-CN.md and " +
        "docs/unregistered.en.md",
    );
  });

  it("rejects a stable document with only one language", async () => {
    await writeFile(path.join(fixtureRoot, "docs/source-only.zh-CN.md"), "placeholder\n");
    await writeFile(path.join(fixtureRoot, "docs/translation-only.en.md"), "placeholder\n");

    const errors = checkDocsI18n(fixtureRoot);
    expect(errors).toContain(
      "Stable document has no English translation: docs/source-only.zh-CN.md " +
        "(expected docs/source-only.en.md)",
    );
    expect(errors).toContain(
      "Stable document has no Simplified Chinese source: docs/translation-only.en.md " +
        "(expected docs/translation-only.zh-CN.md)",
    );
  });

  it("does not inventory localized README or asset files below docs root", async () => {
    await writeFile(path.join(fixtureRoot, "docs/i18n/unpaired.en.md"), "placeholder\n");
    await mkdir(path.join(fixtureRoot, "docs/assets"), { recursive: true });
    await writeFile(path.join(fixtureRoot, "docs/assets/unpaired.zh-CN.md"), "placeholder\n");

    expect(checkDocsI18n(fixtureRoot)).toEqual([]);
  });

  it("rejects stale translation metadata", async () => {
    await replaceInDocument(
      "docs/ux-spec.en.md",
      "translation_status: synced",
      "translation_status: stale",
    );

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "docs/ux-spec.en.md frontmatter must set translation_status: synced",
    );
  });

  it("rejects mismatched heading hierarchy and table shape", async () => {
    await replaceInDocument("docs/ux-spec.en.md", "## Settings UI", "### Settings UI");
    await replaceInDocument(
      "docs/architecture.en.md",
      "| scalar | Minimal inline flow conversion; explicit null is empty | Flow | Block |",
      "",
    );

    const errors = checkDocsI18n(fixtureRoot);
    expect(errors.some((error: string) => error.includes("different heading levels"))).toBe(true);
    expect(errors.some((error: string) => error.includes("different table shapes"))).toBe(true);
  });

  it("rejects missing critical contract tokens", async () => {
    await replaceInDocument("docs/testing-strategy.en.md", "`src/**/*.ts`", "source files");

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "docs/testing-strategy.en.md must retain the stable contract token `src/**/*.ts`",
    );
  });

  it("enforces the release guide's hosted-asset contract tokens", async () => {
    await replaceAllInDocument("docs/release.en.md", "`SHA256SUMS`", "the hash manifest");

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "docs/release.en.md must retain the stable contract token `SHA256SUMS`",
    );
  });

  it("rejects an unterminated fenced code block", async () => {
    await appendToDocument("docs/ux-spec.en.md", "\n```text\nunfinished");

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "docs/ux-spec.en.md has an unterminated fenced code block",
    );
  });

  it("rejects broken and unsynchronized relative links", async () => {
    await replaceInDocument(
      "docs/architecture.en.md",
      "(product-requirements.en.md)",
      "(missing.en.md)",
    );

    const errors = checkDocsI18n(fixtureRoot);
    expect(errors).toContain(
      "docs/architecture.en.md has a broken relative link: missing.en.md",
    );
    expect(errors.some((error: string) => error.includes("different relative links"))).toBe(true);
  });

  it("ignores sample links in code fences and absolute links", async () => {
    const sample = [
      "",
      "```markdown",
      "[deliberately unresolved example](missing.md)",
      "```",
      "",
      "[external reference](https://example.com/reference)",
    ].join("\n");
    await appendToDocument("docs/ux-spec.zh-CN.md", sample);
    await appendToDocument("docs/ux-spec.en.md", sample);

    expect(checkDocsI18n(fixtureRoot)).toEqual([]);
  });
});

async function replaceInDocument(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const content = await readFile(absolutePath, "utf8");
  expect(content).toContain(search);
  await writeFile(absolutePath, content.replace(search, replacement));
}

async function replaceAllInDocument(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const content = await readFile(absolutePath, "utf8");
  expect(content).toContain(search);
  await writeFile(absolutePath, content.split(search).join(replacement));
}

async function appendToDocument(filePath: string, suffix: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const content = await readFile(absolutePath, "utf8");
  await writeFile(absolutePath, `${content.trimEnd()}${suffix}\n`);
}
