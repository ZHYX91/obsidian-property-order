import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import esbuild from "esbuild";

import { createEsbuildOptions } from "./esbuild-options.mjs";

export const PRODUCTION_MAIN_JS_BUDGET_BYTES = 320_000;
export const PRODUCTION_MAIN_JS_REFERENCE_BYTES = 267_789;

export async function checkProductionBundle(
  projectRoot = process.cwd(),
  { mainJavascriptBudgetBytes = PRODUCTION_MAIN_JS_BUDGET_BYTES } = {},
) {
  if (!Number.isSafeInteger(mainJavascriptBudgetBytes) || mainJavascriptBudgetBytes <= 0) {
    throw new Error("Production main.js budget must be a positive safe integer");
  }

  const fromRoot = (...segments) => path.join(projectRoot, ...segments);
  const manifest = JSON.parse(await readFile(fromRoot("manifest.json"), "utf8"));
  const bundledMainPath = fromRoot("dist", "main.js");
  const bundledMain = await readFile(bundledMainPath);

  if (bundledMain.length === 0) {
    throw new Error("Production main.js must not be empty");
  }
  if (bundledMain.length > mainJavascriptBudgetBytes) {
    throw new Error(
      `Production main.js is ${bundledMain.length} B; budget is ${mainJavascriptBudgetBytes} B`,
    );
  }

  const expectedBuild = await esbuild.build({
    ...createEsbuildOptions({ production: true, projectRoot }),
    logLevel: "silent",
    write: false,
  });
  if (
    expectedBuild.outputFiles.length !== 1 ||
    !isDeepStrictEqual(bundledMain, Buffer.from(expectedBuild.outputFiles[0].contents))
  ) {
    throw new Error("dist/main.js is stale; run npm run build");
  }

  return {
    id: manifest.id,
    mainJavascriptBudgetBytes,
    mainJavascriptBytes: bundledMain.length,
    mainJavascriptReferenceBytes: PRODUCTION_MAIN_JS_REFERENCE_BYTES,
    version: manifest.version,
  };
}

async function main() {
  const result = await checkProductionBundle();
  console.log(
    `Production bundle passed for ${result.id} ${result.version}; main.js ${result.mainJavascriptBytes} B, reference ${result.mainJavascriptReferenceBytes} B, budget ${result.mainJavascriptBudgetBytes} B`,
  );
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;

if (import.meta.url === entryPoint) {
  await main();
}
