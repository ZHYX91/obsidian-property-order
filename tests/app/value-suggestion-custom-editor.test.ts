// @vitest-environment happy-dom

import { Setting, type App, type TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderCustomValueSuggestionEditor } from "../../src/app/value-suggestion-custom-editor";
import type {
  PropertyValueBehaviorAssignment,
  PropertyValueCustomOrder,
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

function createApp(): App {
  const files = [
    { path: "one.md" },
    { path: "two.md" },
  ] as TFile[];
  const frontmatterByPath = new Map<string, Record<string, unknown>>([
    ["one.md", { status: ["done", "draft", "archived"], priority: "high" }],
    ["two.md", { status: ["done", "later"], priority: "low" }],
  ]);

  return {
    metadataCache: {
      getFileCache: vi.fn((file: TFile) => ({
        frontmatter: frontmatterByPath.get(file.path) ?? {},
      })),
    },
    vault: {
      getMarkdownFiles: vi.fn(() => files),
    },
  } as unknown as App;
}

function customAssignments(): PropertyValueBehaviorAssignment[] {
  return [
    { behavior: "custom", propertyKey: "status" },
    { behavior: "custom", propertyKey: "priority" },
  ];
}

function customOrders(): PropertyValueCustomOrder[] {
  return [
    {
      bottomValues: ["archived", "deferred"],
      middleSortMode: "native",
      middleValues: ["manual"],
      pinnedValues: ["draft", "planned"],
      propertyKey: "status",
    },
    {
      bottomValues: [],
      middleSortMode: "name",
      middleValues: [],
      pinnedValues: ["urgent"],
      propertyKey: "priority",
    },
  ];
}

async function flushPersist(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("renderCustomValueSuggestionEditor", () => {
  it("shows the empty state when no property uses custom candidates", () => {
    const container = document.createElement("div");

    const lifecycle = renderCustomValueSuggestionEditor({
      app: createApp(),
      assignments: [],
      containerEl: container,
      customOrders: [],
      displayOrder: "name",
      getFrequency: () => [],
      onCustomOrdersChange: vi.fn(() => Promise.resolve()),
      rerender: vi.fn(),
      selectedPropertyKey: null,
      t: (key) => key,
    });

    expect(lifecycle.selectedPropertyKey).toBeNull();
    expect(container.textContent).toContain("settings.valueSuggestions.custom.empty");
    expect(container.querySelector(".property-order-custom-value-layout")).toBeNull();
  });

  it("renders the selected key with pinned, normal, and bottom candidates", () => {
    const container = document.createElement("div");
    const rerender = vi.fn();

    const lifecycle = renderCustomValueSuggestionEditor({
      app: createApp(),
      assignments: customAssignments(),
      containerEl: container,
      customOrders: customOrders(),
      displayOrder: "name",
      getFrequency: (propertyKey) =>
        propertyKey === "status"
          ? [{ value: "done", count: 3 }, { value: "draft", count: 1 }]
          : [],
      onCustomOrdersChange: vi.fn(() => Promise.resolve()),
      rerender,
      selectedPropertyKey: "STATUS",
      t: (key) => key,
    });

    expect(lifecycle.selectedPropertyKey).toBe("status");
    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(".property-order-custom-value-key"),
        (button) => button.textContent,
      ),
    ).toEqual(["priority", "status"]);
    expect(
      container.querySelector(".property-order-custom-value-key.is-active")?.textContent,
    ).toBe("status");

    const sections = container.querySelectorAll(".property-order-custom-value-section");
    expect(sections).toHaveLength(3);
    expect(
      Array.from(
        container.querySelectorAll(".property-order-custom-value-section-title"),
        (element) => element.textContent,
      ),
    ).toEqual([
      "settings.valueSuggestions.custom.pinned",
      "settings.valueSuggestions.custom.middle",
      "settings.valueSuggestions.custom.bottom",
    ]);
    expect(dropdowns[0]?.value).toBe("native");

    const priorityButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".property-order-custom-value-key"),
    ).find((button) => button.textContent === "priority");
    priorityButton?.click();
    expect(rerender).toHaveBeenCalledWith("priority");
  });

  it("persists button moves, preset removal, manual additions, and middle sort changes", async () => {
    const container = document.createElement("div");
    const changes: PropertyValueCustomOrder[][] = [];
    const rerender = vi.fn();
    const onCustomOrdersChange = vi.fn(async (orders: PropertyValueCustomOrder[]) => {
      changes.push(orders);
    });

    renderCustomValueSuggestionEditor({
      app: createApp(),
      assignments: customAssignments(),
      containerEl: container,
      customOrders: customOrders(),
      displayOrder: "recent",
      getFrequency: () => [{ value: "done", count: 4 }],
      onCustomOrdersChange,
      rerender,
      selectedPropertyKey: "status",
      t: (key) => key,
    });

    const clickAction = async (label: string): Promise<void> => {
      const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((candidate) => candidate.getAttribute("aria-label") === label);
      if (button == null) {
        throw new Error(`Missing action: ${label}`);
      }
      button.click();
      await flushPersist();
    };

    await clickAction("settings.valueSuggestions.custom.moveDown: draft");
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.pinnedValues)
      .toEqual(["planned", "draft"]);

    await clickAction("settings.valueSuggestions.custom.toMiddle: planned");
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.middleValues)
      .toContain("planned");

    await clickAction("settings.valueSuggestions.custom.toPinned: done");
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.pinnedValues)
      .toContain("done");

    await clickAction("settings.valueSuggestions.custom.toBottom: manual");
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.bottomValues)
      .toContain("manual");

    await clickAction("settings.valueSuggestions.custom.removePreset: manual");
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.middleValues)
      .not.toContain("manual");

    const pinnedInput = container.querySelector<HTMLInputElement>(
      ".property-order-custom-value-section.is-pinned .property-order-custom-value-add input",
    );
    const pinnedAdd = container.querySelector<HTMLButtonElement>(
      ".property-order-custom-value-section.is-pinned .property-order-custom-value-add button",
    );
    if (pinnedInput == null || pinnedAdd == null) {
      throw new Error("Missing pinned add controls.");
    }

    pinnedInput.value = "";
    pinnedAdd.click();
    expect(onCustomOrdersChange).toHaveBeenCalledTimes(5);

    pinnedInput.value = "new-top";
    pinnedAdd.click();
    await flushPersist();
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.pinnedValues)
      .toContain("new-top");

    const bottomInput = container.querySelector<HTMLInputElement>(
      ".property-order-custom-value-section.is-bottom .property-order-custom-value-add input",
    );
    if (bottomInput == null) {
      throw new Error("Missing bottom add input.");
    }
    bottomInput.value = "new-bottom";
    bottomInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    }));
    await flushPersist();
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.bottomValues)
      .toContain("new-bottom");

    const beforeSort = onCustomOrdersChange.mock.calls.length;
    dropdowns[0]?.onChange?.("invalid");
    expect(onCustomOrdersChange).toHaveBeenCalledTimes(beforeSort);
    dropdowns[0]?.onChange?.("frequency");
    await flushPersist();
    expect(changes[changes.length - 1]?.find((order) => order.propertyKey === "status")?.middleSortMode)
      .toBe("frequency");
    expect(rerender).toHaveBeenCalledWith("status");
  });

  it("supports drag moves between sections and clears the drag state", async () => {
    const container = document.createElement("div");
    const onCustomOrdersChange = vi.fn(() => Promise.resolve());

    renderCustomValueSuggestionEditor({
      app: createApp(),
      assignments: customAssignments(),
      containerEl: container,
      customOrders: customOrders(),
      displayOrder: "name",
      getFrequency: () => [],
      onCustomOrdersChange,
      rerender: vi.fn(),
      selectedPropertyKey: "status",
      t: (key) => key,
    });

    const plannedRow = Array.from(
      container.querySelectorAll<HTMLElement>(".property-order-custom-value-item"),
    ).find((row) => row.querySelector(".property-order-custom-value-label")?.textContent === "planned");
    const bottomSection = container.querySelector<HTMLElement>(
      ".property-order-custom-value-section.is-bottom",
    );
    if (plannedRow == null || bottomSection == null) {
      throw new Error("Missing drag source or target.");
    }

    plannedRow.dispatchEvent(new Event("dragstart", { bubbles: true }));
    const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
    bottomSection.dispatchEvent(dragOver);
    expect(dragOver.defaultPrevented).toBe(true);

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    bottomSection.dispatchEvent(drop);
    await flushPersist();
    expect(drop.defaultPrevented).toBe(true);
    expect(onCustomOrdersChange).toHaveBeenCalled();

    plannedRow.dispatchEvent(new Event("dragend", { bubbles: true }));
    const secondDrop = new Event("drop", { bubbles: true, cancelable: true });
    bottomSection.dispatchEvent(secondDrop);
    expect(secondDrop.defaultPrevented).toBe(false);
  });

  it("falls back to the first custom key when the requested selection is absent", () => {
    const container = document.createElement("div");

    const lifecycle = renderCustomValueSuggestionEditor({
      app: createApp(),
      assignments: customAssignments(),
      containerEl: container,
      customOrders: customOrders(),
      displayOrder: "name",
      getFrequency: () => [],
      onCustomOrdersChange: () => Promise.resolve(),
      rerender: vi.fn(),
      selectedPropertyKey: "missing",
      t: (key) => key,
    });

    expect(lifecycle.selectedPropertyKey).toBe("priority");
  });
});
