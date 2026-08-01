import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  path.join(projectRoot, ".github", "workflows", "release.yml"),
  "utf8",
);
const pythonCommand = process.platform === "win32" ? "python" : "python3";
const version = "1.2.3";

const fixtureBuilder = String.raw`
import hashlib
import json
import stat
import struct
import sys
import warnings
import zipfile
from pathlib import Path


scenario, root_arg, version = sys.argv[1:]
root = Path(root_arg)
root.mkdir()
archive_name = f"property-order-{version}.zip"
loose = {
    "main.js": b"console.log('safe');\n",
    "manifest.json": json.dumps({"id": "property-order", "version": version}).encode("utf-8"),
    "styles.css": b".safe { color: green; }\n",
}


def entry(name, content, mode=stat.S_IFREG | 0o644, *, directory=False):
    return {"content": content, "directory": directory, "mode": mode, "name": name}


def write_zip(target, entries):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as archive:
            for item in entries:
                info = zipfile.ZipInfo(item["name"], date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = item["mode"] << 16
                if item["directory"]:
                    info.external_attr |= 0x10
                archive.writestr(info, item["content"])


inner_entries = [
    entry("property-order/main.js", loose["main.js"]),
    entry("property-order/manifest.json", loose["manifest.json"]),
    entry("property-order/styles.css", loose["styles.css"]),
]
if scenario == "inner_duplicate":
    inner_entries.append(entry("property-order/main.js", loose["main.js"]))
elif scenario == "inner_reordered":
    inner_entries.reverse()
elif scenario == "inner_wrong_mode":
    inner_entries[0] = entry("property-order/main.js", loose["main.js"], stat.S_IFREG | 0o755)
elif scenario == "inner_symlink":
    inner_entries[2] = entry("property-order/styles.css", b"main.js", stat.S_IFLNK | 0o777)
elif scenario == "inner_extra_nested":
    inner_entries.append(entry("property-order/nested/extra.txt", b"bad"))

inner_path = root / archive_name
write_zip(inner_path, inner_entries)
inner_bytes = inner_path.read_bytes()
if scenario == "inner_wrong_bytes":
    loose["main.js"] = b"console.log('different');\n"
contents = {**loose, archive_name: inner_bytes}
checksum_names = ["main.js", "manifest.json", "styles.css", archive_name]
checksum_lines = [
    f"{hashlib.sha256(contents[name]).hexdigest()}  {name}\n" for name in checksum_names
]
if scenario == "wrong_checksum":
    checksum_lines[0] = f"{'0' * 64}  main.js\n"
elif scenario == "checksum_missing":
    checksum_lines.pop()
elif scenario == "checksum_duplicate":
    checksum_lines[1] = checksum_lines[0]
elif scenario == "checksum_extra":
    checksum_lines.append(f"{'0' * 64}  extra.txt\n")
elif scenario == "checksum_reordered":
    checksum_lines[0], checksum_lines[1] = checksum_lines[1], checksum_lines[0]
elif scenario == "checksum_crlf":
    checksum_lines = [line.replace("\n", "\r\n") for line in checksum_lines]
elif scenario == "checksum_noncanonical":
    checksum_lines[0] = checksum_lines[0].replace("  main.js", " *main.js")

checksum_bytes = "".join(checksum_lines).encode("ascii")
if scenario == "checksum_non_ascii":
    checksum_bytes += b"\x80"

outer_entries = [
    entry("SHA256SUMS", checksum_bytes),
    entry(archive_name, inner_bytes),
    entry("main.js", loose["main.js"]),
    entry("manifest.json", loose["manifest.json"]),
    entry("styles.css", loose["styles.css"]),
]
if scenario == "outer_missing":
    outer_entries.pop()
elif scenario == "outer_extra_nested":
    outer_entries.append(entry("nested/extra.txt", b"bad"))
elif scenario == "outer_duplicate":
    outer_entries.append(entry("main.js", loose["main.js"]))
elif scenario == "outer_dotdot":
    outer_entries.append(entry("../escape.txt", b"bad"))
elif scenario == "outer_absolute":
    outer_entries.append(entry("/absolute.txt", b"bad"))
elif scenario == "outer_drive_absolute":
    outer_entries.append(entry("C:/absolute.txt", b"bad"))
elif scenario == "outer_backslash":
    outer_entries.append(entry("nested/evil.txt", b"bad"))
elif scenario == "outer_control":
    outer_entries.append(entry("control\x01.txt", b"bad"))
elif scenario == "outer_nul":
    outer_entries.append(entry("nulx.txt", b"bad"))
elif scenario == "outer_directory":
    outer_entries[-1] = entry("styles.css", b"", stat.S_IFDIR | 0o755, directory=True)
elif scenario == "outer_symlink":
    outer_entries[-1] = entry("styles.css", b"main.js", stat.S_IFLNK | 0o777)

outer_path = root / "artifact.zip"
write_zip(outer_path, outer_entries)


def central_records(data):
    eocd = data.rfind(b"PK\x05\x06")
    count = struct.unpack_from("<H", data, eocd + 10)[0]
    position = struct.unpack_from("<I", data, eocd + 16)[0]
    records = []
    for _ in range(count):
        if data[position : position + 4] != b"PK\x01\x02":
            raise RuntimeError("invalid fixture central directory")
        name_length, extra_length, comment_length = struct.unpack_from(
            "<HHH", data, position + 28
        )
        local_offset = struct.unpack_from("<I", data, position + 42)[0]
        records.append((position, local_offset))
        position += 46 + name_length + extra_length + comment_length
    return records


if scenario == "legal_dos_outer":
    data = bytearray(outer_path.read_bytes())
    for central_offset, _ in central_records(data):
        struct.pack_into("<H", data, central_offset + 4, 20)
    outer_path.write_bytes(data)
elif scenario == "outer_backslash":
    data = outer_path.read_bytes().replace(
        b"nested/evil.txt", b"nested" + bytes([92]) + b"evil.txt"
    )
    outer_path.write_bytes(data)
elif scenario == "outer_nul":
    data = outer_path.read_bytes().replace(b"nulx.txt", b"nul\x00.txt")
    outer_path.write_bytes(data)
elif scenario == "outer_encrypted":
    data = bytearray(outer_path.read_bytes())
    central_offset, local_offset = central_records(data)[0]
    struct.pack_into("<H", data, central_offset + 8, struct.unpack_from("<H", data, central_offset + 8)[0] | 1)
    struct.pack_into("<H", data, local_offset + 6, struct.unpack_from("<H", data, local_offset + 6)[0] | 1)
    outer_path.write_bytes(data)
elif scenario == "outer_oversize_entry":
    data = bytearray(outer_path.read_bytes())
    central_offset, _ = central_records(data)[0]
    struct.pack_into("<I", data, central_offset + 24, 8 * 1024 * 1024 + 1)
    outer_path.write_bytes(data)
elif scenario == "outer_oversize_total":
    data = bytearray(outer_path.read_bytes())
    for central_offset, _ in central_records(data)[:4]:
        struct.pack_into("<I", data, central_offset + 24, 8 * 1024 * 1024)
    outer_path.write_bytes(data)
`;

let temporaryRoot: string;
let validatorPath: string;
let fixtureBuilderPath: string;

beforeAll(() => {
  temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "property-order-release-validator-"));
  validatorPath = path.join(temporaryRoot, "validator.py");
  fixtureBuilderPath = path.join(temporaryRoot, "fixture-builder.py");
  writeFileSync(validatorPath, extractValidator(workflow));
  writeFileSync(fixtureBuilderPath, fixtureBuilder);
});

afterAll(() => {
  rmSync(temporaryRoot, { force: true, recursive: true });
});

describe("inline release ZIP validator", () => {
  it("declares the Python 3.9 minimum used by the full local gate", () => {
    expect(extractValidator(workflow)).toContain("sys.version_info < (3, 9)");
  });

  it.each(["legal", "legal_dos_outer"])(
    "accepts the exact %s artifact boundary and extracts only five verified files",
    (scenario) => {
      const fixtureRoot = buildFixture(scenario);
      const candidate = path.join(fixtureRoot, "candidate");
      const result = runValidator(fixtureRoot, candidate);

      expect(result.status).toBe(0);
      expect(readdirSync(candidate).sort()).toEqual([
        "SHA256SUMS",
        "main.js",
        "manifest.json",
        `property-order-${version}.zip`,
        "styles.css",
      ]);
      expect(readFileSync(path.join(candidate, "main.js"), "utf8")).toBe(
        "console.log('safe');\n",
      );
    },
  );

  it.each([
    ["outer_missing", "inventory mismatch"],
    ["outer_extra_nested", "inventory mismatch"],
    ["outer_duplicate", "duplicate archive entry"],
    ["outer_dotdot", "path is not canonical"],
    ["outer_absolute", "path is absolute"],
    ["outer_drive_absolute", "path is absolute"],
    ["outer_backslash", "path contains a backslash"],
    ["outer_control", "path contains a control character"],
    ["outer_nul", "contains a NUL byte"],
    ["outer_directory", "directory archive entry"],
    ["outer_symlink", "non-regular archive entry"],
    ["outer_encrypted", "encrypted archive entry"],
    ["outer_oversize_entry", "entry exceeds the 8388608-byte limit"],
    ["outer_oversize_total", "archive exceeds the 25165824-byte total limit"],
  ])("rejects %s before extracting any artifact member", (scenario, expectedError) => {
    const fixtureRoot = buildFixture(scenario);
    const candidate = path.join(fixtureRoot, "candidate");
    const result = runValidator(fixtureRoot, candidate);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(expectedError);
    expect(existsSync(candidate)).toBe(false);
  });

  it.each([
    ["inner_extra_nested", "inventory mismatch"],
    ["inner_duplicate", "duplicate archive entry"],
    ["inner_reordered", "entry order mismatch"],
    ["inner_wrong_mode", "mode is not fixed"],
    ["inner_symlink", "non-regular archive entry"],
    ["inner_wrong_bytes", "differs from loose asset"],
    ["wrong_checksum", "SHA256SUMS mismatch"],
    ["checksum_missing", "exact four checksums"],
    ["checksum_duplicate", "duplicate file entry"],
    ["checksum_extra", "exact four checksums"],
    ["checksum_reordered", "not in canonical order"],
    ["checksum_crlf", "canonical LF-terminated lines"],
    ["checksum_noncanonical", "entry is non-canonical"],
    ["checksum_non_ascii", "readable ASCII"],
  ])("rejects %s after safe outer extraction", (scenario, expectedError) => {
    const fixtureRoot = buildFixture(scenario);
    const candidate = path.join(fixtureRoot, "candidate");
    const result = runValidator(fixtureRoot, candidate);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(expectedError);
  });
});

function extractValidator(source: string): string {
  const beginMarker = "          # RELEASE_ZIP_VALIDATOR_BEGIN";
  const endMarker = "          # RELEASE_ZIP_VALIDATOR_END";
  const begin = source.indexOf(beginMarker);
  const end = source.indexOf(endMarker, begin);
  if (begin < 0 || end < 0) {
    throw new Error("Inline release ZIP validator markers are missing");
  }

  return source
    .slice(begin, end + endMarker.length)
    .replace(/^ {10}/gmu, "")
    .concat("\n");
}

function buildFixture(scenario: string): string {
  const fixtureRoot = path.join(temporaryRoot, scenario);
  execFileSync(pythonCommand, [fixtureBuilderPath, scenario, fixtureRoot, version], {
    encoding: "utf8",
  });
  return fixtureRoot;
}

function runValidator(fixtureRoot: string, candidate: string) {
  return spawnSync(
    pythonCommand,
    [validatorPath, path.join(fixtureRoot, "artifact.zip"), candidate, version],
    { encoding: "utf8" },
  );
}
