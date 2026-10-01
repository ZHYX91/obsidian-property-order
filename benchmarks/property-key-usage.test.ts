import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";

import {
  getCachedPropertyKeyUsage,
  invalidatePropertyKeyUsage,
} from "../src/obsidian/metadata";

declare const __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__: number;
declare const __PROPERTY_ORDER_BENCHMARK_P95_BUDGET_MS__: number;

const COMMON_KEYS = ["aliases", "cssclasses", "date", "project", "status", "tags"];
const BUCKET_COUNT = 128;
const SAMPLE_COUNT = 25;

interface BenchmarkHarness {
  app: App;
  getStats(): {
    cacheReads: number;
    enumerations: number;
  };
}

describe("property note-count benchmark", () => {
  it(`counts ${__PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__.toLocaleString("en-US")} deterministic cached notes within the regression budget`, () => {
    const noteCount = __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__;
    const harness = createBenchmarkApp(noteCount);
    const { app } = harness;

    getCachedPropertyKeyUsage(app);
    const durations = Array.from({ length: SAMPLE_COUNT }, () => {
      invalidatePropertyKeyUsage(app);
      const startedAt = performance.now();
      const usage = getCachedPropertyKeyUsage(app);
      return { duration: performance.now() - startedAt, usage };
    });
    const sortedDurations = durations
      .map((sample) => sample.duration)
      .sort((a, b) => a - b);
    const usage = durations.at(-1)?.usage ?? [];
    const countByKey = new Map(usage.map((item) => [item.key, item.count]));
    const expectedBucketBase = Math.floor(noteCount / BUCKET_COUNT);
    const expectedScanCount = SAMPLE_COUNT + 1;

    for (const key of COMMON_KEYS) {
      expect(countByKey.get(key)).toBe(noteCount);
    }
    expect(countByKey.get("bucket_0")).toBeGreaterThanOrEqual(expectedBucketBase);
    expect(usage).toHaveLength(COMMON_KEYS.length + BUCKET_COUNT);
    expect(harness.getStats()).toEqual({
      cacheReads: noteCount * expectedScanCount,
      enumerations: expectedScanCount,
    });

    const cachedFirst = getCachedPropertyKeyUsage(app);
    const cachedStartedAt = performance.now();
    const cachedSecond = getCachedPropertyKeyUsage(app);
    const cachedDuration = performance.now() - cachedStartedAt;
    expect(cachedSecond).toBe(cachedFirst);
    expect(harness.getStats()).toEqual({
      cacheReads: noteCount * expectedScanCount,
      enumerations: expectedScanCount,
    });

    const p95 = percentile(sortedDurations, 0.95);
    expect(p95).toBeLessThanOrEqual(__PROPERTY_ORDER_BENCHMARK_P95_BUDGET_MS__);

    console.info(
      [
        `Property note-count benchmark (${noteCount.toLocaleString("en-US")} notes):`,
        `p50=${percentile(sortedDurations, 0.5).toFixed(2)}ms`,
        `p95=${p95.toFixed(2)}ms`,
        `max=${Math.max(...sortedDurations).toFixed(2)}ms`,
        `cached=${cachedDuration.toFixed(3)}ms`,
        `budget=${__PROPERTY_ORDER_BENCHMARK_P95_BUDGET_MS__}ms`,
        `rescans=${expectedScanCount}`,
        `cacheReads=${noteCount * expectedScanCount}`,
      ].join(" "),
    );
  });
});

function createBenchmarkApp(noteCount: number): BenchmarkHarness {
  const files = Array.from({ length: noteCount }, (_, index) => ({
    path: `notes/${String(index).padStart(6, "0")}.md`,
  })) as TFile[];
  const frontmatters = files.map((_file, index) => ({
    aliases: [`Alias ${index}`, `Alt ${index % 17}`],
    cssclasses: ["benchmark", `bucket-${index % 8}`],
    date: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
    project: `project-${index % 64}`,
    status: index % 3 === 0 ? "draft" : index % 3 === 1 ? "active" : "done",
    tags: ["benchmark", `group/${index % 32}`],
    [`bucket_${index % BUCKET_COUNT}`]: index,
    position: {
      end: { line: 10 + (index % 5) },
      start: { line: 0 },
    },
  }));
  const cacheByFile = new Map(files.map((file, index) => [
    file,
    { frontmatter: frontmatters[index] },
  ]));
  let cacheReads = 0;
  let enumerations = 0;

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

  return {
    app,
    getStats: () => ({ cacheReads, enumerations }),
  };
}

function percentile(sortedValues: number[], quantile: number): number {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * quantile) - 1),
  );
  return sortedValues[index] ?? 0;
}
