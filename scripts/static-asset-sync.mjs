import { copyFile, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

const DEFAULT_RETRY_DELAYS = [25, 75, 150];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createStaticAssetSync({
  assets,
  debounceMilliseconds = 50,
  destinationDirectory,
  logger = console,
  projectRoot,
  retryDelays = DEFAULT_RETRY_DELAYS,
  copy = copyFile,
}) {
  const normalizedAssets = assets.map((assetPath) => path.normalize(assetPath));
  const assetSet = new Set(normalizedAssets);
  const completedErrors = [];
  const pendingAssets = new Set();
  const syncTasks = new Map();
  let debounceTimer;
  let temporaryFileSequence = 0;

  async function syncOnce(assetPath) {
    await mkdir(destinationDirectory, { recursive: true });
    temporaryFileSequence += 1;
    const destinationPath = path.join(
      destinationDirectory,
      path.basename(assetPath),
    );
    const temporaryPath = path.join(
      destinationDirectory,
      `.${path.basename(assetPath)}.property-order-${process.pid}-${temporaryFileSequence}.tmp`,
    );

    try {
      await copy(path.join(projectRoot, assetPath), temporaryPath);
      await rename(temporaryPath, destinationPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  async function syncWithRetry(assetPath) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await syncOnce(assetPath);
        return;
      } catch (error) {
        if (error?.code !== "ENOENT" || attempt >= retryDelays.length) {
          throw error;
        }
        await wait(retryDelays[attempt]);
      }
    }
  }

  function queue(assetPath) {
    const previousTask = syncTasks.get(assetPath) ?? Promise.resolve();
    const nextTask = previousTask
      .catch(() => undefined)
      .then(() => syncWithRetry(assetPath));

    syncTasks.set(assetPath, nextTask);
    void nextTask
      .then(
        () => logger.log(`Synced ${assetPath}`),
        (error) => {
          completedErrors.push(error);
          logger.error(`Failed to sync ${assetPath}`, error);
        },
      )
      .finally(() => {
        if (syncTasks.get(assetPath) === nextTask) {
          syncTasks.delete(assetPath);
        }
      })
      .catch(() => undefined);

    return nextTask;
  }

  function drainPendingAssets() {
    debounceTimer = undefined;
    const assetsToSync = [...pendingAssets];
    pendingAssets.clear();
    for (const assetPath of assetsToSync) {
      queue(assetPath);
    }
  }

  function schedule(filename) {
    const changedAssets = [];

    if (filename == null) {
      changedAssets.push(...normalizedAssets);
    } else {
      const relativePath = path.normalize(filename.toString());
      if (assetSet.has(relativePath)) {
        changedAssets.push(relativePath);
      }
    }

    if (changedAssets.length === 0) {
      return;
    }

    for (const assetPath of changedAssets) {
      pendingAssets.add(assetPath);
    }
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(drainPendingAssets, debounceMilliseconds);
  }

  async function syncAll() {
    await Promise.all(normalizedAssets.map(syncWithRetry));
  }

  async function flush() {
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      drainPendingAssets();
    }

    await Promise.allSettled(syncTasks.values());
    const errors = completedErrors.splice(0);
    if (errors.length > 0) {
      throw new AggregateError(errors, "Failed to synchronize static assets");
    }
  }

  return { flush, schedule, syncAll };
}
