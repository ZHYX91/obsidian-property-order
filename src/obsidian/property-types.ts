import { normalizePath, type App } from "obsidian";

export type PropertyType =
  | "text"
  | "list"
  | "number"
  | "checkbox"
  | "date"
  | "datetime"
  | "tags"
  | "unknown";

export type PropertyTypeRefreshStatus =
  | "loaded"
  | "missing"
  | "invalid"
  | "read-error";

export interface PropertyTypeRefreshResult {
  changed: boolean;
  status: PropertyTypeRefreshStatus;
}

type PropertyTypeApp = Pick<App, "vault">;

const PROPERTY_TYPES_FILE_NAME = "types.json";

const OBSIDIAN_TYPE_MAP: Readonly<Record<string, PropertyType>> = {
  aliases: "list",
  checkbox: "checkbox",
  date: "date",
  datetime: "datetime",
  multitext: "list",
  number: "number",
  tags: "tags",
  text: "text",
  time: "datetime",
};

const BUILTIN_PROPERTY_TYPES = [
  ["aliases", "list"],
  ["cssclasses", "list"],
  ["tags", "tags"],
] as const satisfies ReadonlyArray<readonly [string, PropertyType]>;

export class PropertyTypeRegistry {
  private readonly app: PropertyTypeApp;
  private refreshTask: Promise<PropertyTypeRefreshResult> | null = null;
  private revision = 0;
  private types = createBuiltinPropertyTypes();

  constructor(app: PropertyTypeApp) {
    this.app = app;
  }

  getRevision(): number {
    return this.revision;
  }

  getType(rawKey: string): PropertyType {
    const key = normalizePropertyKey(rawKey);
    return key.length === 0 ? "unknown" : (this.types.get(key) ?? "unknown");
  }

  getTypes(keys: readonly string[]): ReadonlyMap<string, PropertyType> {
    return new Map(
      keys.map((key) => [key, this.getType(key)] as const),
    );
  }

  refresh(): Promise<PropertyTypeRefreshResult> {
    if (this.refreshTask != null) {
      return this.refreshTask;
    }

    const task = this.refreshNow();
    this.refreshTask = task;

    void task.finally(() => {
      if (this.refreshTask === task) {
        this.refreshTask = null;
      }
    });

    return task;
  }

  private async refreshNow(): Promise<PropertyTypeRefreshResult> {
    const path = normalizePath(
      `${this.app.vault.configDir}/${PROPERTY_TYPES_FILE_NAME}`,
    );
    let exists: boolean;

    try {
      exists = await this.app.vault.adapter.exists(path);
    } catch {
      return { changed: false, status: "read-error" };
    }

    if (!exists) {
      return this.replaceTypes(createBuiltinPropertyTypes(), "missing");
    }

    let content: string;

    try {
      content = await this.app.vault.adapter.read(path);
    } catch {
      return { changed: false, status: "read-error" };
    }

    const parsedTypes = parseStoredPropertyTypes(content);

    if (parsedTypes == null) {
      return { changed: false, status: "invalid" };
    }

    return this.replaceTypes(parsedTypes, "loaded");
  }

  private replaceTypes(
    nextTypes: Map<string, PropertyType>,
    status: Extract<PropertyTypeRefreshStatus, "loaded" | "missing">,
  ): PropertyTypeRefreshResult {
    const changed = !arePropertyTypeMapsEqual(this.types, nextTypes);

    if (changed) {
      this.types = nextTypes;
      this.revision += 1;
    }

    return { changed, status };
  }
}

export function parseStoredPropertyTypes(
  content: string,
): Map<string, PropertyType> | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isRecord(parsed.types)) {
    return null;
  }

  const types = createBuiltinPropertyTypes();

  for (const [rawKey, rawType] of Object.entries(parsed.types)) {
    const key = normalizePropertyKey(rawKey);

    if (key.length === 0 || typeof rawType !== "string") {
      continue;
    }

    types.set(key, OBSIDIAN_TYPE_MAP[rawType] ?? "unknown");
  }

  return types;
}

function createBuiltinPropertyTypes(): Map<string, PropertyType> {
  return new Map(BUILTIN_PROPERTY_TYPES);
}

function normalizePropertyKey(value: string): string {
  return value.trim();
}

function arePropertyTypeMapsEqual(
  left: ReadonlyMap<string, PropertyType>,
  right: ReadonlyMap<string, PropertyType>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false;
    }
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
