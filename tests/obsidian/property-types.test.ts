import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
  parseStoredPropertyTypes,
  PropertyTypeRegistry,
} from "../../src/obsidian/property-types";

interface RegistryHarness {
  app: App;
  exists: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
}

function createHarness(options: {
  configDir?: string;
  content?: string;
  exists?: boolean;
} = {}): RegistryHarness {
  const exists = vi.fn(async () => options.exists ?? true);
  const read = vi.fn(async () => options.content ?? JSON.stringify({
    types: {
      aliases: "aliases",
      checkbox: "checkbox",
      created: "date",
      due: "datetime",
      people: "multitext",
      rating: "number",
      status: "text",
      tags: "tags",
    },
  }));
  const app = {
    vault: {
      adapter: {
        exists,
        read,
      },
      configDir: options.configDir ?? ".obsidian",
    },
  } as unknown as App;

  return { app, exists, read };
}

describe("PropertyTypeRegistry", () => {
  it("reads the configured Obsidian types file through the public adapter boundary", async () => {
    const harness = createHarness({ configDir: ".config/obsidian" });
    const registry = new PropertyTypeRegistry(harness.app);

    const result = await registry.refresh();

    expect(result).toEqual({ changed: true, status: "loaded" });
    expect(harness.exists).toHaveBeenCalledWith(".config/obsidian/types.json");
    expect(harness.read).toHaveBeenCalledWith(".config/obsidian/types.json");
    expect(registry.getType("status")).toBe("text");
    expect(registry.getType("people")).toBe("list");
    expect(registry.getType("rating")).toBe("number");
    expect(registry.getType("checkbox")).toBe("checkbox");
    expect(registry.getType("created")).toBe("date");
    expect(registry.getType("due")).toBe("datetime");
    expect(registry.getType("tags")).toBe("tags");
    expect(registry.getType("aliases")).toBe("list");
    expect(registry.getRevision()).toBe(1);
  });

  it("keeps Obsidian built-in property types when types.json is absent", async () => {
    const harness = createHarness({ exists: false });
    const registry = new PropertyTypeRegistry(harness.app);

    const result = await registry.refresh();

    expect(result).toEqual({ changed: false, status: "missing" });
    expect(harness.read).not.toHaveBeenCalled();
    expect(registry.getType("aliases")).toBe("list");
    expect(registry.getType("cssclasses")).toBe("list");
    expect(registry.getType("tags")).toBe("tags");
    expect(registry.getType("custom")).toBe("unknown");
    expect(registry.getRevision()).toBe(0);
  });

  it("maps unsupported stored type names to unknown without guessing from YAML values", () => {
    const types = parseStoredPropertyTypes(JSON.stringify({
      types: {
        custom: "future-type",
        legacyTime: "time",
        malformed: 42,
      },
    }));

    expect(types?.get("custom")).toBe("unknown");
    expect(types?.get("legacyTime")).toBe("datetime");
    expect(types?.has("malformed")).toBe(false);
  });

  it("keeps the last good snapshot when types.json becomes malformed", async () => {
    const harness = createHarness();
    const registry = new PropertyTypeRegistry(harness.app);

    await registry.refresh();
    harness.read.mockResolvedValueOnce("{ invalid");

    const result = await registry.refresh();

    expect(result).toEqual({ changed: false, status: "invalid" });
    expect(registry.getType("rating")).toBe("number");
    expect(registry.getRevision()).toBe(1);
  });

  it("keeps the last good snapshot on adapter read failures", async () => {
    const harness = createHarness();
    const registry = new PropertyTypeRegistry(harness.app);

    await registry.refresh();
    harness.read.mockRejectedValueOnce(new Error("disk unavailable"));

    const result = await registry.refresh();

    expect(result).toEqual({ changed: false, status: "read-error" });
    expect(registry.getType("status")).toBe("text");
    expect(registry.getRevision()).toBe(1);
  });

  it("returns to built-in defaults when a previously loaded types.json is removed", async () => {
    const harness = createHarness();
    const registry = new PropertyTypeRegistry(harness.app);

    await registry.refresh();
    harness.exists.mockResolvedValueOnce(false);

    const result = await registry.refresh();

    expect(result).toEqual({ changed: true, status: "missing" });
    expect(registry.getType("status")).toBe("unknown");
    expect(registry.getType("aliases")).toBe("list");
    expect(registry.getRevision()).toBe(2);
  });

  it("does not advance the revision when the effective type map is unchanged", async () => {
    const harness = createHarness();
    const registry = new PropertyTypeRegistry(harness.app);

    await registry.refresh();
    const result = await registry.refresh();

    expect(result).toEqual({ changed: false, status: "loaded" });
    expect(registry.getRevision()).toBe(1);
  });

  it("deduplicates concurrent refreshes", async () => {
    let resolveRead: ((content: string) => void) | null = null;
    const harness = createHarness();
    harness.read.mockImplementationOnce(() =>
      new Promise<string>((resolve) => {
        resolveRead = resolve;
      }),
    );
    const registry = new PropertyTypeRegistry(harness.app);

    const first = registry.refresh();
    const second = registry.refresh();

    expect(second).toBe(first);
    expect(harness.exists).toHaveBeenCalledTimes(1);

    resolveRead?.(JSON.stringify({ types: { status: "text" } }));
    await expect(first).resolves.toEqual({ changed: true, status: "loaded" });
    expect(harness.read).toHaveBeenCalledTimes(1);
  });

  it("normalizes surrounding whitespace only at the plugin boundary", async () => {
    const harness = createHarness({
      content: JSON.stringify({ types: { " status ": "text" } }),
    });
    const registry = new PropertyTypeRegistry(harness.app);

    await registry.refresh();

    expect(registry.getType(" status ")).toBe("text");
    expect(registry.getTypes([" status ", "missing"])).toEqual(
      new Map([
        [" status ", "text"],
        ["missing", "unknown"],
      ]),
    );
  });
});
