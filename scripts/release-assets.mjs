import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ARCHIVE_DIRECTORY = "property-order";
const LOOSE_ASSET_NAMES = Object.freeze(["main.js", "manifest.json", "styles.css"]);
const ZIP_DOS_DATE = 0x0021;
const ZIP_DOS_TIME = 0;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_UNIX_FILE_MODE = 0o100644;
const ZIP_VERSION = 20;
const ZIP_VERSION_MADE_BY_UNIX = (3 << 8) | ZIP_VERSION;
const CRC32_TABLE = createCrc32Table();

export async function buildReleaseArchive({
  distDirectory = "dist",
  outputPath,
  version,
} = {}) {
  const resolvedDistDirectory = path.resolve(distDirectory);
  const manifestSource = await readRegularFile(
    path.join(resolvedDistDirectory, "manifest.json"),
    "Release manifest",
  );
  const manifest = parseJson(manifestSource, "Release manifest");
  const manifestVersion = manifest?.version;
  const releaseVersion = version ?? manifestVersion;

  assertReleaseVersion(releaseVersion);
  if (manifest?.id !== "property-order") {
    throw new Error("Release manifest must use the property-order plugin ID");
  }
  if (manifestVersion !== releaseVersion) {
    throw new Error(
      `Release archive version ${releaseVersion} does not match dist/manifest.json version ${String(
        manifestVersion,
      )}`,
    );
  }

  const entries = await Promise.all(
    LOOSE_ASSET_NAMES.map(async (fileName) => ({
      content: await readRegularFile(
        path.join(resolvedDistDirectory, fileName),
        `Release asset ${fileName}`,
      ),
      name: `${ARCHIVE_DIRECTORY}/${fileName}`,
    })),
  );
  const archive = createDeterministicZip(entries);
  const resolvedOutputPath = path.resolve(
    outputPath ??
      path.join(resolvedDistDirectory, `property-order-${releaseVersion}.zip`),
  );
  await writeFile(resolvedOutputPath, archive, { mode: 0o644 });

  return { outputPath: resolvedOutputPath, sha256: sha256(archive) };
}

export async function compareExistingReleaseAssets({
  existingDirectory,
  localDirectory = "dist",
  version,
}) {
  assertReleaseVersion(version);
  if (typeof existingDirectory !== "string" || existingDirectory.length === 0) {
    throw new Error("An existing Release asset directory is required");
  }

  const assetNames = [...LOOSE_ASSET_NAMES, `property-order-${version}.zip`];
  const localRoot = path.resolve(localDirectory);
  const existingRoot = path.resolve(existingDirectory);
  const differences = [];
  const existingEntries = await readdir(existingRoot, { withFileTypes: true });
  const expectedAssetNames = assetNames.slice().sort();
  const existingAssetNames = existingEntries.map(({ name }) => name).sort();
  const missingAssetNames = expectedAssetNames.filter(
    (assetName) => !existingAssetNames.includes(assetName),
  );
  const unexpectedAssetNames = existingAssetNames.filter(
    (assetName) => !expectedAssetNames.includes(assetName),
  );

  if (missingAssetNames.length > 0) {
    differences.push(`missing assets: ${missingAssetNames.join(", ")}`);
  }
  if (unexpectedAssetNames.length > 0) {
    differences.push(`unexpected assets: ${unexpectedAssetNames.join(", ")}`);
  }

  for (const assetName of assetNames) {
    const localContent = await readRegularFile(
      path.join(localRoot, assetName),
      `Local Release asset ${assetName}`,
    );
    let existingContent;

    try {
      existingContent = await readRegularFile(
        path.join(existingRoot, assetName),
        `Existing Release asset ${assetName}`,
      );
    } catch (error) {
      differences.push(
        `${assetName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    const localHash = sha256(localContent);
    const existingHash = sha256(existingContent);
    if (localHash !== existingHash) {
      differences.push(`${assetName}: local ${localHash}, existing ${existingHash}`);
    }
  }

  if (differences.length > 0) {
    throw new Error(
      `Existing Release ${version} is immutable and its assets differ. Publish a new version instead:\n- ${differences.join(
        "\n- ",
      )}`,
    );
  }

  return assetNames;
}

function createDeterministicZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content);
    assertZip32Size(fileName.length, `Archive path ${entry.name}`);
    assertZip32Size(content.length, `Archive asset ${entry.name}`);
    const checksum = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(ZIP_VERSION, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(ZIP_DOS_TIME, 10);
    localHeader.writeUInt16LE(ZIP_DOS_DATE, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(ZIP_VERSION_MADE_BY_UNIX, 4);
    centralHeader.writeUInt16LE(ZIP_VERSION, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(ZIP_DOS_TIME, 12);
    centralHeader.writeUInt16LE(ZIP_DOS_DATE, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((ZIP_UNIX_FILE_MODE << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, fileName);

    localOffset += localHeader.length + fileName.length + content.length;
    assertZip32Size(localOffset, "Archive local data");
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(content) {
  let checksum = 0xffffffff;
  for (const byte of content) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

async function readRegularFile(filePath, label) {
  let stats;
  try {
    stats = await lstat(filePath);
  } catch (error) {
    throw new Error(`${label} is missing: ${filePath}`, { cause: error });
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} is not a regular file: ${filePath}`);
  }
  return readFile(filePath);
}

function parseJson(source, label) {
  try {
    return JSON.parse(source.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error });
  }
}

function assertReleaseVersion(version) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/u.test(version)) {
    throw new Error("Release version must use x.y.z without a v prefix");
  }
}

function assertZip32Size(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} exceeds the deterministic ZIP32 contract`);
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function parseCliArguments(arguments_) {
  const command = arguments_[0];
  const values = new Map();
  for (let index = 1; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name == null || !name.startsWith("--") || value == null) {
      throw new Error("Release asset options must use --name value pairs");
    }
    if (values.has(name)) {
      throw new Error(`Duplicate Release asset option: ${name}`);
    }
    values.set(name, value);
  }
  return { command, values };
}

function assertAllowedOptions(values, allowed) {
  for (const name of values.keys()) {
    if (!allowed.has(name)) {
      throw new Error(`Unknown Release asset option: ${name}`);
    }
  }
}

async function main() {
  const { command, values } = parseCliArguments(process.argv.slice(2));
  if (command === "archive") {
    assertAllowedOptions(values, new Set(["--dist-dir", "--output", "--version"]));
    const result = await buildReleaseArchive({
      distDirectory: values.get("--dist-dir"),
      outputPath: values.get("--output"),
      version: values.get("--version"),
    });
    process.stdout.write(`Deterministic Release archive created: ${result.outputPath}\n`);
    process.stdout.write(`SHA-256: ${result.sha256}\n`);
    return;
  }

  if (command === "compare") {
    assertAllowedOptions(
      values,
      new Set(["--existing-dir", "--local-dir", "--version"]),
    );
    const version = values.get("--version");
    const assetNames = await compareExistingReleaseAssets({
      existingDirectory: values.get("--existing-dir"),
      localDirectory: values.get("--local-dir"),
      version,
    });
    process.stdout.write(
      `Existing Release ${version} has identical immutable assets (${assetNames.join(
        ", ",
      )}); publication is a no-op.\n`,
    );
    return;
  }

  throw new Error(
    "Usage: node scripts/release-assets.mjs <archive|compare> [--version x.y.z] [options]",
  );
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (import.meta.url === entryPoint) {
  await main();
}
