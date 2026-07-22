import { watch } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

import esbuild from "esbuild";

import { createEsbuildOptions } from "./scripts/esbuild-options.mjs";
import { createStaticAssetSync } from "./scripts/static-asset-sync.mjs";

const production = process.argv.includes("production");
const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "dist", "property-order");
const staticAssets = ["manifest.json", "styles.css"];
const staticAssetSync = createStaticAssetSync({
  assets: staticAssets,
  destinationDirectory: outputDir,
  projectRoot,
});

const context = await esbuild.context(createEsbuildOptions({ production, projectRoot }));

if (production) {
  await rm(outputDir, { recursive: true, force: true });
  await context.rebuild();
  await staticAssetSync.syncAll();
  await context.dispose();
} else {
  await staticAssetSync.syncAll();
  await context.watch();
  const assetWatcher = watch(".", (_eventType, filename) => {
    staticAssetSync.schedule(filename);
  });
  let shuttingDown = false;
  const shutdown = async (exitCode) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    assetWatcher.close();
    let finalExitCode = exitCode;
    try {
      await staticAssetSync.flush();
    } catch (error) {
      console.error("Failed to flush static assets during shutdown", error);
      finalExitCode = 1;
    }
    try {
      await context.dispose();
    } catch (error) {
      console.error("Failed to dispose the esbuild context", error);
      finalExitCode = 1;
    }
    process.exit(finalExitCode);
  };
  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
  console.log("Watching TypeScript and static assets for changes...");
}
