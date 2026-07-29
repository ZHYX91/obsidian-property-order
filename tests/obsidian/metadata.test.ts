import type { App, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
  getCachedFrontmatterStorageKinds,
  getCachedPropertyKeyUsage,
  getPropertyKeyUsage,
  invalidatePropertyKeyUsage,
} from "../../src/obsidian/metadata";

describe("getPropertyKeyUsage", () => {
  it("counts top-level frontmatter keys across cached Markdown files", () => {
    const files = [
      { path: "one.md" },
      { path: "two.md" },
      { path: "uncached.md" },
    ] as TFile[];
    const caches = new Map<TFile, object | null>([
      [
        files[0],
        {
          frontmatter: {
            flow: ["alpha"],
            block: ["one"],
            position: { start: { line: 0 }, end: { line: 3 } },
          },
        },
      ],
      [files[1], { frontmatter: { flow: ["beta"], other: "value" } }],
      [files[2], null],
    ]);
    const app = {
      metadataCache: {
        getFileCache: vi.fn((file: TFile) => caches.get(file) ?? null),
      },
      vault: {
        getMarkdownFiles: vi.fn(() => files),
      },
    } as unknown as App;

    expect(getPropertyKeyUsage(app)).toEqual([
      { key: "flow", count: 2 },
      { key: "block", count: 1 },
      { key: "other", count: 1 },
    ]);
  });

  it("returns an empty list when no Markdown file has cached frontmatter", () => {
    const file = { path: "plain.md" } as TFile;
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => ({})),
      },
      vault: {
        getMarkdownFiles: vi.fn(() => [file]),
      },
    } as unknown as App;

    expect(getPropertyKeyUsage(app)).toEqual([]);
  });

  it("shares cached usage until explicitly invalidated", () => {
    const file = { path: "note.md" } as TFile;
    let frontmatter: Record<string, boolean> = { alpha: true };
    const getMarkdownFiles = vi.fn(() => [file]);
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => ({ frontmatter })),
      },
      vault: { getMarkdownFiles },
    } as unknown as App;

    expect(getCachedPropertyKeyUsage(app)).toEqual([
      { key: "alpha", count: 1 },
    ]);
    frontmatter = { beta: true };
    expect(getCachedPropertyKeyUsage(app)).toEqual([
      { key: "alpha", count: 1 },
    ]);
    expect(getMarkdownFiles).toHaveBeenCalledTimes(1);

    invalidatePropertyKeyUsage(app);
    expect(getCachedPropertyKeyUsage(app)).toEqual([
      { key: "beta", count: 1 },
    ]);
    expect(getMarkdownFiles).toHaveBeenCalledTimes(2);
  });
});

describe("getCachedFrontmatterStorageKinds", () => {
  it("distinguishes array storage from scalar storage", () => {
    const file = { path: "note.md" } as TFile;
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => ({
          frontmatter: {
            empty: null,
            nested: [{ value: "unsupported" }],
            position: { start: { line: 0 }, end: { line: 5 } },
            scalar: "not-a-list",
            values: ["alpha"],
          },
        })),
      },
    } as unknown as App;

    expect(getCachedFrontmatterStorageKinds(app, file)).toEqual(
      new Map([
        ["empty", "scalar"],
        ["nested", "array"],
        ["scalar", "scalar"],
        ["values", "array"],
      ]),
    );
  });

  it("returns null when frontmatter metadata is unavailable", () => {
    const file = { path: "note.md" } as TFile;
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => null),
      },
    } as unknown as App;

    expect(getCachedFrontmatterStorageKinds(app, file)).toBeNull();
  });
});
