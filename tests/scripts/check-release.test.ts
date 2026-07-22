import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import esbuild from "esbuild";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The release checker is an executable JavaScript module without declarations.
import { checkRelease } from "../../scripts/check-release.mjs";
// @ts-expect-error The shared esbuild options are implemented in JavaScript.
import { createEsbuildOptions } from "../../scripts/esbuild-options.mjs";

const temporaryDirectories: string[] = [];

async function createReleaseProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "property-order-release-"));
  temporaryDirectories.push(root);
  const releaseDir = path.join(root, "dist", "property-order");
  const manifest = {
    id: "property-order",
    version: "0.1.0",
    minAppVersion: "1.5.7",
  };
  await mkdir(releaseDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.1.0" })),
    writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest)),
    writeFile(path.join(root, "versions.json"), JSON.stringify({ "0.1.0": "1.5.7" })),
    writeFile(path.join(root, "styles.css"), ".property-order { color: red; }\n"),
    writeFile(path.join(root, "main.ts"), "export const releaseValue = 1;\n"),
    writeFile(path.join(releaseDir, "manifest.json"), JSON.stringify(manifest)),
    writeFile(path.join(releaseDir, "styles.css"), ".property-order { color: red; }\n"),
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

describe("release checker", () => {
  it("accepts non-empty, synchronized release assets", async () => {
    const root = await createReleaseProject();
    await expect(checkRelease(root)).resolves.toEqual({ id: "property-order", version: "0.1.0" });
  });

  it("rejects stale static assets and empty bundles", async () => {
    const staleStylesRoot = await createReleaseProject();
    await writeFile(
      path.join(staleStylesRoot, "dist", "property-order", "styles.css"),
      "stale\n",
    );
    await expect(checkRelease(staleStylesRoot)).rejects.toThrow(/styles\.css is stale/);

    const emptyBundleRoot = await createReleaseProject();
    await writeFile(path.join(emptyBundleRoot, "dist", "property-order", "main.js"), "");
    await expect(checkRelease(emptyBundleRoot)).rejects.toThrow(/non-empty file/);
  });

  it("compares styles as bytes even when invalid UTF-8 decodes identically", async () => {
    const root = await createReleaseProject();
    await writeFile(path.join(root, "styles.css"), Uint8Array.from([0xff]));
    await writeFile(
      path.join(root, "dist", "property-order", "styles.css"),
      Uint8Array.from([0xfe]),
    );

    await expect(checkRelease(root)).rejects.toThrow(/styles\.css is stale/);
  });

  it("rejects a bundled manifest that differs from the source", async () => {
    const root = await createReleaseProject();
    await writeFile(
      path.join(root, "dist", "property-order", "manifest.json"),
      JSON.stringify({ id: "other", version: "0.1.0", minAppVersion: "1.5.7" }),
    );
    await expect(checkRelease(root)).rejects.toThrow(/manifest\.json is stale/);
  });

  it("rejects a bundle that does not match the current TypeScript sources", async () => {
    const root = await createReleaseProject();
    await writeFile(path.join(root, "main.ts"), "export const releaseValue = 2;\n");

    await expect(checkRelease(root)).rejects.toThrow(/main\.js is stale/);
  });
});
