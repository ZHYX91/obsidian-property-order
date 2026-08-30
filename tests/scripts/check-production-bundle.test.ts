import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import esbuild from "esbuild";
import { afterEach, describe, expect, it } from "vitest";

import {
  PRODUCTION_MAIN_JS_BUDGET_BYTES,
  PRODUCTION_MAIN_JS_REFERENCE_BYTES,
  checkProductionBundle,
} from "../../scripts/check-production-bundle.mjs";
// @ts-expect-error The shared esbuild options are implemented in JavaScript.
import { createEsbuildOptions } from "../../scripts/esbuild-options.mjs";

const temporaryDirectories: string[] = [];

async function createReleaseProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "property-order-production-bundle-"));
  temporaryDirectories.push(root);
  await Promise.all([
    writeFile(
      path.join(root, "manifest.json"),
      JSON.stringify({ id: "property-order", version: "0.1.0" }),
    ),
    writeFile(path.join(root, "main.ts"), "export const releaseValue = 1;\n"),
  ]);
  await esbuild.build(createEsbuildOptions({ production: true, projectRoot: root }));
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("production bundle checker", () => {
  it("accepts the byte-exact production rebuild", async () => {
    const root = await createReleaseProject();
    const mainJavascriptBytes = (await stat(path.join(root, "dist", "main.js"))).size;
    await expect(checkProductionBundle(root)).resolves.toEqual({
      id: "property-order",
      mainJavascriptBudgetBytes: PRODUCTION_MAIN_JS_BUDGET_BYTES,
      mainJavascriptBytes,
      mainJavascriptReferenceBytes: PRODUCTION_MAIN_JS_REFERENCE_BYTES,
      version: "0.1.0",
    });
  });

  it("accepts the exact budget boundary and rejects one byte over", async () => {
    const root = await createReleaseProject();
    const mainJavascriptBytes = (await stat(path.join(root, "dist", "main.js"))).size;

    await expect(checkProductionBundle(root, {
      mainJavascriptBudgetBytes: mainJavascriptBytes,
    })).resolves.toMatchObject({ mainJavascriptBytes });
    await expect(checkProductionBundle(root, {
      mainJavascriptBudgetBytes: mainJavascriptBytes - 1,
    })).rejects.toThrow(
      `Production main.js is ${mainJavascriptBytes} B; budget is ${mainJavascriptBytes - 1} B`,
    );
  });

  it("pins the release budget and measured reference", () => {
    expect(PRODUCTION_MAIN_JS_BUDGET_BYTES).toBe(320_000);
    expect(PRODUCTION_MAIN_JS_REFERENCE_BYTES).toBe(267_789);
  });

  it("rejects an empty or stale bundle", async () => {
    const emptyRoot = await createReleaseProject();
    await writeFile(path.join(emptyRoot, "dist", "main.js"), "");
    await expect(checkProductionBundle(emptyRoot)).rejects.toThrow(/must not be empty/);

    const staleRoot = await createReleaseProject();
    await writeFile(path.join(staleRoot, "main.ts"), "export const releaseValue = 2;\n");
    await expect(checkProductionBundle(staleRoot)).rejects.toThrow(/main\.js is stale/);
  });
});
