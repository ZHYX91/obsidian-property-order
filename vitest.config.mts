import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/mocks/obsidian.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      exclude: ["src/**/*.d.ts"],
      include: ["main.ts", "src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
    },
    exclude: [...configDefaults.exclude, "benchmarks/**"],
    setupFiles: ["./tests/setup/obsidian-dom.ts"],
  },
});
