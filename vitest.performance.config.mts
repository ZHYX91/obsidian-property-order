import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  define: {
    __PROPERTY_ORDER_BENCHMARK_NOTE_COUNT__: JSON.stringify(
      mode === "large" ? 50_000 : 10_000,
    ),
  },
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/mocks/obsidian.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["benchmarks/**/*.test.ts"],
    testTimeout: 120_000,
  },
}));
