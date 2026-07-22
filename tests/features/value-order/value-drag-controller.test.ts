// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { Platform, type Plugin, type TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const noticeSpy = vi.hoisted(() => vi.fn());

vi.mock("obsidian", () => ({
  moment: { locale: () => "en" },
  MarkdownView: class MarkdownView {},
  Platform: { isMobileApp: false },
  Notice: class Notice {
    constructor(message: string) {
      noticeSpy(message);
    }
  },
}));

import { PropertyValueOrderController } from "../../../src/features/value-order/value-drag-controller";
import { TOUCH_LONG_PRESS_MS } from "../../../src/core/interaction/pointer-drag";
import { createDefaultSettings } from "../../../src/shared/settings";
import type { PropertyOrderSettings } from "../../../src/shared/types";

interface ControllerHarness {
  cleanup(): void;
  container: HTMLElement;
  controller: PropertyValueOrderController;
  file: TFile;
  leaf: { containerEl: HTMLElement; view: { containerEl: HTMLElement; file: TFile } };
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

function createHarness(): ControllerHarness {
  const settings = createDefaultSettings();
  const file = { path: "Source.md" } as TFile;
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

  const leaf = {
    containerEl: pane,
    view: { containerEl: pane, file },
  };
  let windowOpenCallback: ((_workspaceWindow: unknown, targetWindow: Window) => void) | null = null;
  let windowCloseCallback: ((_workspaceWindow: unknown, targetWindow: Window) => void) | null = null;
  const process = vi.fn();
  const plugin = {
    app: {
      metadataCache: {
        getFileCache: () => ({ frontmatter: { flow: ["alpha", "beta"] } }),
      },
      vault: {
        cachedRead: vi.fn().mockResolvedValue("---\nflow: [alpha, beta]\n---\n"),
        process,
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
    file,
    leaf,
    openWorkspaceWindow(targetWindow: Window) {
      windowOpenCallback?.({} as never, targetWindow);
    },
    pill,
    plugin,
    settings,
  };
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

  it("does not register property-value drag interactions in the mobile app", () => {
    Platform.isMobileApp = true;
    const addEventListener = vi.spyOn(document, "addEventListener");
    const harness = createHarness();

    expect(addEventListener).not.toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      true,
    );
    dispatchPointer(harness.pill, "pointerdown", 10, "touch");
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();

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

    await vi.waitFor(() => expect(harness.plugin.app.vault.process).toHaveBeenCalledTimes(1));
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
    await vi.waitFor(() => expect(harness.plugin.app.vault.process).toHaveBeenCalledTimes(1));
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
    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
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
    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
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

    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    harness.cleanup();
  });

  it("cancels a delayed vault transform when its pane changes", async () => {
    installRafHarness();
    const harness = createHarness();
    const process = vi.mocked(harness.plugin.app.vault.process);
    let currentContent = "---\nflow: [alpha, beta]\n---\n";
    let runTransform!: () => void;
    process.mockImplementation(
      (_file, transform) =>
        new Promise<string>((resolve) => {
          runTransform = () => {
            currentContent = transform(currentContent);
            resolve(currentContent);
          };
        }),
    );

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));
    harness.leaf.view.file = { path: "Other.md" } as TFile;
    runTransform();

    await vi.waitFor(() => expect(noticeSpy).toHaveBeenCalledTimes(1));
    expect(currentContent).toBe("---\nflow: [alpha, beta]\n---\n");
    harness.cleanup();
  });

  it("uses the release coordinates before a pending animation frame runs", async () => {
    installRafHarness();
    const harness = createHarness();

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(harness.plugin.app.vault.process).toHaveBeenCalledTimes(1));
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
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

    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
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

    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    harness.cleanup();
  });

  it("invalidates an in-flight finish when the controller is disposed", async () => {
    installRafHarness();
    const harness = createHarness();
    let resolveExpectedContent!: (content: string) => void;
    vi.mocked(harness.plugin.app.vault.cachedRead).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveExpectedContent = resolve;
      }),
    );

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);
    harness.cleanup();
    resolveExpectedContent("---\nflow: [alpha, beta]\n---\n");

    await Promise.resolve();
    await Promise.resolve();
    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
    expect(document.querySelector(".property-order-drag-preview")).toBeNull();
  });

  it("does not write when the source pill detaches while cached content is pending", async () => {
    installRafHarness();
    const harness = createHarness();
    let resolveExpectedContent!: (content: string) => void;
    vi.mocked(harness.plugin.app.vault.cachedRead).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveExpectedContent = resolve;
      }),
    );

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    dispatchPointer(document, "pointerup", 250);
    harness.pill.remove();
    resolveExpectedContent("---\nflow: [alpha, beta]\n---\n");

    await vi.waitFor(() => {
      expect(document.querySelector(".property-order-drag-preview")).toBeNull();
    });
    expect(harness.plugin.app.vault.process).not.toHaveBeenCalled();
    harness.cleanup();
  });

  it("rejects a changed dragged value when the async read resolves to newer content", async () => {
    const raf = installRafHarness();
    const harness = createHarness();
    let resolveExpectedContent!: (content: string) => void;
    const expectedContentPromise = new Promise<string>((resolve) => {
      resolveExpectedContent = resolve;
    });
    const cachedRead = vi.mocked(harness.plugin.app.vault.cachedRead);
    const process = vi.mocked(harness.plugin.app.vault.process);
    let currentContent = "---\nflow: [external-alpha, beta]\n---\n";
    cachedRead.mockReturnValue(expectedContentPromise);
    process.mockImplementation(async (_file, transform) => {
      currentContent = transform(currentContent);
      return currentContent;
    });

    dispatchPointer(harness.pill, "pointerdown", 10);
    dispatchPointer(document, "pointermove", 250);
    raf.flush();
    resolveExpectedContent(currentContent);
    dispatchPointer(document, "pointerup", 250);

    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));
    expect(currentContent).toBe("---\nflow: [external-alpha, beta]\n---\n");
    expect(noticeSpy).toHaveBeenCalledWith(
      "Property Order: content changed while dragging. Try again.",
    );
    harness.cleanup();
  });
});
