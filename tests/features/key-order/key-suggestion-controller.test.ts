// @vitest-environment happy-dom

import { Window as HappyDomWindow } from "happy-dom";
import { Platform, type App, type Plugin, type TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KeySuggestionOrderController } from "../../../src/features/key-order/key-suggestion-controller";
import { createDefaultSettings } from "../../../src/shared/settings";
import type { PropertyOrderSettings } from "../../../src/shared/types";

interface RafHarness {
  flush(): void;
  pending(): number;
}

function installRafHarness(targetWindow: Window = window): RafHarness {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(targetWindow, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(targetWindow, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    flush() {
      const queued = Array.from(callbacks.entries());
      callbacks.clear();

      for (const [, callback] of queued) {
        callback(targetWindow.performance.now());
      }
    },
    pending: () => callbacks.size,
  };
}

function createController(
  settings: PropertyOrderSettings,
  app: Partial<App> = {},
): KeySuggestionOrderController {
  const completeApp = {
    ...app,
    metadataCache: {
      on: vi.fn(() => ({})),
      ...app.metadataCache,
    },
    workspace: {
      iterateAllLeaves: vi.fn(),
      on: vi.fn(() => ({})),
      ...app.workspace,
    },
  } as unknown as App;
  const plugin = {
    app: completeApp,
    registerEvent: vi.fn(),
  } as unknown as Plugin;
  return new KeySuggestionOrderController(plugin, () => settings);
}

function createMenu(
  keys: string[],
  context: "key" | "none" | "value" = "key",
  targetDocument: Document = document,
): HTMLElement {
  const container = targetDocument.createElement("div");
  container.className = "suggestion-container";

  for (const key of keys) {
    const item = targetDocument.createElement("div");
    item.className = "suggestion-item";
    const title = targetDocument.createElement("div");
    title.className = "suggestion-title";
    title.textContent = key;
    item.appendChild(title);
    container.appendChild(item);
  }

  installNativeSelectionBehavior(container);

  if (context === "none") {
    targetDocument.body.appendChild(container);
    return container;
  }

  const property = targetDocument.createElement("div");
  property.className = "metadata-property";
  const editor = targetDocument.createElement("div");
  editor.className =
    context === "key" ? "metadata-property-key" : "metadata-property-value";
  editor.appendChild(container);
  property.appendChild(editor);
  targetDocument.body.appendChild(property);
  return container;
}

function createNestedPropertyKeyMenu(keys: string[]): {
  container: HTMLElement;
  itemParent: HTMLElement;
} {
  const property = document.createElement("div");
  property.className = "metadata-property";
  const editor = document.createElement("div");
  editor.className = "metadata-property-key";
  const container = document.createElement("div");
  container.className = "suggestion-container mod-property-key";
  const itemParent = document.createElement("div");
  itemParent.className = "suggestion";

  for (const key of keys) {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    const title = document.createElement("div");
    title.className = "suggestion-title";
    title.textContent = key;
    item.appendChild(title);
    itemParent.appendChild(item);
  }

  container.appendChild(itemParent);
  installNativeSelectionBehavior(container);
  editor.appendChild(container);
  property.appendChild(editor);
  document.body.appendChild(property);
  return { container, itemParent };
}

function replaceMenuItems(container: HTMLElement, keys: string[]): HTMLElement[] {
  const elements = keys.map((key) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    const title = document.createElement("div");
    title.className = "suggestion-title";
    title.textContent = key;
    item.appendChild(title);
    return item;
  });
  container.replaceChildren(...elements);
  elements[0]?.classList.add("is-selected");
  return elements;
}

function installNativeSelectionBehavior(container: HTMLElement): void {
  container.querySelector<HTMLElement>(".suggestion-item")?.classList.add("is-selected");
  container.addEventListener("mousemove", (event) => {
    const target = event.target;
    const item =
      target instanceof Element
        ? target.closest<HTMLElement>(".suggestion-item")
        : null;

    if (item == null || !container.contains(item)) {
      return;
    }

    for (const candidate of container.querySelectorAll<HTMLElement>(".suggestion-item")) {
      candidate.classList.toggle("is-selected", candidate === item);
    }
  });
}

function allKeys(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".suggestion-item")).map(
    (item) => item.textContent?.trim() ?? "",
  );
}

function visibleKeys(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".suggestion-item:not([hidden])")).map(
    (item) => item.textContent?.trim() ?? "",
  );
}

async function settleMutations(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("KeySuggestionOrderController", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  afterEach(() => {
    Platform.isMacOS = false;
    Platform.isMobileApp = false;
    vi.restoreAllMocks();
  });

  it("avoids an eager whole-document scan during mobile startup", async () => {
    Platform.isMobileApp = true;
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const existingMenu = createMenu(["beta", "tags", "alpha"]);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    expect(raf.pending()).toBe(0);
    expect(allKeys(existingMenu)).toEqual(["beta", "tags", "alpha"]);

    const mountedMenu = createMenu(["beta", "tags", "alpha"]);
    await settleMutations();
    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(allKeys(mountedMenu)).toEqual(["tags", "alpha", "beta"]);
    cleanup();
  });

  it("ignores ordinary editor mutations while still processing a new key menu", async () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();
    raf.flush();

    const editor = document.createElement("div");
    editor.className = "markdown-source-view";
    const content = document.createElement("div");
    content.className = "cm-content";
    editor.appendChild(content);
    document.body.appendChild(editor);

    for (let index = 0; index < 20; index += 1) {
      const line = document.createElement("div");
      line.className = "cm-line";
      line.textContent = `line ${index}`;
      content.appendChild(line);
      line.firstChild!.textContent = `updated ${index}`;
    }

    await settleMutations();
    expect(raf.pending()).toBe(0);

    const { container } = createNestedPropertyKeyMenu(["beta", "tags", "alpha"]);
    await settleMutations();
    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(allKeys(container)).toEqual(["tags", "alpha", "beta"]);
    cleanup();
  });

  it("does not scan newly mounted menus while suggestion ordering is disabled", async () => {
    const settings = createDefaultSettings();
    settings.enableNativeKeySuggestionOrder = false;
    settings.pinnedPropertyKeys = ["tags"];
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    expect(raf.pending()).toBe(0);
    const { container } = createNestedPropertyKeyMenu(["beta", "tags", "alpha"]);
    await settleMutations();
    expect(raf.pending()).toBe(0);
    expect(allKeys(container)).toEqual(["beta", "tags", "alpha"]);
    expect(container.dataset.propertyOrderEnhanced).toBeUndefined();

    settings.enableNativeKeySuggestionOrder = true;
    controller.refresh();
    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(allKeys(container)).toEqual(["tags", "alpha", "beta"]);

    settings.enableNativeKeySuggestionOrder = false;
    controller.refresh();
    const nextMenu = createMenu(["beta", "tags", "alpha"]);
    await settleMutations();
    expect(raf.pending()).toBe(0);
    expect(allKeys(nextMenu)).toEqual(["beta", "tags", "alpha"]);
    cleanup();
  });

  it("coalesces MutationObserver additions into one animation-frame enhancement", async () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();
    raf.flush();

    const menu = createMenu(["beta", "tags", "alpha"]);
    menu.appendChild(document.createTextNode(""));
    await settleMutations();

    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(visibleKeys(menu)).toEqual(["tags", "alpha", "beta"]);
    cleanup();
  });

  it("reuses the same nodes, hides duplicates safely, and restores native order", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.bottomPropertyKeys = ["zeta"];
    settings.hiddenPropertyKeyPatterns = ["TQ_*"];
    const menu = createMenu(["zeta", "TQ_internal", "tags", "alpha", "tags"]);
    const originalElements = Array.from(menu.querySelectorAll<HTMLElement>(".suggestion-item"));
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(visibleKeys(menu)).toEqual(["tags", "alpha", "zeta"]);
    expect(allKeys(menu)).toEqual(["tags", "alpha", "zeta", "TQ_internal", "tags"]);
    expect(menu.querySelectorAll(".suggestion-item")).toHaveLength(5);

    controller.refresh();
    controller.refresh();
    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(Array.from(menu.querySelectorAll(".suggestion-item"))).toEqual([
      originalElements[2],
      originalElements[3],
      originalElements[0],
      originalElements[1],
      originalElements[4],
    ]);

    settings.enableNativeKeySuggestionOrder = false;
    controller.refresh();
    expect(raf.pending()).toBe(0);
    raf.flush();
    expect(allKeys(menu)).toEqual(["zeta", "TQ_internal", "tags", "alpha", "tags"]);
    expect(menu.querySelectorAll("[hidden]")).toHaveLength(0);
    expect(menu.dataset.propertyOrderEnhanced).toBeUndefined();
    cleanup();
  });

  it("restores native attributes, plugin-class state, and child order while detached", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.hiddenPropertyKeyPatterns = ["beta"];
    const menu = createMenu(["beta", "tags", "alpha"]);
    const elements = Array.from(menu.querySelectorAll<HTMLElement>(".suggestion-item"));
    const separator = document.createTextNode("separator");
    elements[0]?.setAttribute("hidden", "until-found");
    elements[0]?.setAttribute("aria-hidden", "false");
    elements[1]?.classList.add("property-order-suggestion-hidden");
    menu.replaceChildren(elements[0]!, separator, elements[1]!, elements[2]!);
    const nativeChildOrder = Array.from(menu.childNodes);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(elements[0]?.getAttribute("hidden")).toBe("");
    expect(elements[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(elements[0]?.classList.contains("property-order-suggestion-hidden")).toBe(true);

    menu.closest(".metadata-property")?.remove();
    cleanup();

    expect(Array.from(menu.childNodes)).toEqual(nativeChildOrder);
    expect(elements[0]?.getAttribute("hidden")).toBe("until-found");
    expect(elements[0]?.getAttribute("aria-hidden")).toBe("false");
    expect(elements[0]?.classList.contains("property-order-suggestion-hidden")).toBe(false);
    expect(elements[1]?.classList.contains("property-order-suggestion-hidden")).toBe(true);
    expect(menu.dataset.propertyOrderEnhanced).toBeUndefined();
  });

  it("takes a fresh native snapshot when a reused container replaces its items", async () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.hiddenPropertyKeyPatterns = ["beta"];
    const menu = createMenu(["beta", "tags", "alpha"]);
    const oldBeta = menu.querySelector<HTMLElement>(".suggestion-item");
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(oldBeta?.hidden).toBe(true);
    await settleMutations();
    raf.flush();

    const replacementElements = replaceMenuItems(menu, ["beta", "tags", "alpha"]);
    await settleMutations();
    raf.flush();

    expect(oldBeta?.hidden).toBe(false);
    expect(oldBeta?.getAttribute("aria-hidden")).toBeNull();
    expect(oldBeta?.classList.contains("property-order-suggestion-hidden")).toBe(false);
    expect(allKeys(menu)).toEqual(["tags", "alpha", "beta"]);
    expect(visibleKeys(menu)).toEqual(["tags", "alpha"]);

    cleanup();
    expect(Array.from(menu.querySelectorAll(".suggestion-item"))).toEqual(replacementElements);
    expect(allKeys(menu)).toEqual(["beta", "tags", "alpha"]);
    expect(menu.querySelectorAll("[hidden]")).toHaveLength(0);
  });

  it("reapplies hidden state when the host resets reused item attributes", async () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.hiddenPropertyKeyPatterns = ["beta"];
    const menu = createMenu(["beta", "tags", "alpha"]);
    const beta = menu.querySelector<HTMLElement>(".suggestion-item");
    beta?.setAttribute("hidden", "until-found");
    beta?.setAttribute("aria-hidden", "false");
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(visibleKeys(menu)).toEqual(["tags", "alpha"]);
    expect(beta?.getAttribute("hidden")).toBe("");
    expect(beta?.getAttribute("aria-hidden")).toBe("true");
    expect(beta?.classList.contains("property-order-suggestion-hidden")).toBe(true);

    beta?.removeAttribute("hidden");
    beta?.removeAttribute("aria-hidden");
    beta?.classList.remove("property-order-suggestion-hidden");
    await settleMutations();
    raf.flush();

    expect(visibleKeys(menu)).toEqual(["tags", "alpha"]);
    expect(beta?.getAttribute("hidden")).toBe("");
    expect(beta?.getAttribute("aria-hidden")).toBe("true");
    expect(beta?.classList.contains("property-order-suggestion-hidden")).toBe(true);

    cleanup();
    expect(beta?.getAttribute("hidden")).toBeNull();
    expect(beta?.getAttribute("aria-hidden")).toBeNull();
    expect(beta?.classList.contains("property-order-suggestion-hidden")).toBe(false);
  });

  it("enhances a nested property-key menu once and restores it exactly", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.hiddenPropertyKeyPatterns = ["beta"];
    const { container, itemParent } = createNestedPropertyKeyMenu([
      "beta",
      "tags",
      "alpha",
    ]);
    const nativeElements = Array.from(
      itemParent.querySelectorAll<HTMLElement>(".suggestion-item"),
    );
    nativeElements[0]?.setAttribute("hidden", "until-found");
    nativeElements[0]?.setAttribute("aria-hidden", "false");
    nativeElements[1]?.classList.add("property-order-suggestion-hidden");
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(allKeys(container)).toEqual(["tags", "alpha", "beta"]);
    expect(visibleKeys(container)).toEqual(["tags", "alpha"]);
    expect(container.dataset.propertyOrderEnhanced).toBe("true");
    expect(itemParent.dataset.propertyOrderEnhanced).toBeUndefined();

    settings.enableNativeKeySuggestionOrder = false;
    controller.refresh();
    raf.flush();
    expect(Array.from(itemParent.children)).toEqual(nativeElements);
    expect(nativeElements[0]?.getAttribute("hidden")).toBe("until-found");
    expect(nativeElements[0]?.getAttribute("aria-hidden")).toBe("false");
    expect(
      nativeElements[0]?.classList.contains("property-order-suggestion-hidden"),
    ).toBe(false);
    expect(
      nativeElements[1]?.classList.contains("property-order-suggestion-hidden"),
    ).toBe(true);

    settings.enableNativeKeySuggestionOrder = true;
    controller.refresh();
    raf.flush();
    expect(allKeys(container)).toEqual(["tags", "alpha", "beta"]);

    cleanup();
    expect(Array.from(itemParent.children)).toEqual(nativeElements);
    expect(nativeElements[0]?.getAttribute("hidden")).toBe("until-found");
    expect(nativeElements[0]?.getAttribute("aria-hidden")).toBe("false");
    expect(
      nativeElements[0]?.classList.contains("property-order-suggestion-hidden"),
    ).toBe(false);
    expect(
      nativeElements[1]?.classList.contains("property-order-suggestion-hidden"),
    ).toBe(true);
    expect(container.dataset.propertyOrderEnhanced).toBeUndefined();
    expect(itemParent.dataset.propertyOrderEnhanced).toBeUndefined();
  });

  it("restores the latest native order when the host reorders reused item nodes", async () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["gamma"];
    const menu = createMenu(["alpha", "beta", "gamma"]);
    const elements = Array.from(menu.querySelectorAll<HTMLElement>(".suggestion-item"));
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(allKeys(menu)).toEqual(["gamma", "alpha", "beta"]);

    menu.append(elements[1]!, elements[0]!, elements[2]!);
    await settleMutations();
    raf.flush();
    expect(allKeys(menu)).toEqual(["gamma", "alpha", "beta"]);

    cleanup();
    expect(Array.from(menu.querySelectorAll(".suggestion-item"))).toEqual([
      elements[1],
      elements[0],
      elements[2],
    ]);
    expect(allKeys(menu)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("restores an appended native item when cleanup runs before the observer callback", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["gamma"];
    const menu = createMenu(["alpha", "beta", "gamma"]);
    const originalElements = Array.from(
      menu.querySelectorAll<HTMLElement>(".suggestion-item"),
    );
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(allKeys(menu)).toEqual(["gamma", "alpha", "beta"]);

    const appendedElement = document.createElement("div");
    appendedElement.className = "suggestion-item";
    appendedElement.textContent = "delta";
    menu.appendChild(appendedElement);
    cleanup();

    expect(Array.from(menu.querySelectorAll(".suggestion-item"))).toEqual([
      ...originalElements,
      appendedElement,
    ]);
    expect(allKeys(menu)).toEqual(["alpha", "beta", "gamma", "delta"]);
  });

  it("re-enhances a reused item when only its text node changes", async () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const menu = createMenu(["beta", "tags", "alpha"]);
    const originalElements = Array.from(menu.querySelectorAll<HTMLElement>(".suggestion-item"));
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    await settleMutations();
    raf.flush();

    const titleText = originalElements[1]?.querySelector(".suggestion-title")?.firstChild;
    expect(titleText?.nodeType).toBe(3);
    titleText!.textContent = "omega";
    await settleMutations();

    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(allKeys(menu)).toEqual(["alpha", "beta", "omega"]);

    cleanup();
    expect(Array.from(menu.querySelectorAll(".suggestion-item"))).toEqual(originalElements);
    expect(allKeys(menu)).toEqual(["beta", "omega", "alpha"]);
  });

  it("caches usage until metadata invalidation and coalesces each refresh", async () => {
    const settings = createDefaultSettings();
    settings.keySuggestionSortMode = "usage";
    const files = [{ path: "one.md" }, { path: "two.md" }] as TFile[];
    let favorAlpha = false;
    const metadataHandlers = new Map<string, () => void>();
    const getMarkdownFiles = vi.fn(() => files);
    const app = {
      metadataCache: {
        on: vi.fn((name: string, callback: () => void) => {
          metadataHandlers.set(name, callback);
          return {};
        }),
        getFileCache: vi.fn((file: TFile) => ({
          frontmatter: favorAlpha
            ? { alpha: true }
            : file === files[0]
              ? { beta: true }
              : { beta: true, alpha: true },
        })),
      },
      vault: { getMarkdownFiles },
    } as unknown as App;
    const firstMenu = createMenu(["alpha", "beta"]);
    const secondMenu = createMenu(["alpha", "beta"]);
    const raf = installRafHarness();
    const controller = createController(settings, app);
    const cleanup = controller.initialize();

    raf.flush();
    expect(getMarkdownFiles).toHaveBeenCalledTimes(1);
    expect(allKeys(firstMenu)).toEqual(["beta", "alpha"]);
    expect(allKeys(secondMenu)).toEqual(["beta", "alpha"]);

    await settleMutations();
    raf.flush();
    expect(getMarkdownFiles).toHaveBeenCalledTimes(1);

    controller.refresh();
    controller.refresh();
    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(getMarkdownFiles).toHaveBeenCalledTimes(1);

    favorAlpha = true;
    metadataHandlers.get("changed")?.();
    metadataHandlers.get("resolved")?.();
    expect(raf.pending()).toBe(1);
    raf.flush();
    expect(getMarkdownFiles).toHaveBeenCalledTimes(2);
    expect(allKeys(firstMenu)).toEqual(["alpha", "beta"]);
    expect(allKeys(secondMenu)).toEqual(["alpha", "beta"]);
    cleanup();
  });

  it("enhances existing and newly opened workspace windows and restores both", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const initialWindow = new HappyDomWindow();
    const openedWindow = new HappyDomWindow();
    const initialDocument = initialWindow.document as unknown as Document;
    const openedDocument = openedWindow.document as unknown as Document;
    const initialMenu = createMenu(
      ["beta", "tags", "alpha"],
      "key",
      initialDocument,
    );
    const openedMenu = createMenu(
      ["beta", "tags", "alpha"],
      "key",
      openedDocument,
    );
    const mainRaf = installRafHarness();
    const initialRaf = installRafHarness(initialWindow as unknown as Window);
    const openedRaf = installRafHarness(openedWindow as unknown as Window);
    const windowHandlers = new Map<
      string,
      (_workspaceWindow: unknown, targetWindow: Window) => void
    >();
    const app = {
      workspace: {
        iterateAllLeaves: vi.fn(
          (callback: (leaf: { view: { containerEl: HTMLElement } }) => void) => {
            callback({ view: { containerEl: initialDocument.body } });
          },
        ),
        on: vi.fn(
          (
            name: string,
            callback: (_workspaceWindow: unknown, targetWindow: Window) => void,
          ) => {
            windowHandlers.set(name, callback);
            return {};
          },
        ),
      },
    } as unknown as Partial<App>;
    const controller = createController(settings, app);
    const cleanup = controller.initialize();

    mainRaf.flush();
    initialRaf.flush();
    expect(allKeys(initialMenu)).toEqual(["tags", "alpha", "beta"]);

    windowHandlers.get("window-open")?.(null, openedWindow as unknown as Window);
    openedRaf.flush();
    expect(allKeys(openedMenu)).toEqual(["tags", "alpha", "beta"]);

    windowHandlers.get("window-close")?.(null, initialWindow as unknown as Window);
    expect(allKeys(initialMenu)).toEqual(["beta", "tags", "alpha"]);

    cleanup();
    expect(allKeys(openedMenu)).toEqual(["beta", "tags", "alpha"]);
    initialWindow.close();
    openedWindow.close();
  });

  it("bridges native keyboard selection onto the visible DOM order", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.bottomPropertyKeys = ["zeta"];
    settings.hiddenPropertyKeyPatterns = ["TQ_*"];
    const nativeKeys = ["zeta", "TQ_internal", "tags", "alpha"];
    const menu = createMenu(nativeKeys);
    const nativeElements = Array.from(
      menu.querySelectorAll<HTMLElement>(".suggestion-item"),
    );
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    editor.tabIndex = 0;
    editor.focus();
    let submittedKey: string | null = null;
    for (const [index, element] of nativeElements.entries()) {
      element.addEventListener("click", () => {
        submittedKey = nativeKeys[index] ?? null;
      });
    }
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(visibleKeys(menu)).toEqual(["tags", "alpha", "zeta"]);
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("tags");

    const moveDown = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    });
    editor.dispatchEvent(moveDown);
    expect(moveDown.defaultPrevented).toBe(true);
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("alpha");

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "End" }),
    );
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("zeta");

    editor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowDown" }),
    );
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("tags");

    menu.querySelector<HTMLElement>(".is-selected")?.classList.remove("is-selected");
    nativeElements[1]!.classList.add("is-selected");
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("TQ_internal");
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
    );
    expect(submittedKey).toBe("tags");

    cleanup();
  });

  it("submits the visible DOM selection instead of a stale host index", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.bottomPropertyKeys = ["zeta"];
    const menu = createMenu(["zeta", "tags", "alpha"]);
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    editor.tabIndex = 0;
    editor.focus();
    let submittedKey: string | null = null;
    const handleStaleNativeEnter = (event: KeyboardEvent): void => {
      if (event.key === "Enter") {
        submittedKey = "zeta";
      }
    };
    document.addEventListener("keydown", handleStaleNativeEnter);
    for (const item of menu.querySelectorAll<HTMLElement>(".suggestion-item")) {
      item.addEventListener("click", () => {
        submittedKey = item.textContent;
      });
    }
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(visibleKeys(menu)).toEqual(["tags", "alpha", "zeta"]);
    const enter = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    editor.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(submittedKey).toBe("tags");

    document.removeEventListener("keydown", handleStaleNativeEnter);
    cleanup();
  });

  it("supports the native macOS Ctrl+P and Ctrl+N navigation aliases", () => {
    Platform.isMacOS = true;
    const settings = createDefaultSettings();
    const menu = createMenu(["beta", "alpha"]);
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    editor.tabIndex = 0;
    editor.focus();
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "n",
      }),
    );
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("beta");
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "p",
      }),
    );
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("alpha");
    cleanup();
  });

  it("starts navigation at the nearest edge when native selection is absent", () => {
    const settings = createDefaultSettings();
    const menu = createMenu(["beta", "alpha"]);
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    editor.tabIndex = 0;
    editor.focus();
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    menu.querySelector<HTMLElement>(".is-selected")?.classList.remove("is-selected");
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowDown",
      }),
    );
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("alpha");

    menu.querySelector<HTMLElement>(".is-selected")?.classList.remove("is-selected");
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowUp",
      }),
    );
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("beta");
    cleanup();
  });

  it.each([
    ["Down", "beta"],
    ["Up", "beta"],
    ["Next", "beta"],
    ["Prior", "alpha"],
  ])("supports the legacy %s navigation key name", (key, expected) => {
    const settings = createDefaultSettings();
    const menu = createMenu(["beta", "alpha"]);
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    editor.tabIndex = 0;
    editor.focus();
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    editor.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
    }));
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe(expected);
    cleanup();
  });

  it("does not capture navigation after focus leaves the property-key editor", () => {
    const settings = createDefaultSettings();
    const menu = createMenu(["beta", "alpha"]);
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);
    editor.tabIndex = 0;
    editor.focus();
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    outsideButton.focus();
    const arrowDown = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    });
    outsideButton.dispatchEvent(arrowDown);
    expect(arrowDown.defaultPrevented).toBe(false);
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("alpha");
    cleanup();
  });

  it("blocks Enter when every native suggestion is hidden", () => {
    const settings = createDefaultSettings();
    settings.hiddenPropertyKeyPatterns = ["*"];
    const menu = createMenu(["beta", "alpha"]);
    const editor = menu.closest<HTMLElement>(".metadata-property-key")!;
    editor.tabIndex = 0;
    editor.focus();
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(visibleKeys(menu)).toEqual([]);
    const enter = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    editor.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    cleanup();
  });

  it("owns visible selection when the host ignores synthetic mouse movement", () => {
    const settings = createDefaultSettings();
    const property = document.createElement("div");
    property.className = "metadata-property";
    const editor = document.createElement("div");
    editor.className = "metadata-property-key";
    const menu = document.createElement("div");
    menu.className = "suggestion-container mod-property-key";

    for (const key of ["beta", "alpha"]) {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.textContent = key;
      menu.appendChild(item);
    }

    menu.firstElementChild?.classList.add("is-selected");
    editor.appendChild(menu);
    property.appendChild(editor);
    document.body.appendChild(property);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(allKeys(menu)).toEqual(["alpha", "beta"]);
    expect(menu.dataset.propertyOrderEnhanced).toBe("true");
    expect(menu.querySelector<HTMLElement>(".is-selected")?.textContent).toBe("alpha");
    cleanup();
  });

  it("leaves a property-value suggestion menu unchanged", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const menu = createMenu(["beta", "tags", "alpha"], "value");
    const original = Array.from(menu.children);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(Array.from(menu.children)).toEqual(original);
    expect(menu.dataset.propertyOrderEnhanced).toBeUndefined();
    cleanup();
  });

  it("leaves a generic menu unchanged while a property-key editor is focused", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    settings.hiddenPropertyKeyPatterns = ["beta"];
    const menu = createMenu(["beta", "tags", "alpha"]);
    menu.className = "menu";
    const editor = menu.closest<HTMLElement>(".metadata-property-key");
    editor!.tabIndex = 0;
    editor!.focus();
    const nativeElements = Array.from(menu.children);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(Array.from(menu.children)).toEqual(nativeElements);
    expect(menu.querySelectorAll("[hidden]")).toHaveLength(0);
    expect(menu.dataset.propertyOrderEnhanced).toBeUndefined();
    cleanup();
  });

  it("applies exact rules independently to names with repeated internal whitespace", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["a  b"];
    settings.hiddenPropertyKeyPatterns = ["a b"];
    const menu = createMenu(["zeta", "a b", "a  b"]);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(visibleKeys(menu)).toEqual(["a  b", "zeta"]);
    expect(allKeys(menu)).toEqual(["a  b", "zeta", "a b"]);
    cleanup();
  });

  it("leaves a non-Properties menu unchanged", () => {
    const settings = createDefaultSettings();
    settings.pinnedPropertyKeys = ["tags"];
    const menu = createMenu(["beta", "tags", "alpha"], "none");
    const original = Array.from(menu.children);
    const raf = installRafHarness();
    const controller = createController(settings);
    const cleanup = controller.initialize();

    raf.flush();
    expect(Array.from(menu.children)).toEqual(original);
    expect(menu.dataset.propertyOrderEnhanced).toBeUndefined();
    cleanup();
  });
});
