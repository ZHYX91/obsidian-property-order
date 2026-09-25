// @vitest-environment happy-dom

import { Setting, type App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PropertyBehaviorSuggest } from "../../src/app/property-behavior-suggest";
import {
  getBehaviorLabel,
  renderValueSuggestionBehaviorGroups,
} from "../../src/app/value-suggestion-behavior-groups";
import type {
  PropertyValueBehaviorAssignment,
  ValueSuggestionBehavior,
} from "../../src/shared/types";

interface DropdownHarness {
  onChange?: (value: string) => void;
  value?: string;
}

const dropdowns: DropdownHarness[] = [];

beforeEach(() => {
  document.body.replaceChildren();
  dropdowns.length = 0;

  Reflect.set(Setting.prototype, "setName", function (this: Setting) {
    return this;
  });
  Reflect.set(Setting.prototype, "addDropdown", function (
    this: Setting,
    configure: (dropdown: {
      addOption(value: string, label: string): unknown;
      onChange(callback: (value: string) => void): unknown;
      setValue(value: string): unknown;
    }) => void,
  ) {
    const harness: DropdownHarness = {};
    const dropdown = {
      addOption: () => dropdown,
      onChange(callback: (value: string) => void) {
        harness.onChange = callback;
        return dropdown;
      },
      setValue(value: string) {
        harness.value = value;
        return dropdown;
      },
    };
    configure(dropdown);
    dropdowns.push(harness);
    return this;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PropertyBehaviorSuggest", () => {
  function createSuggest(
    assignments: PropertyValueBehaviorAssignment[],
    targetBehavior: ValueSuggestionBehavior = "name",
  ): {
    input: HTMLInputElement;
    onSelect: ReturnType<typeof vi.fn>;
    suggest: PropertyBehaviorSuggest;
  } {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const onSelect = vi.fn(() => Promise.resolve());
    const suggest = new PropertyBehaviorSuggest({} as App, input, {
      customOrderKeys: ["manual_only"],
      getAlreadyHereLabel: () => "Already here",
      getAssignments: () => assignments,
      getAvailableKeys: () => ["status", "priority", "项目"],
      getBehaviorLabel: (behavior) => `behavior:${behavior}`,
      getFollowDefaultLabel: () => "Follows default",
      onSelect,
      targetBehavior,
    });
    return { input, onSelect, suggest };
  }

  it("merges, filters, and annotates keys from Vault and configured state", () => {
    const { suggest } = createSuggest([
      { behavior: "name", propertyKey: "status" },
      { behavior: "none", propertyKey: "hidden_id" },
    ]);
    const testable = suggest as unknown as {
      getSuggestions(query: string): string[];
    };

    expect(testable.getSuggestions("")).toEqual([
      "hidden_id",
      "manual_only",
      "priority",
      "status",
      "项目",
    ]);
    expect(testable.getSuggestions("pri")).toEqual(["priority"]);

    const current = document.createElement("div");
    suggest.renderSuggestion("status", current);
    expect(current.textContent).toContain("Already here");
    expect(current.classList.contains("is-disabled")).toBe(true);
    expect(current.getAttribute("aria-disabled")).toBe("true");

    const other = document.createElement("div");
    suggest.renderSuggestion("hidden_id", other);
    expect(other.textContent).toContain("behavior:none");

    const fallback = document.createElement("div");
    suggest.renderSuggestion("priority", fallback);
    expect(fallback.textContent).toContain("Follows default");
  });

  it("ignores a selection already in the target group and commits another key", async () => {
    const { input, onSelect, suggest } = createSuggest([
      { behavior: "name", propertyKey: "status" },
    ]);
    const close = vi.spyOn(suggest, "close");

    input.value = "status";
    suggest.selectSuggestion("status");
    await Promise.resolve();
    expect(input.value).toBe("");
    expect(close).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();

    input.value = "priority";
    suggest.selectSuggestion("priority");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("priority");
  });

  it("reports asynchronous selection failures without throwing", async () => {
    const input = document.createElement("input");
    const failure = new Error("save failed");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const suggest = new PropertyBehaviorSuggest({} as App, input, {
      customOrderKeys: [],
      getAlreadyHereLabel: () => "Already here",
      getAssignments: () => [],
      getAvailableKeys: () => [],
      getBehaviorLabel: (behavior) => behavior,
      getFollowDefaultLabel: () => "Default",
      onSelect: () => Promise.reject(failure),
      targetBehavior: "none",
    });

    suggest.selectSuggestion("id");
    await Promise.resolve();
    await Promise.resolve();

    expect(error).toHaveBeenCalledWith(
      "Property Order: failed to update property value behavior",
      failure,
    );
  });
});

describe("renderValueSuggestionBehaviorGroups", () => {
  function createApp(): App {
    const files = [{ path: "one.md" }, { path: "two.md" }];
    return {
      metadataCache: {
        getFileCache: vi.fn((file: { path: string }) => ({
          frontmatter:
            file.path === "one.md"
              ? { status: "draft", priority: "high" }
              : { status: "done", project: "alpha" },
        })),
      },
      vault: {
        getMarkdownFiles: vi.fn(() => files),
      },
    } as unknown as App;
  }

  it("renders six groups, removes chips, adds keys, and confirms cross-group moves", async () => {
    let assignments: PropertyValueBehaviorAssignment[] = [
      { behavior: "name", propertyKey: "status" },
      { behavior: "none", propertyKey: "id" },
      { behavior: "custom", propertyKey: "priority" },
    ];
    const onAssignmentsChange = vi.fn(async (next: PropertyValueBehaviorAssignment[]) => {
      assignments = next;
    });
    const onDisplayOrderChange = vi.fn(() => Promise.resolve());
    const rerender = vi.fn();
    const close = vi.spyOn(PropertyBehaviorSuggest.prototype, "close");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const container = document.createElement("div");
    document.body.appendChild(container);

    const lifecycle = renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      customOrderKeys: ["manual_custom"],
      displayOrder: "name",
      getAssignments: () => assignments,
      onAssignmentsChange,
      onDisplayOrderChange,
      rerender,
      t: (key) => key,
    });

    const groups = Array.from(
      container.querySelectorAll<HTMLElement>(".property-order-value-behavior-group"),
    );
    expect(groups).toHaveLength(6);
    expect(dropdowns).toHaveLength(1);
    expect(dropdowns[0]?.value).toBe("name");

    dropdowns[0]?.onChange?.("invalid");
    expect(onDisplayOrderChange).not.toHaveBeenCalled();
    dropdowns[0]?.onChange?.("recent");
    await Promise.resolve();
    expect(onDisplayOrderChange).toHaveBeenCalledWith("recent");
    expect(rerender).toHaveBeenCalled();

    const nameGroup = groups.find((group) =>
      group.querySelector("h4")?.textContent?.includes("sortMode.nameOption"),
    );
    expect(nameGroup).toBeDefined();

    const removeButton = nameGroup?.querySelector<HTMLButtonElement>(
      ".property-order-value-behavior-chip-remove",
    );
    removeButton?.click();
    await Promise.resolve();
    expect(assignments.some((item) => item.propertyKey === "status")).toBe(false);

    const nameInput = nameGroup?.querySelector<HTMLInputElement>(
      ".property-order-value-behavior-input",
    );
    const addButton = nameGroup?.querySelectorAll<HTMLButtonElement>("button");
    const commitButton = addButton?.[addButton.length - 1];

    if (nameInput == null || commitButton == null) {
      throw new Error("Expected name-group add controls.");
    }

    nameInput.value = "project";
    commitButton.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(assignments).toContainEqual({ behavior: "name", propertyKey: "project" });

    nameInput.value = "id";
    commitButton.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(confirm).toHaveBeenCalled();
    expect(assignments).toContainEqual({ behavior: "name", propertyKey: "id" });
    expect(assignments).not.toContainEqual({ behavior: "none", propertyKey: "id" });

    const changeCalls = onAssignmentsChange.mock.calls.length;
    nameInput.value = "id";
    nameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(onAssignmentsChange).toHaveBeenCalledTimes(changeCalls);

    lifecycle.close();
    expect(close).toHaveBeenCalledTimes(6);
  });

  it("does not move an assigned key when confirmation is cancelled", async () => {
    let assignments: PropertyValueBehaviorAssignment[] = [
      { behavior: "none", propertyKey: "id" },
    ];
    const onAssignmentsChange = vi.fn(async (next: PropertyValueBehaviorAssignment[]) => {
      assignments = next;
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const container = document.createElement("div");

    renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      customOrderKeys: [],
      displayOrder: "recent",
      getAssignments: () => assignments,
      onAssignmentsChange,
      onDisplayOrderChange: () => Promise.resolve(),
      rerender: vi.fn(),
      t: (key) => key,
    });

    const nameGroup = Array.from(
      container.querySelectorAll<HTMLElement>(".property-order-value-behavior-group"),
    ).find((group) =>
      group.querySelector("h4")?.textContent?.includes("sortMode.nameOption"),
    );
    const input = nameGroup?.querySelector<HTMLInputElement>(
      ".property-order-value-behavior-input",
    );
    const buttons = nameGroup?.querySelectorAll<HTMLButtonElement>("button");

    if (input == null || buttons == null || buttons.length === 0) {
      throw new Error("Expected add controls.");
    }

    input.value = "id";
    buttons[buttons.length - 1]?.click();
    await Promise.resolve();

    expect(onAssignmentsChange).not.toHaveBeenCalled();
    expect(assignments).toEqual([{ behavior: "none", propertyKey: "id" }]);
  });

  it("maps every behavior to a localized label", () => {
    const translate = (key: string) => key;
    expect(
      (["name", "frequency", "note-count", "native", "none", "custom"] as const)
        .map((behavior) => getBehaviorLabel(translate as never, behavior)),
    ).toEqual([
      "settings.valueSuggestions.sortMode.nameOption",
      "settings.valueSuggestions.behavior.frequency",
      "settings.valueSuggestions.sortMode.usage",
      "settings.valueSuggestions.sortMode.native",
      "settings.valueSuggestions.sortMode.none",
      "settings.valueSuggestions.behavior.custom",
    ]);
  });
});
