import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export async function resolveIsolatedAcceptanceVaultPath(vaultPath) {
  const requestedVaultPath = path.resolve(vaultPath);

  try {
    const vaultStats = await lstat(requestedVaultPath);

    if (vaultStats.isSymbolicLink() || !vaultStats.isDirectory()) {
      throw new Error("vault root is not a regular directory");
    }

    const resolvedVaultPath = await realpath(requestedVaultPath);
    const obsidianPath = path.join(resolvedVaultPath, ".obsidian");
    const obsidianStats = await lstat(obsidianPath);

    if (obsidianStats.isSymbolicLink() || !obsidianStats.isDirectory()) {
      throw new Error(".obsidian is not a regular directory");
    }

    const resolvedObsidianPath = await realpath(obsidianPath);

    if (!areSamePath(resolvedObsidianPath, obsidianPath)) {
      throw new Error(".obsidian resolves outside the vault");
    }

    return resolvedVaultPath;
  } catch (error) {
    throw new Error(`Not an Obsidian vault: ${requestedVaultPath}`, { cause: error });
  }
}

function areSamePath(left, right) {
  const normalize = (value) =>
    process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}
