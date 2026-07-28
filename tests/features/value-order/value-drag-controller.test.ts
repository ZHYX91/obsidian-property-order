// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import {
  Platform,
  type Editor,
  type EditorTransaction,
  type Plugin,
  type TFile,
} from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const noticeSpy = vi.hoisted(() => vi.fn());
const menuHarness = vi.hoisted(() => ({
  forEvent: vi.fn(),
  items: [] as Array<{
    click(): void;
    icon: string | null;
    title: string;
  }>,
}));

vi.mock("obsidian", () => ({
  getLanguage: () => "en",
  moment: { locale: () => "en" },
  MarkdownView: class MarkdownView {},
  Platform: { isMobileApp: false },
  Notice: class Notice {
    constructor(message: string) {
      noticeSpy(message);
    }
  },
  Menu: class Menu {
    static forEvent(event: MouseEvent) {
      menuHarness.forEvent(event);
      return {
        addItem(
          callback: (item: {
            onClick(handler: () => void): unknown;
            setIcon(icon: string): unknown;
            setTitle(title: string): unknown;
          }) => void,
        ) {
          const record = {
            click: (() => undefined) as () => void,
            icon: null as string | null,
            title: "",
          };
          const item = {
            onClick(handler: () => void) {
              record.click = handler;
              return item;
            },
            setIcon(icon: string) {
              record.icon = icon;
              return item;
            },
            setTitle(title: string) {
              record.title = title;
              return item;
            },
          };
          callback(item);
          menuHarness.items.push(record);
          return this;
        },
      };
    }
  },
}));

import {
  MOBILE_REORDER_ARM_TIMEOUT_MS,
  PropertyValueOrderController,
} from "../../../src/features/value-order/value-drag-controller";
import { TOUCH_LONG_PRESS_MS } from "../../../src/core/interaction/pointer-drag";
import { createDefaultSettings } from "../../../src/shared/settings";
import type { PropertyOrderSettings } from "../../../src/shared/types";

interface ControllerHarness {
  cleanup(): void;
  container: HTMLElement;
  controller: PropertyValueOrderController;
  editor: {
    getContent(): string;
    instance: Editor;
    setContent(content: string): void;
    transaction: ReturnType<typeof vi.fn>;
  };
  file: TFile;
  frontmatter: Record<string, unknown>;
  leaf: {
    containerEl: HTMLElement;
    view: { containerEl: HTMLElement; editor: Editor; file: TFile };
  };
  closeWorkspaceWindow(targetWindow: Window): void;
  openWorkspaceWindow(targetWindow: Window): void;
  pill: HTMLElement;
  plugin: Plugin;
  settings: PropertyOrderSettings;
}

interface RafHarness {
  flush(): void;
}

function installRafHarness(): RafHarness {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    flush() {
      const queued = Array.from(callbacks.values());
      callbacks.clear();

      for (const callback of queued) {
        callback(performance.now());
      }
    },
  };
}

function createRect(left: number, right: number): DOMRect {
  return {
    bottom: 40,
    height: 40,
    left,
    right,
    top: 0,
    width: right - left,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}

function createEditorHarness(initialContent: string): ControllerHarness["editor"] {
  let content = initialContent;
  const transaction = vi.fn((editorTransaction: EditorTransaction) => {
    const change = editorTransaction.changes?.[0];

    if (change == null) {
      return;
    }

    const fromOffset = positionToOffset(content, change.from);
    const toOffset = positionToOffset(content, change.to ?? change.from);
    content = content.slice(0, fromOffset) + change.text + content.slice(toOffset);
  });
  const instance = {
    getValue: () => content,
    offsetToPos: (offset: number) => {
      const lines = content.slice(0, offset).split("\n");
      return { line: lines.length - 1, ch: lines.at(-1)?.length ?? 0 };
    },
    transaction,
  } as unknown as Editor;

  return {
    getContent: () => content,
    instance,
    setContent: (nextContent) => {
      content = nextContent;
    },
    transaction,
  };
}

function positionToOffset(
  content: string,
  position: { ch: number; line: number },
): number {
  const lines = content.split("\n");
  let offset = 0;

  for (let line = 0; line < position.line; line += 1) {
    offset += (lines[line]?.length ?? 0) + 1;
  }

  return offset + position.ch;
}

function createHarness(): ControllerHarness {
  const settings = createDefaultSettings();
  const file = { path: "Source.md" } as TFile;
  const frontmatter: Record<string, unknown> = { flow: ["alpha", "beta"] };
  const pane = document.createElement("div");
  pane.className = "workspace-leaf";
  const metadata = document.createElement("div");
  metadata.className = "metadata-container";
  const property = document.createElement("div");
  property.className = "metadata-property";
  property.dataset.propertyKey = "flow";
  const container = document.createElement("div");
  container.className = "multi-select-container";
  container.getBoundingClientRect = () => createRect(0, 300);
  const pill = document.createElement("div");
  pill.className = "multi-select-pill";
  pill.textContent = "alpha";
  pill.getBoundingClientRect = () => createRect(0, 100);
  const secondPill = document.createElement("div");
  secondPill.className = "multi-select-pill";
  secondPill.textContent = "beta";
  secondPill.getBoundingClientRect = () => createRect(120, 220);
  container.append(pill, secondPill);
  property.appendChild(container);
  metadata.appendChild(property);
  pane.appendChild(metadata);
  document.body.appendChild(pane);

  const editor = createEditorHarness("---\nflow: [alpha, beta]\n---\n");
  const leaf = {
    containerEl: pane,
    view: { containerEl: pane, editor: editor.instance, file },
  };
  let windowOpenCallback: ((_workspaceWindow: unknown, targetWindow: Window) => void) | null = null;
  let windowCloseCallback: ((_workspaceWindow: unknown, targetWindow: Window) => void) | null = null;
  const plugin = {
    app: {
      metadataCache: {
        getFileCache: () => ({ frontmatter }),
      },
      workspace: {
        getActiveFile: () => leaf.view.file,
        getMostRecentLeaf: () => leaf,
        iterateAllLeaves: (callback: (value: typeof leaf) => void) => callback(leaf),
        on: vi.fn(
          (
            name: string,
            callback: (_workspaceWindow: unknown, targetWindow: Window) => void,
          ) => {
            if (name === "window-open") {
              windowOpenCallback = callback;
            } else if (name === "window-close") {
              windowCloseCallback = callback;
            }

            return { type: name };
          },
        ),
      },
    },
    registerEvent: vi.fn(),
  } as unknown as Plugin;
  const controller = new PropertyValueOrderController(plugin, () => settings);
  const disposeController = controller.initialize();

  return {
    cleanup() {
      disposeController();
    },
    closeWorkspaceWindow(targetWindow: Window) {
      windowCloseCallback?.({} as never, targetWindow);
    },
    container,
    controller,
    editor,
    file,
    frontmatter,
    leaf,
    openWorkspaceWindow(targetWindow: Window) {
      windowOpenCallback?.({} as never, targetWindow);
    },
    pill,
    plugin,
    settings,
  };
}

function addScalarProperty(
  harness: ControllerHarness,
  propertyKey: string,
  left = 320,
  right = 600,
): HTMLElement {
  const property = document.createElement("div");
  property.className = "metadata-property";
  property.dataset.propertyKey = propertyKey;
  property.getBoundingClientRect = () => createRect(left, right);
  const input = document.createElement("input");
  property.appendChild(input);
  harness.container.closest(".metadata-container")?.appendChild(property);
  return property;
}

function addEmptyListProperty(
  harness: ControllerHarness,
  propertyKey: string,
  left = 320,
  right = 600,
): { container: HTMLElement; placeholder: HTMLElement; property: HTMLElement } {
  const property = document.createElement("div");
  property.className = "metadata-property";
  property.dataset.propertyKey = propertyKey;
  property.getBoundingClientRect = () => createRect(left, right);
  const container = document.createElement("div");
  container.className = "multi-select-container";
  container.getBoundingClientRect = () => createRect(left, right);
  const placeholder = document.createElement("div");
  placeholder.className = "metadata-property-value-placeholder";
  placeholder.textContent = "No value";
  container.appendChild(placeholder);
  property.appendChild(container);
  harness.container.closest(".metadata-container")?.appendChild(property);
  return { container, placeholder, property };
}

function addScalarBackedListProperty(
  harness: ControllerHarness,
  propertyKey: string,
  value: string,
  left = 320,
  right = 600,
): { container: HTMLElement; pill: HTMLElement; property: HTMLElement } {
  const property = document.createElement("div");
  property.className = "metadata-property";
  property.dataset.propertyKey = propertyKey;
  property.getBoundingClientRect = () => createRect(left, right);
  const container = document.createElement("div");
  container.className = "multi-select-container";
  container.getBoundingClientRect = () => createRect(left, right);
  const pill = document.createElement("div");
  pill.className = "multi-select-pill";
  pill.textContent = value;
  pill.getBoundingClientRect = () => createRect(left + 10, left + 110);
  container.appendChild(pill);
  property.appendChild(container);
  harness.container.closest(".metadata-container")?.appendChild(property);
  return { container, pill, property };
}

function dispatchPointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  pointerType: "mouse" | "touch" | "pen" = "mouse",
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX,
      clientY: 20,
      pointerId: 1,
      pointerType,
    }),
  );
}

function dispatchTouchMove(target: EventTarget): Event {
  const event = new Event("touchmove", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("PropertyValueOrderController", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    noticeSpy.mockReset();
    menuHarness.forEvent.mockReset();
    menuHarness.items.length = 0;
    Platform.isMobileApp = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("captures touchmove non-passively only for a touch interaction", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const harness = createHarness();

    expect(addEventListener).not.toHaveBeenCalledWith(
      "touchmove",
      expect.any(Function),
      expect.anything(),
    );
    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    expect(addEventListener).toHaveBeenCalledWith("touchmove", expect.any(Function), {
      capture: true,
      passive: false,
    });
    harness.cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("touchmove", expect.any(Function), {
      capture: true,
      passive: false,
    });
  });

  it("adds the default reorder-or-move action without suppressing the native mobile menu", () => {
    Platform.isMobileApp = true;
    const harness = createHarness();
    const hostContextMenu = vi.fn();
    document.addEventListener("contextmenu", hostContextMenu);
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    expect(harness.pill.dispatchEvent(contextMenu)).toBe(true);
    expect(contextMenu.defaultPrevented).toBe(false);
    expect(hostContextMenu).toHaveBeenCalledTimes(1);
    expect(menuHarness.forEvent).toHaveBeenCalledWith(contextMenu);
    expect(menuHarness.items).toHaveLength(1);
    expect(menuHarness.items[0]).toMatchObject({
      icon: "move",
      title: "Reorder or move",
    });

    document.removeEventListener("contextmenu", hostContextMenu);
    harness.cleanup();
  });

  it("uses the reorder-only label when mobile cross-property drag is disabled", () => {
    Platform.isMobileApp = true;
    const harness = createHarness();
    harness.settings.enableCrossPropertyDrag = false;

    harness.pill.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(menuHarness.items[0]?.title).toBe("Reorder");
    harness.cleanup();
  });

  it("starts mobile drag from the next movement after the native menu action", () => {
    Platform.isMobileApp = true;
    installRafHarness();
    const harness = createHarness();

    harness.pill.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    menuHarness.items[0]?.click();

    expect(harness.pill.classList.contains("property-order-mobile-reorder-armed")).toBe(true);
    expect(noticeSpy).toHaveBeenCalledWith(
      "Property Order: drag the selected value now. Tap elsewhere or wait to cancel.",
    );

    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    dispatchPointer(document, "pointermove", 16, "touch");

    expect(document.querySelector(".property-order-drag-preview")).not.toBeNull();
    expect(harness.pill.classList.contains("property-order-mobile-reorder-armed")).toBe(false);

    dispatchPointer(document, "pointerup", 16, "touch");
    harness.cleanup();
  });

  it("does not drag an unarmed mobile value", () => {
    Platform.isMobileApp = true;
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    dispatchPointer(document, "pointermove", 250, "touch");

    expect(document.querySelector(".property-order-drag-preview")).toBeNull();

    harness.cleanup();
  });

  it("cancels mobile reorder mode on another tap, Escape, or timeout", () => {
    Platform.isMobileApp = true;
    vi.useFakeTimers();
    const harness = createHarness();
    const contextMenu = () => {
      harness.pill.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
      menuHarness.items.at(-1)?.click();
    };

    contextMenu();
    dispatchPointer(document.body, "pointerdown", 10, "touch");
    expect(harness.pill.classList.contains("property-order-mobile-reorder-armed")).toBe(false);

    contextMenu();
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(harness.pill.classList.contains("property-order-mobile-reorder-armed")).toBe(false);

    contextMenu();
    vi.advanceTimersByTime(MOBILE_REORDER_ARM_TIMEOUT_MS);
    expect(harness.pill.classList.contains("property-order-mobile-reorder-armed")).toBe(false);

    harness.cleanup();
  });

  it("suppresses a second native menu only during the armed mobile gesture", () => {
    Platform.isMobileApp = true;
    const harness = createHarness();
    harness.pill.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      }),
    );
    menuHarness.items[0]?.click();
    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    const hostContextMenu = vi.fn();
    document.addEventListener("contextmenu", hostContextMenu);
    const secondMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    expect(harness.pill.dispatchEvent(secondMenu)).toBe(false);
    expect(secondMenu.defaultPrevented).toBe(true);
    expect(hostContextMenu).not.toHaveBeenCalled();

    document.removeEventListener("contextmenu", hostContextMenu);
    harness.cleanup();
  });

  it("allows native touch scrolling before long press and suppresses it during drag", () => {
    vi.useFakeTimers();
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    dispatchPointer(document, "pointermove", 14, "touch");
    expect(dispatchTouchMove(document).defaultPrevented).toBe(false);

    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS);
    expect(document.querySelector(".property-order-drag-preview")).not.toBeNull();
    expect(dispatchTouchMove(document).defaultPrevented).toBe(true);

    harness.cleanup();
  });

  it("suppresses the native value context menu during a touch long press", () => {
    vi.useFakeTimers();
    installRafHarness();
    const harness = createHarness();
    const hostContextMenu = vi.fn();
    document.addEventListener("contextmenu", hostContextMenu);

    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS);
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    expect(harness.pill.dispatchEvent(contextMenu)).toBe(false);
    expect(contextMenu.defaultPrevented).toBe(true);
    expect(hostContextMenu).not.toHaveBeenCalled();

    document.removeEventListener("contextmenu", hostContextMenu);
    harness.cleanup();
  });

  it("preserves ordinary mouse context menus", () => {
    const harness = createHarness();
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    expect(harness.pill.dispatchEvent(contextMenu)).toBe(true);
    expect(contextMenu.defaultPrevented).toBe(false);

    harness.cleanup();
  });

  it("keeps touchmove native after pre-long-press movement cancels the press", () => {
    vi.useFakeTimers();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    dispatchPointer(document, "pointermove", 25, "touch");
    expect(dispatchTouchMove(document).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS);
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();

    harness.cleanup();
  });

  it("cancels and removes drag presentation when the source Properties DOM disappears", () => {
    const raf = installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    expect(document.querySelector(".property-order-drag-preview")).not.toBeNull();

    harness.container.closest(".metadata-container")?.remove();
    raf.flush();

    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    expect(document.querySelector(".property-order-drop-indicator")).toBeNull();
    expect(document.body.classList.contains("property-order-drag-cursor-active")).toBe(false);
    expect(harness.pill.hasAttribute("draggable")).toBe(false);
    harness.cleanup();
  });

  it("uses a disabled value-drag setting on the next pointer event", () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    expect(harness.pill.getAttribute("draggable")).toBe("false");

    harness.settings.enablePropertyValueDrag = false;
    dispatchPointer(document, "pointermove", 250);

    expect(harness.pill.hasAttribute("draggable")).toBe(false);
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    expect(document.body.classList.contains("property-order-drag-cursor-active")).toBe(false);
    harness.cleanup();
  });

  it("does not register a newly opened document after controller cleanup", () => {
    const harness = createHarness();
    const openedWindow = new HappyDomWindow();
    const addEventListener = vi.spyOn(openedWindow.document, "addEventListener");

    harness.openWorkspaceWindow(openedWindow as unknown as Window);
    expect(addEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    harness.cleanup();
    const callCountAfterCleanup = addEventListener.mock.calls.length;
    harness.openWorkspaceWindow(openedWindow as unknown as Window);

    expect(addEventListener).toHaveBeenCalledTimes(callCountAfterCleanup);
    openedWindow.close();
  });

  it("unbinds only a closed workspace window while keeping the main document active", async () => {
    installRafHarness();
    const harness = createHarness();
    const openedWindow = new HappyDomWindow();
    const removeDocumentEvent = vi.spyOn(openedWindow.document, "removeEventListener");
    const removeWindowEvent = vi.spyOn(openedWindow, "removeEventListener");

    harness.openWorkspaceWindow(openedWindow as unknown as Window);
    harness.closeWorkspaceWindow(openedWindow as unknown as Window);

    expect(removeDocumentEvent).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    expect(removeWindowEvent).toHaveBeenCalledWith("blur", expect.any(Function));

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(harness.editor.transaction).toHaveBeenCalledTimes(1));
    harness.cleanup();
    openedWindow.close();
  });

  it("ignores blur from a different workspace window during an active drag", async () => {
    installRafHarness();
    const harness = createHarness();
    const openedWindow = new HappyDomWindow();

    harness.openWorkspaceWindow(openedWindow as unknown as Window);
    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    openedWindow.dispatchEvent(new openedWindow.Event("blur"));

    expect(document.querySelector(".property-order-drag-preview")).not.toBeNull();
    dispatchPointer(document, "pointerup", 250);
    await vi.waitFor(() => expect(harness.editor.transaction).toHaveBeenCalledTimes(1));
    harness.cleanup();
    openedWindow.close();
  });

  it("cancels an active drag when its own window loses focus", () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    window.dispatchEvent(new Event("blur"));

    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    expect(document.querySelector(".property-order-drop-indicator")).toBeNull();
    expect(document.body.classList.contains("property-order-drag-cursor-active")).toBe(false);
    dispatchPointer(document, "pointerup", 250);
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("cancels an active interaction when its workspace window closes", () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    expect(document.querySelector(".property-order-drag-preview")).not.toBeNull();

    harness.closeWorkspaceWindow(window);

    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    expect(document.querySelector(".property-order-drop-indicator")).toBeNull();
    expect(document.body.classList.contains("property-order-drag-cursor-active")).toBe(false);
    expect(harness.pill.hasAttribute("draggable")).toBe(false);
    dispatchPointer(document, "pointerup", 250);
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("does not write when the pane file changes before drop", async () => {
    const raf = installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    raf.flush();
    harness.leaf.view.file = { path: "Other.md" } as TFile;
    dispatchPointer(document, "pointerup", 250);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    harness.cleanup();
  });

  it("does not write when the pane editor changes before drop", async () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    harness.leaf.view.editor = createEditorHarness(harness.editor.getContent()).instance;
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(noticeSpy).toHaveBeenCalledTimes(1));
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(harness.editor.getContent()).toBe("---\nflow: [alpha, beta]\n---\n");
    harness.cleanup();
  });

  it("uses the release coordinates before a pending animation frame runs", async () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(harness.editor.transaction).toHaveBeenCalledTimes(1));
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    harness.cleanup();
  });

  it("keeps the Properties DOM unchanged when the host ignores the transaction", async () => {
    installRafHarness();
    const harness = createHarness();
    harness.editor.transaction.mockImplementation(() => undefined);
    const originalPills = Array.from(harness.container.children);

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(noticeSpy).toHaveBeenCalledTimes(1));
    expect(noticeSpy).toHaveBeenCalledWith(
      "Property Order: failed to reorder property values.",
    );
    expect(harness.editor.getContent()).toBe("---\nflow: [alpha, beta]\n---\n");
    expect(Array.from(harness.container.children)).toEqual(originalPills);
    harness.cleanup();
  });

  it("commits an empty-list move without manually mixing the pill with its placeholder", async () => {
    const raf = installRafHarness();
    const harness = createHarness();
    harness.frontmatter.empty = [];
    harness.editor.setContent("---\nflow: [alpha, beta]\nempty: []\n---\n");
    const target = addEmptyListProperty(harness, "empty");

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 400);
    raf.flush();
    dispatchPointer(document, "pointerup", 400);

    await vi.waitFor(() => expect(harness.editor.transaction).toHaveBeenCalledTimes(1));
    expect(harness.editor.getContent()).toBe(
      "---\nflow: [beta]\nempty: [alpha]\n---\n",
    );
    expect(harness.container.contains(harness.pill)).toBe(true);
    expect(target.container.contains(harness.pill)).toBe(false);
    expect(target.placeholder.isConnected).toBe(true);
    expect(noticeSpy).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("coerces scalar storage when Obsidian renders the target as a list property", async () => {
    const raf = installRafHarness();
    const harness = createHarness();
    harness.frontmatter.target = "existing";
    harness.editor.setContent("---\nflow: [alpha, beta]\ntarget: existing\n---\n");
    const target = addScalarBackedListProperty(harness, "target", "existing");

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 550);
    raf.flush();
    dispatchPointer(document, "pointerup", 550);

    await vi.waitFor(() => expect(harness.editor.transaction).toHaveBeenCalledTimes(1));
    expect(harness.editor.getContent()).toBe(
      "---\nflow: [beta]\ntarget: [existing, alpha]\n---\n",
    );
    expect(target.container.contains(harness.pill)).toBe(false);
    expect(target.container.contains(target.pill)).toBe(true);
    expect(noticeSpy).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("marks a non-list target and explains the rejected drop once", () => {
    const raf = installRafHarness();
    const harness = createHarness();
    harness.frontmatter.status = "open";
    const scalarProperty = addScalarProperty(harness, "status");

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 400);
    raf.flush();

    expect(scalarProperty.classList.contains("property-order-invalid-drop-target")).toBe(true);
    expect(document.body.classList.contains("property-order-drag-cursor-invalid")).toBe(true);
    expect(document.querySelector(".property-order-drop-indicator.is-visible")).toBeNull();
    expect(noticeSpy).not.toHaveBeenCalled();

    dispatchPointer(document, "pointerup", 400);

    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(noticeSpy).toHaveBeenCalledWith(
      "Property Order: can't move the value to “status”: the target is not a list property.",
    );
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(scalarProperty.classList.contains("property-order-invalid-drop-target")).toBe(false);
    expect(document.body.classList.contains("property-order-drag-cursor-invalid")).toBe(false);
    harness.cleanup();
  });

  it("treats a bare null property as a non-list rejection target", () => {
    const raf = installRafHarness();
    const harness = createHarness();
    harness.frontmatter.empty = null;
    const scalarProperty = addScalarProperty(harness, "empty");

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 400);
    raf.flush();
    dispatchPointer(document, "pointerup", 400);

    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(noticeSpy).toHaveBeenCalledWith(
      "Property Order: can't move the value to “empty”: the target is not a list property.",
    );
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(scalarProperty.classList.contains("property-order-invalid-drop-target")).toBe(false);
    harness.cleanup();
  });

  it("does not show a notice after leaving a non-list target before release", () => {
    const raf = installRafHarness();
    const harness = createHarness();
    harness.frontmatter.status = "open";
    const scalarProperty = addScalarProperty(harness, "status");

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 400);
    raf.flush();
    dispatchPointer(document, "pointermove", 10);
    raf.flush();

    expect(scalarProperty.classList.contains("property-order-invalid-drop-target")).toBe(false);
    dispatchPointer(document, "pointerup", 10);
    expect(noticeSpy).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("does not treat a non-list property as a target when cross-property drag is disabled", () => {
    const raf = installRafHarness();
    const harness = createHarness();
    harness.settings.enableCrossPropertyDrag = false;
    harness.frontmatter.status = "open";
    const scalarProperty = addScalarProperty(harness, "status");

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 400);
    raf.flush();
    dispatchPointer(document, "pointerup", 400);

    expect(scalarProperty.classList.contains("property-order-invalid-drop-target")).toBe(false);
    expect(noticeSpy).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("lets release coordinates override a pending move target", () => {
    const raf = installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    raf.flush();
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 10);

    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    harness.cleanup();
  });

  it("does not start a write for Properties DOM that cannot be mapped to a leaf", () => {
    installRafHarness();
    const harness = createHarness();
    const metadata = harness.container.closest<HTMLElement>(".metadata-container");
    metadata?.remove();
    document.body.appendChild(metadata as HTMLElement);

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);

    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    harness.cleanup();
  });

  it("does not write after the controller is disposed", async () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    harness.cleanup();
    dispatchPointer(document, "pointerup", 250);

    await Promise.resolve();
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
  });

  it("does not write when the source pill detaches before release", async () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    harness.pill.remove();
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => {
      expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    });
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("rejects a dragged value changed in the editor before release", async () => {
    const raf = installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    raf.flush();
    harness.editor.setContent("---\nflow: [external-alpha, beta]\n---\n");
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(noticeSpy).toHaveBeenCalledTimes(1));
    expect(harness.editor.transaction).not.toHaveBeenCalled();
    expect(harness.editor.getContent()).toBe("---\nflow: [external-alpha, beta]\n---\n");
    expect(noticeSpy).toHaveBeenCalledWith(
      "Property Order: content changed while dragging. Try again.",
    );
    harness.cleanup();
  });
});
