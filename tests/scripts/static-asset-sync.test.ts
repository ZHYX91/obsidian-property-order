import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error The build helper is implemented in JavaScript.
import { createStaticAssetSync } from "../../scripts/static-asset-sync.mjs";

const temporaryDirectories: string[] = [];
const silentLogger = { error: vi.fn(), log: vi.fn() };

async function createProject(): Promise<{
  destinationDirectory: string;
  projectRoot: string;
}> {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "property-order-assets-"));
  temporaryDirectories.push(projectRoot);
  const destinationDirectory = path.join(projectRoot, "dist", "property-order");
  await mkdir(destinationDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(projectRoot, "manifest.json"), "manifest-v1"),
    writeFile(path.join(projectRoot, "styles.css"), "styles-v1"),
  ]);
  return { destinationDirectory, projectRoot };
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("static asset synchronization", () => {
  it("treats a null watcher filename as a request to resync every asset", async () => {
    const { destinationDirectory, projectRoot } = await createProject();
    const sync = createStaticAssetSync({
      assets: ["manifest.json", "styles.css"],
      debounceMilliseconds: 1,
      destinationDirectory,
      logger: silentLogger,
      projectRoot,
    });

    await sync.syncAll();
    await Promise.all([
      writeFile(path.join(projectRoot, "manifest.json"), "manifest-v2"),
      writeFile(path.join(projectRoot, "styles.css"), "styles-v2"),
    ]);
    sync.schedule(null);
    await sync.flush();

    await expect(
      readFile(path.join(destinationDirectory, "manifest.json"), "utf8"),
    ).resolves.toBe("manifest-v2");
    await expect(
      readFile(path.join(destinationDirectory, "styles.css"), "utf8"),
    ).resolves.toBe("styles-v2");
  });

  it("retries a transient ENOENT caused by an editor's atomic save", async () => {
    const { destinationDirectory, projectRoot } = await createProject();
    let copyAttempts = 0;
    const sync = createStaticAssetSync({
      assets: ["styles.css"],
      destinationDirectory,
      logger: silentLogger,
      projectRoot,
      retryDelays: [0],
      copy: async (sourcePath: string, destinationPath: string) => {
        copyAttempts += 1;
        if (copyAttempts === 1) {
          const error = new Error("temporarily missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        await copyFile(sourcePath, destinationPath);
      },
    });

    await sync.syncAll();

    expect(copyAttempts).toBe(2);
    await expect(
      readFile(path.join(destinationDirectory, "styles.css"), "utf8"),
    ).resolves.toBe("styles-v1");
  });

  it("debounces repeated watcher events for the same asset", async () => {
    const { destinationDirectory, projectRoot } = await createProject();
    let copyAttempts = 0;
    const sync = createStaticAssetSync({
      assets: ["styles.css"],
      debounceMilliseconds: 10,
      destinationDirectory,
      logger: silentLogger,
      projectRoot,
      copy: async (sourcePath: string, destinationPath: string) => {
        copyAttempts += 1;
        await copyFile(sourcePath, destinationPath);
      },
    });

    sync.schedule("styles.css");
    sync.schedule(Buffer.from("styles.css"));
    sync.schedule("styles.css");
    await sync.flush();

    expect(copyAttempts).toBe(1);
  });

  it("reports a completed watcher failure on the next flush", async () => {
    const { destinationDirectory, projectRoot } = await createProject();
    const copyError = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    let resolveFailureLogged: (() => void) | undefined;
    const failureLogged = new Promise<void>((resolve) => {
      resolveFailureLogged = resolve;
    });
    const logger = {
      error: vi.fn(() => resolveFailureLogged?.()),
      log: vi.fn(),
    };
    const sync = createStaticAssetSync({
      assets: ["styles.css"],
      copy: async () => {
        throw copyError;
      },
      debounceMilliseconds: 0,
      destinationDirectory,
      logger,
      projectRoot,
      retryDelays: [],
    });

    sync.schedule("styles.css");
    await failureLogged;

    let flushError: unknown;
    try {
      await sync.flush();
    } catch (error) {
      flushError = error;
    }
    expect(flushError).toBeInstanceOf(Error);
    expect((flushError as Error).name).toBe("AggregateError");
    expect((flushError as Error & { errors: unknown[] }).errors).toEqual([
      copyError,
    ]);
    await expect(sync.flush()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to sync styles.css",
      copyError,
    );
  });
});
