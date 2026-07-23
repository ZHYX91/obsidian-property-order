// @vitest-environment happy-dom

import { Menu } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

const menuHarness = vi.hoisted(() => ({
  addItem: vi.fn(),
  forEvent: vi.fn(),
}));

vi.mock("obsidian", () => ({
  Menu: class Menu {
    static forEvent = menuHarness.forEvent;
  },
}));

import { addMobileReorderMenuItem } from "../../../src/features/value-order/mobile-reorder-menu";

describe("addMobileReorderMenuItem", () => {
  beforeEach(() => {
    menuHarness.addItem.mockReset();
    menuHarness.forEvent.mockReset();
    menuHarness.forEvent.mockReturnValue({
      addItem: menuHarness.addItem,
    });
  });

  it("adds one native menu item with the requested action", () => {
    const event = new MouseEvent("contextmenu");
    const onSelect = vi.fn();
    const item = {
      onClick: vi.fn().mockReturnThis(),
      setIcon: vi.fn().mockReturnThis(),
      setTitle: vi.fn().mockReturnThis(),
    };
    menuHarness.addItem.mockImplementation((callback) => {
      callback(item);
    });

    expect(
      addMobileReorderMenuItem({
        event,
        onSelect,
        title: "Reorder",
      }),
    ).toBe(true);
    expect(menuHarness.forEvent).toHaveBeenCalledWith(event);
    expect(item.setTitle).toHaveBeenCalledWith("Reorder");
    expect(item.setIcon).toHaveBeenCalledWith("move");
    expect(item.onClick).toHaveBeenCalledWith(onSelect);
  });

  it("fails open when the host cannot provide a shared menu", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    menuHarness.forEvent.mockImplementation(() => {
      throw new Error("menu unavailable");
    });

    expect(
      addMobileReorderMenuItem({
        event: new MouseEvent("contextmenu"),
        onSelect: vi.fn(),
        title: "Reorder",
      }),
    ).toBe(false);
    expect(debug).toHaveBeenCalledOnce();
  });

  it("fails open when Menu.forEvent is unavailable", () => {
    const menuType = Menu as unknown as {
      forEvent?: typeof Menu.forEvent;
    };
    const originalForEvent = menuType.forEvent;
    delete menuType.forEvent;

    try {
      expect(
        addMobileReorderMenuItem({
          event: new MouseEvent("contextmenu"),
          onSelect: vi.fn(),
          title: "Reorder",
        }),
      ).toBe(false);
    } finally {
      menuType.forEvent = originalForEvent;
    }
  });
});
