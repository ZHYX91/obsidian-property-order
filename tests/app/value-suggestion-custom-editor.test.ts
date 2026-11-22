// @vitest-environment happy-dom

import { Setting, type App, type TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderCustomValueSuggestionEditor } from "../../src/app/value-suggestion-custom-editor";
import { preserveSettingsView } from "../../src/app/settings-view-state";
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

    container.querySelector<HTMLButtonElement>(".property-order-custom-value-key.is-active")?.click();
    expect(rerender).not.toHaveBeenCalled();
    const priorityButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".property-order-custom-value-key"),
    ).find((button) => button.textContent === "priority");
    priorityButton?.click();
    expect(rerender).toHaveBeenCalledWith("priority");
  });

  it("bounds large sections and keeps a candidate focused when it moves across pages", () => {
    const container = document.body.createDiv();
    const values = Array.from({ length: 1000 }, (_, index) => `Value ${index + 1}`);
    let order: PropertyValueCustomOrder = {
      propertyKey: "status", middleSortMode: "native",
      pinnedValues: [], middleValues: values, bottomValues: [],
    };
    const render = () => preserveSettingsView(container, () => {
      const staging = document.createElement("div");
      renderCustomValueSuggestionEditor({
        app: createApp(), assignments: customAssignments(), containerEl: staging,
        customOrders: [order], displayOrder: "name", getFrequency: () => [],
        onCustomOrdersChange: async (orders) => { order = orders[0]; },
        rerender: render, selectedPropertyKey: "status", t: (key) => key,
      });
      container.replaceChildren(...Array.from(staging.childNodes));
    });
    render();
    const middle = () => container.querySelector<HTMLElement>(".is-middle")!;
    const rows = () => middle().querySelectorAll(".property-order-custom-value-item");
    const page = () => middle().querySelector<HTMLInputElement>('input[type="number"]')!;
    const nav = () => middle().querySelector<HTMLElement>(".property-order-candidate-pages")!;
    const lastValue = "Value 1000";

    expect(rows()).toHaveLength(32);
    const [previous, next] = nav().querySelectorAll("button");
    expect(previous.disabled).toBe(true);
    next.click();
    expect(page().value).toBe("2");
    expect(rows()).toHaveLength(32);
    previous.click();
    expect(page().value).toBe("1");
    page().value = "32";
    page().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(rows().length).toBeLessThanOrEqual(32);
    expect(nav().querySelectorAll("button")[1].disabled).toBe(true);
    expect(middle().textContent).toContain(lastValue);

    const pin = middle().querySelector<HTMLButtonElement>('[data-settings-focus="candidate:Value 1000:⇧"]')!;
    pin.focus();
    pin.click();
    expect(order.pinnedValues).toContain(lastValue);
    expect(page().value).toBe("32");
    expect(container.querySelector(".is-pinned")?.contains(document.activeElement)).toBe(true);
    // Deliberately move the middle view away: the focus target should reopen its page.
    page().value = "1";
    page().dispatchEvent(new Event("change"));
    const unpin = container.querySelector<HTMLButtonElement>('.is-pinned [data-settings-focus="candidate:Value 1000:↔"]')!;
    unpin.focus();
    unpin.click();
    expect(page().value).toBe("32");
    expect(document.activeElement?.getAttribute("data-settings-focus-group"))
      .toBe(JSON.stringify(["status", lastValue]));
    expect(rows().length).toBeLessThanOrEqual(32);
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

  it.each(["status", "priority"])(
    "keeps the current %s draft when an earlier preset save finishes",
    async (nextPropertyKey) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      let selectedPropertyKey = "status";
      let orders = customOrders();
      let finishSave: (() => void) | undefined;
      const pendingSave = new Promise<void>((resolve) => {
        finishSave = resolve;
      });
      const render = (propertyKey = selectedPropertyKey): void => {
        selectedPropertyKey = propertyKey;
        preserveSettingsView(container, () => {
          const staging = document.createElement("div");
          renderCustomValueSuggestionEditor({
            app: createApp(),
            assignments: customAssignments(),
            containerEl: staging,
            customOrders: orders,
            displayOrder: "name",
            getFrequency: () => [],
            onCustomOrdersChange: async (nextOrders) => {
              orders = nextOrders;
              await pendingSave;
            },
            rerender: render,
            selectedPropertyKey,
            t: (key) => key,
          });
          container.replaceChildren(...Array.from(staging.childNodes));
        });
      };
      const getInput = (): HTMLInputElement => {
        const input = container.querySelector<HTMLInputElement>(
          ".is-pinned .property-order-custom-value-add input",
        );
        if (input == null) throw new Error("Expected the preset input.");
        return input;
      };
      render();
      getInput().value = "saved-preset";
      container.querySelector<HTMLButtonElement>(
        ".is-pinned .property-order-custom-value-add button",
      )?.click();
      Array.from(container.querySelectorAll<HTMLButtonElement>(
        ".property-order-custom-value-key",
      )).find((button) => button.textContent === nextPropertyKey)?.click();
      const draftInput = getInput();
      draftInput.value = "unfinished draft";
      draftInput.focus();
      draftInput.setSelectionRange(3, 8);

      finishSave?.();
      await flushPersist();

      expect(selectedPropertyKey).toBe(nextPropertyKey);
      expect(getInput()).toBe(draftInput);
      expect(getInput().value).toBe("unfinished draft");
      expect(document.activeElement).toBe(draftInput);
      expect([draftInput.selectionStart, draftInput.selectionEnd]).toEqual([3, 8]);
      expect(orders.find((order) => order.propertyKey === "status")?.pinnedValues)
        .toContain("saved-preset");
    },
  );

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
