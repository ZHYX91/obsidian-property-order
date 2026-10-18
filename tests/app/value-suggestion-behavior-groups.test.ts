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
      getCustomOrderKeys: () => ["manual_only"],
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
      getCustomOrderKeys: () => [],
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

  it("offers newly configured presets after their property leaves a behavior group", () => {
    let customOrderKeys: string[] = [];
    let assignments: PropertyValueBehaviorAssignment[] = [];
    const input = document.createElement("input");
    const options = {
      getCustomOrderKeys: () => customOrderKeys,
      getAlreadyHereLabel: () => "Already here",
      getAssignments: () => assignments,
      getAvailableKeys: () => [],
      getBehaviorLabel: (behavior: ValueSuggestionBehavior) => behavior,
      getFollowDefaultLabel: () => "Default",
      onSelect: async () => undefined,
      targetBehavior: "name" as const,
    };
    const suggest = new PropertyBehaviorSuggest({} as App, input, options) as unknown as {
      getSuggestions(query: string): string[];
    };
    expect(suggest.getSuggestions("")).toEqual([]);
    assignments = [{ behavior: "custom", propertyKey: "new_custom" }];
    expect(suggest.getSuggestions("")).toEqual(["new_custom"]);
    customOrderKeys = ["new_custom"];
    assignments = [];

    expect(suggest.getSuggestions("")).toEqual(["new_custom"]);
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

  it("renders only configured cards, preserves add controls, and confirms cross-card moves", async () => {
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
    const confirm = vi.fn(() => true);
    Reflect.set(window, "confirm", confirm);
    const container = document.createElement("div");
    document.body.appendChild(container);

    const lifecycle = renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      getCustomOrderKeys: () => ["manual_custom"],
      displayOrder: "name",
      getAssignments: () => assignments,
      onAssignmentsChange,
      onDisplayOrderChange,
      t: (key) => key,
    });

    const groups = Array.from(
      container.querySelectorAll<HTMLElement>(".property-order-value-behavior-group"),
    );
    expect(groups).toHaveLength(3);
    expect(dropdowns).toHaveLength(1);
    expect(dropdowns[0]?.value).toBe("name");

    dropdowns[0]?.onChange?.("invalid");
    expect(onDisplayOrderChange).not.toHaveBeenCalled();
    dropdowns[0]?.onChange?.("recent");
    await Promise.resolve();
    expect(onDisplayOrderChange).toHaveBeenCalledWith("recent");
    expect(rerender).not.toHaveBeenCalled();

    const nameGroup = groups.find((group) =>
      group.dataset.behavior === "name",
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

    container.scrollTop = 450;
    nameInput.focus();
    nameInput.value = "project";
    commitButton.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(assignments).toContainEqual({ behavior: "name", propertyKey: "project" });
    expect(container.scrollTop).toBe(450);
    expect(document.activeElement).toBe(nameInput);
    expect(nameGroup?.querySelector("input")).toBe(nameInput);

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
    expect(close).toHaveBeenCalledTimes(3);
  });

  it("does not move an assigned key when confirmation is cancelled", async () => {
    let assignments: PropertyValueBehaviorAssignment[] = [
      { behavior: "none", propertyKey: "id" },
      { behavior: "name", propertyKey: "status" },
    ];
    const onAssignmentsChange = vi.fn(async (next: PropertyValueBehaviorAssignment[]) => {
      assignments = next;
    });
    Reflect.set(window, "confirm", vi.fn(() => false));
    const container = document.createElement("div");

    renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      getCustomOrderKeys: () => [],
      displayOrder: "recent",
      getAssignments: () => assignments,
      onAssignmentsChange,
      onDisplayOrderChange: () => Promise.resolve(),
      t: (key) => key,
    });

    const nameGroup = Array.from(
      container.querySelectorAll<HTMLElement>(".property-order-value-behavior-group"),
    ).find((group) =>
      group.dataset.behavior === "name",
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
    expect(assignments).toEqual([{ behavior: "none", propertyKey: "id" }, { behavior: "name", propertyKey: "status" }]);
  });

  it("adds cards on demand and merges all keys when changing to an existing behavior", async () => {
    let assignments: PropertyValueBehaviorAssignment[] = [
      { behavior: "frequency", propertyKey: "priority" },
      { behavior: "name", propertyKey: "status" },
      { behavior: "name", propertyKey: "project" },
    ];
    const container = document.body.createDiv();
    renderValueSuggestionBehaviorGroups({
      app: createApp(), containerEl: container, getCustomOrderKeys: () => [], displayOrder: "name",
      getAssignments: () => assignments,
      onAssignmentsChange: async (next) => { assignments = next; },
      onDisplayOrderChange: async () => undefined, t: (key) => key,
    });
    const name = container.querySelector<HTMLElement>('[data-behavior="name"]')!;
    const frequency = container.querySelector<HTMLElement>('[data-behavior="frequency"]')!;
    const select = name.querySelector("select")!;
    select.value = "frequency";
    select.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    expect(container.querySelector('[data-behavior="name"]')).toBeNull();
    expect(container.querySelector('[data-behavior="frequency"]')).toBe(frequency);
    expect(assignments).toHaveLength(3);
    expect(assignments.every((assignment) => assignment.behavior === "frequency")).toBe(true);
    const add = container.lastElementChild!;
    const choice = add.querySelector("select")!;
    choice.value = "custom";
    add.querySelector<HTMLButtonElement>("button")!.click();
    expect(container.querySelector('[data-behavior="custom"]')).not.toBeNull();
    expect(assignments).toHaveLength(3);
  });

  it("keeps a later rule draft and focus when an earlier card save finishes", async () => {
    let assignments: PropertyValueBehaviorAssignment[] = [
      { behavior: "name", propertyKey: "status" },
    ];
    let finishSave: (() => void) | undefined;
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const container = document.body.createDiv();
    const otherInput = document.body.createEl("input");
    const lifecycle = renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      getCustomOrderKeys: () => [],
      displayOrder: "name",
      getAssignments: () => assignments,
      onAssignmentsChange: async (next) => {
        assignments = next;
        await pendingSave;
      },
      onDisplayOrderChange: async () => undefined,
      t: (key) => key,
    });
    const input = container.querySelector<HTMLInputElement>(
      '[data-behavior="name"] .property-order-value-behavior-input',
    );
    const addButton = container.querySelector<HTMLButtonElement>(
      '[data-behavior="name"] .property-order-value-behavior-add button',
    );
    if (input == null || addButton == null) throw new Error("Expected rule controls.");
    input.value = "project";
    addButton.click();
    input.value = "next-property";
    otherInput.focus();

    finishSave?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(input.value).toBe("next-property");
    expect(document.activeElement).toBe(otherInput);
    expect(assignments).toContainEqual({ behavior: "name", propertyKey: "project" });
    lifecycle.close();
  });

  it("places keys moved by a whole card before older members in recently added order", async () => {
    let assignments: PropertyValueBehaviorAssignment[] = [
      { behavior: "name", propertyKey: "status" },
      { behavior: "frequency", propertyKey: "priority" },
    ];
    const container = document.body.createDiv();
    const lifecycle = renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      getCustomOrderKeys: () => [],
      displayOrder: "recent",
      getAssignments: () => assignments,
      onAssignmentsChange: async (next) => { assignments = next; },
      onDisplayOrderChange: async () => undefined,
      t: (key) => key,
    });
    const select = container.querySelector<HTMLSelectElement>('[data-behavior="name"] select');
    if (select == null) throw new Error("Expected the card behavior selector.");
    select.value = "frequency";
    select.dispatchEvent(new Event("change"));
    await Promise.resolve();

    expect(Array.from(container.querySelectorAll<HTMLElement>(
      '[data-behavior="frequency"] .property-order-value-behavior-chip > span',
    ), (element) => element.textContent)).toEqual(["status", "priority"]);
    lifecycle.close();
  });

  it("keeps a custom draft when a display-order save finishes", async () => {
    let finishSave: (() => void) | undefined;
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const container = document.body.createDiv();
    const lifecycle = renderValueSuggestionBehaviorGroups({
      app: createApp(),
      containerEl: container,
      getCustomOrderKeys: () => [],
      displayOrder: "name",
      getAssignments: () => [{ behavior: "custom", propertyKey: "status" }],
      onAssignmentsChange: async () => undefined,
      onDisplayOrderChange: () => pendingSave,
      renderCustomEditor: (target) => {
        target.replaceChildren();
        const input = target.createEl("input");
        input.className = "custom-draft";
      },
      t: (key) => key,
    });
    dropdowns[0]?.onChange?.("recent");
    const draft = container.querySelector<HTMLInputElement>(".custom-draft");
    if (draft == null) throw new Error("Expected a custom draft input.");
    draft.value = "next preset";
    draft.focus();
    finishSave?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector(".custom-draft")).toBe(draft);
    expect(draft.value).toBe("next preset");
    expect(document.activeElement).toBe(draft);
    lifecycle.close();
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
