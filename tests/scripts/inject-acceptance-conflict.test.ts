import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The fixture generator is an executable JavaScript module.
import { createAcceptanceFixtures } from "../../scripts/create-acceptance-fixtures.mjs";
import { ACCEPTANCE_FIXTURES } from "../../scripts/acceptance-fixture-spec.mjs";
// @ts-expect-error The conflict injector is an executable JavaScript module.
import { injectAcceptanceConflict } from "../../scripts/inject-acceptance-conflict.mjs";
// @ts-expect-error The safety contract is implemented as an executable JavaScript module.
import { ACCEPTANCE_LOCK_NAME, ACCEPTANCE_MARKER_NAME } from "../../scripts/acceptance-vault-safety.mjs";

const execFileAsync = promisify(execFile);
const temporaryPaths: string[] = [];
const scriptPath = path.resolve("scripts/inject-acceptance-conflict.mjs");

async function createTemporaryDirectory(
  prefix = "property-order-acceptance-",
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

async function createAcceptanceVault(): Promise<string> {
  const vaultPath = await createTemporaryDirectory();
  await mkdir(path.join(vaultPath, ".obsidian"));
  await createAcceptanceFixtures(vaultPath, { initializeTypes: true });
  return vaultPath;
}

async function fileHash(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function runConflict(arguments_: string[]) {
  return execFileAsync(process.execPath, [scriptPath, ...arguments_]);
}

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((targetPath) =>
      rm(targetPath, { force: true, recursive: true }),
    ),
  );
});

describe("acceptance conflict injector", () => {
  it("changes the source list, preserves CRLF bytes, and updates the marker hash", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order CRLF.md");
    const originalHash = await fileHash(filePath);

    await runConflict([
      "--vault",
      vaultPath,
      "--file",
      filePath,
      "--expected-sha256",
      originalHash,
    ]);

    const content = await readFile(filePath, "utf8");
    expect(content).toContain(
      "values: [external-alpha, 'beta value', \"gamma:value\"]",
    );
    expect(new Set(content.match(/\r\n|\r|\n/g))).toEqual(new Set(["\r\n"]));
    const marker = JSON.parse(
      await readFile(path.join(vaultPath, ACCEPTANCE_MARKER_NAME), "utf8"),
    );
    expect(marker.generatedFiles["Property Order CRLF.md"]).toBe(
      createHash("sha256").update(content).digest("hex"),
    );

    await expect(
      runConflict([
        "--vault",
        vaultPath,
        "--file",
        filePath,
        "--expected-sha256",
        await fileHash(filePath),
      ]),
    ).rejects.toThrow(/Missing acceptance marker/);
  });

  it.each([
    ["source", "po_source: [external-alpha, beta]"],
    ["target", "po_target: [external-gamma]"],
    ["unrelated", "po_unrelated: external-conflict"],
    ["body", "Acceptance body marker changed externally."],
  ])("injects a %s conflict into the generated core fixture", async (mode, expected) => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order Drag Core.md");

    await runConflict([
      "--vault",
      vaultPath,
      "--file",
      filePath,
      "--mode",
      mode,
      "--expected-sha256",
      await fileHash(filePath),
    ]);

    expect(await readFile(filePath, "utf8")).toContain(expected);
  });

  it("requires an explicit expected hash", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(filePath);

    await expect(
      runConflict(["--vault", vaultPath, "--file", filePath]),
    ).rejects.toThrow(/--expected-sha256 is required/);
    await expect(readFile(filePath)).resolves.toEqual(original);
  });

  it("rejects a stale expected hash without changing the fixture", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(filePath);

    await expect(
      runConflict([
        "--vault",
        vaultPath,
        "--file",
        filePath,
        "--expected-sha256",
        "0".repeat(64),
      ]),
    ).rejects.toThrow(/SHA-256 changed/);
    await expect(readFile(filePath)).resolves.toEqual(original);
  });

  it("rejects invalid delays before editing", async () => {
    await expect(
      runConflict(["--delay-ms", "-1"]),
    ).rejects.toThrow(/Invalid --delay-ms value/);
  });

  it.each([0x80000000, Number.MAX_SAFE_INTEGER + 1, 1.5])(
    "rejects unsafe programmatic delay %s before resolving a Vault",
    async (delayMs) => {
      await expect(
        injectAcceptanceConflict({
          delayMs,
          expectedSha256: "0".repeat(64),
          filePath: "fixture.md",
          vaultPath: "vault",
        }),
      ).rejects.toThrow(/Invalid delay/);
    },
  );

  it("rejects an invalid mode before starting the requested delay", async () => {
    await expect(
      injectAcceptanceConflict({
        delayMs: 0x7fffffff,
        expectedSha256: "0".repeat(64),
        filePath: "fixture.md",
        mode: "toString",
        vaultPath: "vault",
      }),
    ).rejects.toThrow(/Invalid conflict mode/);
  });

  it("rejects unknown and duplicate CLI flags", async () => {
    await expect(runConflict(["--unknown", "value"])).rejects.toThrow(
      /Unknown conflict-injection argument/,
    );
    await expect(
      runConflict(["--delay-ms", "0", "--delay-ms", "1"]),
    ).rejects.toThrow(/Duplicate conflict-injection argument/);
    await expect(runConflict(["--delay-ms"])).rejects.toThrow(
      /Missing value for conflict-injection argument/,
    );
    await expect(runConflict(["--delay-ms", ""])).rejects.toThrow(
      /Missing value for conflict-injection argument/,
    );
  });

  it("refuses files outside the selected Vault and non-generated paths", async () => {
    const vaultPath = await createAcceptanceVault();
    const outsidePath = await createTemporaryDirectory();
    const outsideFile = path.join(outsidePath, "Property Order LF.md");
    const ordinaryNote = path.join(vaultPath, "ordinary.md");
    const nestedDirectory = path.join(vaultPath, "nested");
    const nestedFixture = path.join(nestedDirectory, "Property Order LF.md");
    const content = "values: [alpha, 'beta value', \"gamma:value\"]\n";
    await mkdir(nestedDirectory);
    await writeFile(outsideFile, content, "utf8");
    await writeFile(ordinaryNote, content, "utf8");
    await writeFile(nestedFixture, content, "utf8");
    const expectedHash = createHash("sha256").update(content).digest("hex");

    for (const [filePath, error] of [
      [outsideFile, /outside the selected vault/],
      [ordinaryNote, /Not a generated Property Order fixture/],
      [nestedFixture, /Not a generated Property Order fixture/],
    ] as const) {
      await expect(
        runConflict([
          "--vault",
          vaultPath,
          "--file",
          filePath,
          "--expected-sha256",
          expectedHash,
        ]),
      ).rejects.toThrow(error);
    }
  });

  it("rejects a generated-name symlink without touching its target", async () => {
    const vaultPath = await createAcceptanceVault();
    const externalPath = path.join(await createTemporaryDirectory(), "external.md");
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    const externalContent = "values: [alpha, 'beta value', \"gamma:value\"]\n";
    await writeFile(externalPath, externalContent, "utf8");
    await rm(fixturePath);

    try {
      await symlink(externalPath, fixturePath, "file");
    } catch (error) {
      if (isLinkPermissionError(error)) return;
      throw error;
    }

    await expect(
      runConflict([
        "--vault",
        vaultPath,
        "--file",
        fixturePath,
        "--expected-sha256",
        createHash("sha256").update(externalContent).digest("hex"),
      ]),
    ).rejects.toThrow(/not a regular file/);
    await expect(readFile(externalPath, "utf8")).resolves.toBe(externalContent);
  });

  it("rejects a linked Vault root", async () => {
    const realVaultPath = await createAcceptanceVault();
    const linkedVaultPath = path.join(
      tmpdir(),
      `property-order-acceptance-link-${randomUUID()}`,
    );
    temporaryPaths.push(linkedVaultPath);

    try {
      await symlink(
        realVaultPath,
        linkedVaultPath,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (isLinkPermissionError(error)) return;
      throw error;
    }

    const fixturePath = path.join(linkedVaultPath, "Property Order LF.md");
    await expect(
      runConflict([
        "--vault",
        linkedVaultPath,
        "--file",
        fixturePath,
        "--expected-sha256",
        await fileHash(path.join(realVaultPath, "Property Order LF.md")),
      ]),
    ).rejects.toThrow(/Not an isolated Property Order acceptance Vault/);
  });

  it("rejects a linked .obsidian directory without touching a fixture", async () => {
    const vaultPath = await createAcceptanceVault();
    const externalObsidianPath = path.join(
      await createTemporaryDirectory(),
      "external-obsidian",
    );
    const fixturePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(fixturePath);
    await mkdir(externalObsidianPath);
    await writeFile(path.join(externalObsidianPath, "sentinel"), "unchanged\n", "utf8");
    await rm(path.join(vaultPath, ".obsidian"), { recursive: true });

    try {
      await symlink(
        externalObsidianPath,
        path.join(vaultPath, ".obsidian"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (isLinkPermissionError(error)) return;
      throw error;
    }

    await expect(
      runConflict([
        "--vault",
        vaultPath,
        "--file",
        fixturePath,
        "--expected-sha256",
        createHash("sha256").update(original).digest("hex"),
      ]),
    ).rejects.toThrow(/Not an isolated Property Order acceptance Vault/);
    await expect(readFile(fixturePath)).resolves.toEqual(original);
  });

  it("allows a forced reset after a tracked conflict", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order Drag Core.md");

    await runConflict([
      "--vault",
      vaultPath,
      "--file",
      filePath,
      "--mode",
      "source",
      "--expected-sha256",
      await fileHash(filePath),
    ]);
    await createAcceptanceFixtures(vaultPath, { force: true });

    expect(await readFile(filePath, "utf8")).toBe(
      ACCEPTANCE_FIXTURES.find(({ fileName }) => fileName === "Property Order Drag Core.md")
        ?.content,
    );
  });

  it("refuses conflict injection while the Vault lock exists", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(filePath);
    const lockPath = path.join(vaultPath, ACCEPTANCE_LOCK_NAME);
    await writeFile(lockPath, "another acceptance process owns this Vault\n", "utf8");

    await expect(
      runConflict([
        "--vault",
        vaultPath,
        "--file",
        filePath,
        "--expected-sha256",
        await fileHash(filePath),
      ]),
    ).rejects.toThrow(/locked.*stale lock/i);

    await expect(readFile(filePath)).resolves.toEqual(original);
    await expect(readFile(lockPath, "utf8")).resolves.toBe(
      "another acceptance process owns this Vault\n",
    );
  });

  it("preserves a write that lands immediately before conflict replacement", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order LF.md");
    const markerPath = path.join(vaultPath, ACCEPTANCE_MARKER_NAME);
    const originalMarker = await readFile(markerPath);

    await expect(
      injectAcceptanceConflict({
        beforeReplace: async () => {
          await writeFile(filePath, "pre-replace conflict writer must survive\n", "utf8");
        },
        expectedSha256: await fileHash(filePath),
        filePath,
        mode: "source",
        vaultPath,
      }),
    ).rejects.toThrow(/preserved copy/);

    await expect(readFile(filePath, "utf8")).resolves.toBe(
      "pre-replace conflict writer must survive\n",
    );
    await expect(readFile(markerPath)).resolves.toEqual(originalMarker);
  });

  it("retains the rollback backup instead of overwriting a pre-rollback write", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(filePath, "utf8");
    const markerPath = path.join(vaultPath, ACCEPTANCE_MARKER_NAME);
    const originalMarker = await readFile(markerPath);
    let thrownError: unknown;

    try {
      await injectAcceptanceConflict({
        beforeRollback: async () => {
          await writeFile(filePath, "racing conflict writer must survive\n", "utf8");
        },
        expectedSha256: await fileHash(filePath),
        filePath,
        mode: "source",
        updateMarker: async () => {
          throw new Error("injected marker failure");
        },
        vaultPath,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    expect(message).toMatch(/Retained rollback backup/);
    const backupPath = message.match(
      /Retained rollback backup: (.+?\.rollback)(?:\. |, |$)/,
    )?.[1];
    expect(backupPath).toBeDefined();
    await expect(readFile(filePath, "utf8")).resolves.toBe(
      "racing conflict writer must survive\n",
    );
    await expect(readFile(backupPath!, "utf8")).resolves.toBe(original);
    await expect(readFile(markerPath)).resolves.toEqual(originalMarker);
  });

  it("restores the original fixture when marker commit fails without a race", async () => {
    const vaultPath = await createAcceptanceVault();
    const filePath = path.join(vaultPath, "Property Order LF.md");
    const original = await readFile(filePath);
    const markerPath = path.join(vaultPath, ACCEPTANCE_MARKER_NAME);
    const originalMarker = await readFile(markerPath);

    await expect(
      injectAcceptanceConflict({
        expectedSha256: await fileHash(filePath),
        filePath,
        mode: "source",
        updateMarker: async () => {
          throw new Error("injected marker failure");
        },
        vaultPath,
      }),
    ).rejects.toThrow(/injected marker failure/);

    await expect(readFile(filePath)).resolves.toEqual(original);
    await expect(readFile(markerPath)).resolves.toEqual(originalMarker);
    await expect(readdir(vaultPath)).resolves.not.toEqual(
      expect.arrayContaining([expect.stringMatching(/\.rollback(?:\.restore-.*)?$/)]),
    );
  });
});

function isLinkPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EACCES" || code === "EPERM";
}
