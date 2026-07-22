// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSettingsTabLayout,
  getSettingsTabScrollLeft,
  type SettingsTabDefinition,
  type SettingsTabId,
} from "../../src/app/settings-tabs";

const tabs: SettingsTabDefinition[] = [
  { id: "general", label: "General" },
  { id: "valueDrag", label: "Value drag" },
  { id: "keyOrder", label: "Key order" },
];

describe("createSettingsTabLayout", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("builds the tablist, tabs, and linked tabpanel semantics", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const layout = createSettingsTabLayout(
      container,
      tabs,
      "valueDrag",
      "Property Order settings categories",
      vi.fn(),
    );
    const tabList = container.querySelector<HTMLElement>("[role=tablist]");
    const tabElements = Array.from(container.querySelectorAll<HTMLElement>("[role=tab]"));

    expect(tabList?.getAttribute("aria-orientation")).toBe("horizontal");
    expect(tabList?.getAttribute("aria-label")).toBe("Property Order settings categories");
    expect(tabElements.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(tabElements.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(layout.panelEl.getAttribute("role")).toBe("tabpanel");
    expect(layout.activeTabEl.getAttribute("aria-controls")).toBe(layout.panelEl.id);
    expect(layout.panelEl.getAttribute("aria-labelledby")).toBe(layout.activeTabEl.id);
  });

  it.each([
    ["ArrowRight", "general", "valueDrag"],
    ["ArrowLeft", "general", "keyOrder"],
    ["Home", "valueDrag", "general"],
    ["End", "general", "keyOrder"],
  ] as Array<[string, SettingsTabId, SettingsTabId]>)(
    "maps %s from %s to %s",
    (key, initialTab, expectedTab) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const onSelect = vi.fn();
      createSettingsTabLayout(
        container,
        tabs,
        initialTab,
        "Property Order settings categories",
        onSelect,
      );
      const activeTab = container.querySelector<HTMLElement>("[role=tab][aria-selected=true]");

      activeTab?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      expect(onSelect).toHaveBeenCalledWith(expectedTab);
    },
  );

  it("keeps focus on the newly active tab after a rerender", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let activeTab: SettingsTabId = "general";

    const render = (focus: boolean): void => {
      container.replaceChildren();
      const layout = createSettingsTabLayout(
        container,
        tabs,
        activeTab,
        "Property Order settings categories",
        (tabId) => {
          activeTab = tabId;
          render(true);
        },
      );

      if (focus) {
        layout.activeTabEl.focus();
      }
    };

    render(false);
    const firstTab = container.querySelector<HTMLElement>("[role=tab][aria-selected=true]");
    firstTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(activeTab).toBe("valueDrag");
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Value drag");
  });

  it("rechecks active-tab visibility after viewport resize and cleans up", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const layout = createSettingsTabLayout(
      container,
      tabs,
      "keyOrder",
      "Property Order settings categories",
      vi.fn(),
    );

    expect(addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    layout.cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});

describe("getSettingsTabScrollLeft", () => {
  it("keeps a fully visible active tab at the current scroll position", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 320,
      scrollWidth: 360,
      scrollLeft: 20,
      tabOffsetLeft: 100,
      tabOffsetWidth: 80,
    })).toBe(20);
  });

  it("reveals active tabs clipped on either horizontal edge", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 320,
      scrollWidth: 500,
      scrollLeft: 100,
      tabOffsetLeft: 40,
      tabOffsetWidth: 80,
    })).toBe(40);
    expect(getSettingsTabScrollLeft({
      clientWidth: 322,
      scrollWidth: 359,
      scrollLeft: 0,
      tabOffsetLeft: 307,
      tabOffsetWidth: 52,
    })).toBe(37);
  });

  it("clamps malformed layout values to the available scroll range", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 300,
      scrollWidth: 500,
      scrollLeft: 400,
      tabOffsetLeft: 490,
      tabOffsetWidth: 80,
    })).toBe(200);
    expect(getSettingsTabScrollLeft({
      clientWidth: 400,
      scrollWidth: 300,
      scrollLeft: 20,
      tabOffsetLeft: -10,
      tabOffsetWidth: 40,
    })).toBe(0);
  });
});
