import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import esbuild from "esbuild";

import { createEsbuildOptions } from "./esbuild-options.mjs";
import {
  assertPackageLockContract,
  assertPackageVersionContract,
} from "./release-contract.mjs";

export const PRODUCTION_MAIN_JS_BUDGET_BYTES = 320_000;
export const PRODUCTION_MAIN_JS_REFERENCE_BYTES = 267_789;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertNonemptyFile(filePath) {
  let fileStats;

  try {
    fileStats = await stat(filePath);
  } catch {
    throw new Error(`Missing release asset: ${filePath}`);
  }

  if (!fileStats.isFile() || fileStats.size === 0) {
    throw new Error(`Release asset must be a non-empty file: ${filePath}`);
  }

  return fileStats;
}

export async function checkRelease(
  projectRoot = process.cwd(),
  { mainJavascriptBudgetBytes = PRODUCTION_MAIN_JS_BUDGET_BYTES } = {},
) {
  if (!Number.isSafeInteger(mainJavascriptBudgetBytes) || mainJavascriptBudgetBytes <= 0) {
    throw new Error("Production main.js budget must be a positive safe integer");
  }

  const fromRoot = (...segments) => path.join(projectRoot, ...segments);
  const packageJson = await readJson(fromRoot("package.json"));
  const manifest = await readJson(fromRoot("manifest.json"));
  const packageLock = await readJson(fromRoot("package-lock.json"));
  const versions = await readJson(fromRoot("versions.json"));

  assertPackageVersionContract(manifest, packageJson, versions);
  assertPackageLockContract(packageJson, packageLock);

  const releaseDir = fromRoot("dist");
  const bundledMainPath = path.join(releaseDir, "main.js");
  const bundledManifestPath = path.join(releaseDir, "manifest.json");
  const bundledStylesPath = path.join(releaseDir, "styles.css");

  const [bundledMainStats] = await Promise.all([
    assertNonemptyFile(bundledMainPath),
    assertNonemptyFile(bundledManifestPath),
    assertNonemptyFile(bundledStylesPath),
  ]);
  if (bundledMainStats.size > mainJavascriptBudgetBytes) {
    throw new Error(
      `Production main.js is ${bundledMainStats.size} B; budget is ${mainJavascriptBudgetBytes} B`,
    );
  }

  const [bundledMain, bundledManifest, sourceStyles, bundledStyles, expectedBuild] =
    await Promise.all([
      readFile(bundledMainPath),
      readJson(bundledManifestPath),
      readFile(fromRoot("styles.css")),
      readFile(bundledStylesPath),
      esbuild.build({
        ...createEsbuildOptions({ production: true, projectRoot }),
        logLevel: "silent",
        write: false,
      }),
    ]);

  if (
    expectedBuild.outputFiles.length !== 1 ||
    !isDeepStrictEqual(bundledMain, Buffer.from(expectedBuild.outputFiles[0].contents))
  ) {
    throw new Error("dist/main.js is stale; run npm run build");
  }

  if (!isDeepStrictEqual(bundledManifest, manifest)) {
    throw new Error("dist/manifest.json is stale; run npm run build");
  }

  if (!isDeepStrictEqual(bundledStyles, sourceStyles)) {
    throw new Error("dist/styles.css is stale; run npm run build");
  }

  return {
    id: manifest.id,
    mainJavascriptBudgetBytes,
    mainJavascriptBytes: bundledMainStats.size,
    mainJavascriptReferenceBytes: PRODUCTION_MAIN_JS_REFERENCE_BYTES,
    version: manifest.version,
  };
}

async function main() {
  const result = await checkRelease();
  console.log(
    `Release check passed for ${result.id} ${result.version}; main.js ${result.mainJavascriptBytes} B, reference ${result.mainJavascriptReferenceBytes} B, budget ${result.mainJavascriptBudgetBytes} B`,
  );
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;

if (import.meta.url === entryPoint) {
  await main();
}
