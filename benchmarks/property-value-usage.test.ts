import type { App, TFile } from "obsidian";
import { expect, it } from "vitest";

import {
  getCachedPropertyValueUsage,
  getPropertyValueUsage,
  invalidatePropertyValueUsage,
} from "../src/obsidian/metadata";

declare const __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__: number;

it("measures high-cardinality property vocabulary and invalidation rescans", () => {
  const noteCount = __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__;
  const files = Array.from({ length: noteCount }, (_, index) => ({ path: `${index}.md` })) as TFile[];
  const cacheByFile = new Map(files.map((file, index) => [file, {
    frontmatter: {
      aliases: [`note-${index}`],
      status: ["shared", `value-${index}`, "shared"],
      project: `project-${index % 128}`,
      tags: ["benchmark"],
    },
  }]));
  let enumerations = 0;
  let cacheReads = 0;
  const app = {
    metadataCache: {
      getFileCache(file: TFile) {
        cacheReads += 1;
        return cacheByFile.get(file) ?? null;
      },
    },
    vault: {
      getMarkdownFiles() {
        enumerations += 1;
        return files;
      },
    },
  } as unknown as App;

  getPropertyValueUsage(app, "status");
  const durations = Array.from({ length: 25 }, () => {
    invalidatePropertyValueUsage(app);
    const startedAt = performance.now();
    const values = getCachedPropertyValueUsage(app, "status");
    const duration = performance.now() - startedAt;
    expect(values).toHaveLength(noteCount + 1);
    expect(values.find(({ value }) => value === "shared")?.count).toBe(noteCount);
    return duration;
  }).sort((a, b) => a - b);
  expect(enumerations).toBe(26);
  expect(cacheReads).toBe(noteCount * 26);

  const cachedFirst = getCachedPropertyValueUsage(app, "status");
  const cachedStartedAt = performance.now();
  const cachedSecond = getCachedPropertyValueUsage(app, "status");
  const cachedDuration = performance.now() - cachedStartedAt;
  expect(cachedSecond).toBe(cachedFirst);
  expect(enumerations).toBe(26);
  expect(cacheReads).toBe(noteCount * 26);
  console.info(
    `Property value vocabulary (${noteCount} notes, ${noteCount + 1} values): ` +
      `p50=${durations[12]!.toFixed(2)}ms p95=${durations[23]!.toFixed(2)}ms ` +
      `max=${durations[24]!.toFixed(2)}ms cached=${cachedDuration.toFixed(3)}ms ` +
      `rescans=${enumerations} cacheReads=${cacheReads}`,
  );
});
