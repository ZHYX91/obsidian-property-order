import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

const includedExtensions = new Set([
  ".css",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".yaml",
  ".yml",
]);
const includedNames = new Set([".gitignore", ".node-version", "LICENSE"]);
const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "release",
]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function checkFormatting(projectRoot = defaultProjectRoot) {
  const root = path.resolve(projectRoot);
  const files = await collectTextFiles(root);
  const failures = [];

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
    let source;

    try {
      source = utf8Decoder.decode(await readFile(filePath));
    } catch {
      failures.push(`${relativePath}: must be valid UTF-8`);
      continue;
    }

    if (source.startsWith("\uFEFF")) {
      failures.push(`${relativePath}: UTF-8 BOM is forbidden`);
    }
    if (source.includes("\r")) {
      failures.push(`${relativePath}: line endings must be LF`);
    }
    if (source.includes("\0")) {
      failures.push(`${relativePath}: NUL bytes are forbidden`);
    }
    if (!source.endsWith("\n")) {
      failures.push(`${relativePath}: final newline is required`);
    }
    if (/[ \t]+$/mu.test(source)) {
      failures.push(`${relativePath}: trailing whitespace is forbidden`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Format check failed:\n- ${failures.join("\n- ")}`);
  }

  return files.length;
}

async function collectTextFiles(root) {
  const result = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await visit(entryPath);
        }
        continue;
      }

      if (
        entry.isFile() &&
        (includedNames.has(entry.name) || includedExtensions.has(path.extname(entry.name)))
      ) {
        result.push(entryPath);
      }
    }
  }

  await visit(root);
  return result.sort((left, right) => left.localeCompare(right, "en"));
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === entryPoint) {
  const count = await checkFormatting();
  process.stdout.write(`Format check passed for ${count} text files.\n`);
}
