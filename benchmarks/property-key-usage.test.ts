import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  getCachedPropertyKeyUsage,
  getPropertyKeyUsage,
} from "../src/obsidian/metadata";

declare const __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__: number;

const COMMON_KEYS = ["aliases", "cssclasses", "date", "project", "status", "tags"];
const BUCKET_COUNT = 128;
const SAMPLE_COUNT = 25;

describe("property note-count benchmark", () => {
  it(`counts ${__PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__.toLocaleString("en-US")} deterministic cached notes`, () => {
    const app = createBenchmarkApp(__PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__);

    getPropertyKeyUsage(app);
    const samples = Array.from({ length: SAMPLE_COUNT }, () => {
      const startedAt = performance.now();
      const usage = getPropertyKeyUsage(app);
      return { duration: performance.now() - startedAt, usage };
    });
    const durations = samples.map((sample) => sample.duration).sort((a, b) => a - b);
    const usage = samples.at(-1)?.usage ?? [];
    const countByKey = new Map(usage.map((item) => [item.key, item.count]));
    const expectedBucketBase = Math.floor(
      __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__ / BUCKET_COUNT,
    );

    for (const key of COMMON_KEYS) {
      expect(countByKey.get(key)).toBe(__PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__);
    }
    expect(countByKey.get("bucket_0")).toBeGreaterThanOrEqual(expectedBucketBase);
    expect(usage).toHaveLength(COMMON_KEYS.length + BUCKET_COUNT);

    const cachedFirst = getCachedPropertyKeyUsage(app);
    const cachedStartedAt = performance.now();
    const cachedSecond = getCachedPropertyKeyUsage(app);
    const cachedDuration = performance.now() - cachedStartedAt;
    expect(cachedSecond).toBe(cachedFirst);

    console.info(
      [
        `Property note-count benchmark (${__PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__.toLocaleString("en-US")} notes):`,
        `p50=${percentile(durations, 0.5).toFixed(2)}ms`,
        `p95=${percentile(durations, 0.95).toFixed(2)}ms`,
        `max=${Math.max(...durations).toFixed(2)}ms`,
        `cached=${cachedDuration.toFixed(3)}ms`,
      ].join(" "),
    );
  });
});

function createBenchmarkApp(noteCount: number): App {
  const files = Array.from({ length: noteCount }, (_, index) => ({
    path: `notes/${String(index).padStart(6, "0")}.md`,
  })) as TFile[];
  const frontmatters = files.map((_file, index) => Object.fromEntries([
    ...COMMON_KEYS.map((key) => [key, true]),
    [`bucket_${index % BUCKET_COUNT}`, true],
  ]));
  const cacheByFile = new Map(files.map((file, index) => [
    file,
    { frontmatter: frontmatters[index] },
  ]));

  return {
    metadataCache: {
      getFileCache: (file: TFile) => cacheByFile.get(file) ?? null,
    },
    vault: {
      getMarkdownFiles: () => files,
    },
  } as unknown as App;
}

function percentile(sortedValues: number[], quantile: number): number {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * quantile) - 1),
  );
  return sortedValues[index] ?? 0;
}
