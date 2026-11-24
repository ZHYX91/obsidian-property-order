// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSettingsTabLayout,
  focusSettingsTab,
  getSettingsTabScrollLeft,
  type SettingsTabDefinition,
  type SettingsTabId,
} from "../../src/app/settings-tabs";

const tabs: SettingsTabDefinition[] = [
  { id: "general", label: "General" },
  { id: "valueDrag", label: "Value drag" },
  { id: "keyOrder", label: "Key order" },
];

const scrollLabels = { earlier: "Show earlier tabs", later: "Show later tabs" };

describe("createSettingsTabLayout", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("keeps a visible selection in view through narrowing and preserves manual paging", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const layout = createSettingsTabLayout(container, tabs, "valueSuggestions", "Settings", scrollLabels, vi.fn());
    const list = container.querySelector<HTMLElement>('[role="tablist"]')!;
    const active = list.querySelector<HTMLElement>('[aria-selected="true"]')!;
    const strip = list.parentElement!;
    let width = 0;
    Object.defineProperty(strip, "clientWidth", { get: () => width });
    Object.defineProperty(list, "clientWidth", { get: () => width });
    Object.defineProperty(list, "scrollWidth", { get: () => 400 });
    vi.spyOn(list, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, 0, width, 34));
    vi.spyOn(active, "getBoundingClientRect").mockImplementation(() => new DOMRect(320 - list.scrollLeft, 0, 80, 34));
    try {
      width = 300;
      window.dispatchEvent(new Event("resize"));
      expect(list.scrollLeft).toBe(100);
      width = 200;
      window.dispatchEvent(new Event("resize"));
      expect(list.scrollLeft).toBe(200);

      list.scrollLeft = 0;
      list.dispatchEvent(new Event("scroll"));
      width = 180;
      window.dispatchEvent(new Event("resize"));
      expect(list.scrollLeft).toBe(0);
      expect(active.getAttribute("aria-selected")).toBe("true");
    } finally {
      layout.cleanup();
      container.remove();
    }
  });

  it("builds the tablist, tabs, and linked tabpanel semantics", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const layout = createSettingsTabLayout(
      container,
      tabs,
      "valueDrag",
      "Property Order settings categories",
      scrollLabels,
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
    document.body.append(container);
    for (const tab of tabElements) {
      expect(document.getElementById(tab.getAttribute("aria-controls")!)).toBe(layout.panelEl);
    }
    const second = document.createElement("div");
    document.body.append(second);
    const other = createSettingsTabLayout(second, tabs, "general", "Settings", scrollLabels, vi.fn());
    other.cleanup();
    layout.cleanup();
    expect(other.panelEl.id).not.toBe(layout.panelEl.id);
    expect(document.getElementById(other.panelEl.getAttribute("aria-labelledby")!)).toBe(other.activeTabEl);
    expect(layout.panelEl.getAttribute("aria-labelledby")).toBe(layout.activeTabEl.id);
  });

  it.each(["ltr", "rtl"])("reveals the next clipped tab without selecting it (%s)", (direction) => {
    const container = document.createElement("div");
    container.dir = direction;
    document.body.append(container);
    const select = vi.fn();
    const layout = createSettingsTabLayout(container, tabs, "general", "Sections", scrollLabels, select);
    const list = container.querySelector<HTMLElement>("[role=tablist]")!;
    const strip = list.parentElement!;
    const earlier = strip.querySelector<HTMLButtonElement>('[data-direction="earlier"]')!;
    const later = strip.querySelector<HTMLButtonElement>('[data-direction="later"]')!;
    const buttons = Array.from(list.querySelectorAll<HTMLElement>("[role=tab]"));
    const rtl = direction === "rtl";
    const tabWidth = 80;
    const arrowWidth = 32;
    let available = 164;
    Object.defineProperty(strip, "clientWidth", { get: () => available });
    Object.defineProperty(list, "scrollWidth", { get: () => buttons.length * tabWidth });
    // Visible arrows occupy space at opposite physical edges in LTR and RTL.
    vi.spyOn(list, "getBoundingClientRect").mockImplementation(() => {
      const left = (rtl ? later : earlier).hidden ? 0 : arrowWidth;
      const right = available - ((rtl ? earlier : later).hidden ? 0 : arrowWidth);
      return { left, right, width: right - left } as DOMRect;
    });
    for (const [index, button] of buttons.entries()) {
      vi.spyOn(button, "getBoundingClientRect").mockImplementation(() => {
        const viewport = list.getBoundingClientRect();
        const start = rtl ? viewport.right - (index + 1) * tabWidth : viewport.left + index * tabWidth;
        const left = start - list.scrollLeft;
        return { left, right: left + tabWidth, width: tabWidth } as DOMRect;
      });
    }
    // Mimic the scroll event fired after native wheel or touch interaction.
    list.dispatchEvent(new Event("scroll"));
    expect(earlier.hidden).toBe(true);
    expect(later.hidden).toBe(false);
    expect(later.getAttribute("aria-label")).toBe(scrollLabels.later);
    // When touch or wheel scrolling reveals the opposite arrow, the tab under
    // the pointer should not jump sideways to make space for the new control.
    list.scrollLeft = rtl ? -20 : 20;
    const anchor = buttons[1]!;
    const before = anchor.getBoundingClientRect().left;
    list.dispatchEvent(new Event("scroll"));
    expect(earlier.hidden).toBe(false);
    expect(anchor.getBoundingClientRect().left).toBe(before);

    later.click();
    const revealed = anchor.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    expect(revealed.left).toBeGreaterThanOrEqual(viewport.left);
    expect(revealed.right).toBeLessThanOrEqual(viewport.right);
    expect(earlier.hidden).toBe(false);
    expect(later.hidden).toBe(false);
    for (let index = 2; index < buttons.length; index++) later.click();
    expect(later.hidden).toBe(true);
    expect(earlier.hidden).toBe(false);
    expect(buttons[0]?.getAttribute("aria-selected")).toBe("true");
    expect(select).not.toHaveBeenCalled();

    available = buttons.length * tabWidth;
    list.dispatchEvent(new Event("scroll"));
    expect(strip.classList.contains("has-overflow")).toBe(false);
    expect(earlier.hidden).toBe(true);
    expect(later.hidden).toBe(true);
    layout.cleanup();
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
        scrollLabels,
        onSelect,
      );
      const activeTab = container.querySelector<HTMLElement>("[role=tab][aria-selected=true]");

      activeTab?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      expect(onSelect).toHaveBeenCalledWith(expectedTab);
    },
  );

  it("reverses left and right arrow navigation in right-to-left layouts", () => {
    const container = document.createElement("div");
    container.dir = "rtl";
    document.body.appendChild(container);
    const onSelect = vi.fn();
    createSettingsTabLayout(
      container,
      tabs,
      "general",
      "Property Order settings categories",
      scrollLabels,
      onSelect,
    );
    const activeTab = container.querySelector<HTMLElement>("[role=tab][aria-selected=true]");

    activeTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith("keyOrder");
    activeTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith("valueDrag");
  });

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
        scrollLabels,
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
      scrollLabels,
      vi.fn(),
    );

    expect(addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    layout.cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("focuses a tab without scrolling its surrounding settings panel", () => {
    const button = document.createElement("button");
    const focus = vi.spyOn(button, "focus");

    focusSettingsTab(button);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("reveals an active tab clipped on the left of a narrow RTL tab bar", () => {
    const container = document.createElement("div");
    container.dir = "rtl";
    document.body.appendChild(container);
    const layout = createSettingsTabLayout(
      container,
      tabs,
      "keyOrder",
      "Property Order settings categories",
      scrollLabels,
      vi.fn(),
    );
    const tabBar = container.querySelector<HTMLElement>("[role=tablist]");
    if (tabBar == null) throw new Error("Expected the settings tab bar.");
    Object.defineProperties(tabBar, {
      clientWidth: { value: 240 },
      scrollWidth: { value: 480 },
    });
    vi.spyOn(tabBar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 240,
    } as DOMRect);
    vi.spyOn(layout.activeTabEl, "getBoundingClientRect").mockReturnValue({
      left: -120,
      width: 100,
    } as DOMRect);

    window.dispatchEvent(new Event("resize"));

    expect(tabBar.scrollLeft).toBe(-120);
    layout.cleanup();
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

  it("keeps and adjusts negative scroll positions in RTL layouts", () => {
    expect(getSettingsTabScrollLeft({
      clientWidth: 240,
      scrollWidth: 480,
      scrollLeft: -100,
      tabOffsetLeft: -80,
      tabOffsetWidth: 60,
      rightToLeft: true,
    })).toBe(-100);
    expect(getSettingsTabScrollLeft({
      clientWidth: 240,
      scrollWidth: 480,
      scrollLeft: 0,
      tabOffsetLeft: -120,
      tabOffsetWidth: 100,
      rightToLeft: true,
    })).toBe(-120);
    expect(getSettingsTabScrollLeft({
      clientWidth: 240,
      scrollWidth: 480,
      scrollLeft: -240,
      tabOffsetLeft: 40,
      tabOffsetWidth: 100,
      rightToLeft: true,
    })).toBe(-100);
  });
});
