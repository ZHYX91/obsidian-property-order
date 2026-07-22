import type { App, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
  getCachedFrontmatterListProperties,
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

describe("getCachedFrontmatterListProperties", () => {
  it("captures primitive list values and empty properties synchronously", () => {
    const file = { path: "note.md" } as TFile;
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => ({
          frontmatter: {
            empty: null,
            nested: [{ value: "unsupported" }],
            position: { start: { line: 0 }, end: { line: 5 } },
            scalar: "not-a-list",
            values: ["alpha", 2, true, null],
          },
        })),
      },
    } as unknown as App;

    expect(getCachedFrontmatterListProperties(app, file)).toEqual(
      new Map([
        ["empty", []],
        [
          "values",
          [
            { kind: "string", value: "alpha" },
            { kind: "number", value: "2" },
            { kind: "boolean", value: "true" },
            { kind: "null", value: "null" },
          ],
        ],
      ]),
    );
  });

  it("keeps scalar types distinct when their string values are identical", () => {
    const file = { path: "note.md" } as TFile;
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => ({
          frontmatter: {
            values: [true, "true", null, "null", 1, "1", Infinity, "Infinity", NaN, "NaN"],
          },
        })),
      },
    } as unknown as App;

    expect(getCachedFrontmatterListProperties(app, file)?.get("values")).toEqual([
      { kind: "boolean", value: "true" },
      { kind: "string", value: "true" },
      { kind: "null", value: "null" },
      { kind: "string", value: "null" },
      { kind: "number", value: "1" },
      { kind: "string", value: "1" },
      { kind: "number", value: "Infinity" },
      { kind: "string", value: "Infinity" },
      { kind: "number", value: "NaN" },
      { kind: "string", value: "NaN" },
    ]);
  });

  it("returns null when frontmatter metadata is unavailable", () => {
    const file = { path: "note.md" } as TFile;
    const app = {
      metadataCache: {
        getFileCache: vi.fn(() => null),
      },
    } as unknown as App;

    expect(getCachedFrontmatterListProperties(app, file)).toBeNull();
  });
});
