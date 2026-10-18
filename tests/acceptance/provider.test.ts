// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { Window as HappyDomWindow } from "happy-dom";

import { afterEach, describe, expect, it, vi } from "vitest";

interface ProviderCommand {
  callback?: () => void;
  checkCallback?: (checking: boolean) => boolean;
  id: string;
  name: string;
}

interface ProviderRibbon {
  callback: () => void;
  icon: string;
  title: string;
}

class PluginHarness {
  app!: {
    setting?: { containerEl: HTMLElement };
    plugins?: {
      getPlugin: (id: string) => unknown;
    };
    vault?: {
      getAbstractFileByPath: (path: string) => unknown;
      read: (file: unknown) => Promise<string>;
      modify: (file: unknown, content: string) => Promise<unknown>;
      create: (path: string, content: string) => Promise<unknown>;
    };
    workspace: {
      getActiveViewOfType: () => unknown;
      iterateAllLeaves?: (callback: (leaf: { view: { containerEl: HTMLElement } }) => void) => void;
    };
  };
  conditionEvents!: Array<{ event: string; observation?: Array<{ tabBar: { direction: string; scrollLeft: number; tabs: unknown[] }; focused: { value: string; selectionStart: number }; menus: Array<{ nodeId: number; candidateCount: number; candidates: Array<{ nodeId: number }> }> }> }>;
  commands: ProviderCommand[] = [];
  cleanups: Array<() => void> = [];
  ribbons: ProviderRibbon[] = [];

  addCommand(command: ProviderCommand): void {
    this.commands.push(command);
  }

  addRibbonIcon(icon: string, title: string, callback: () => void): HTMLElement {
    this.ribbons.push({ callback, icon, title });
    return document.createElement("div");
  }

  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }
}

class MarkdownViewHarness {}

function loadProvider(): new () => PluginHarness & { onload: () => void } {
  const source = readFileSync(
    path.resolve(
      "acceptance/fixtures/.obsidian/plugins/property-order-acceptance-provider/main.js",
    ),
    "utf8",
  );
  const module = { exports: {} as unknown };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (specifier: string) => {
      if (specifier !== "obsidian") throw new Error(`Unexpected import: ${specifier}`);
      return {
        MarkdownView: MarkdownViewHarness,
        Notice: vi.fn(),
        Plugin: PluginHarness,
      };
    },
  });
  return module.exports as new () => PluginHarness & { onload: () => void };
}

function createFixture() {
  document.body.innerHTML = [
    '<div class="view"><div class="metadata-container">',
    '<div class="metadata-property" data-property-key="po_source">',
    '<div class="metadata-property-key"><input value="po_source"></div>',
    '<div class="multi-select-container"><div class="multi-select-pill">',
    '<span class="multi-select-pill-content">alpha</span></div></div></div>',
    '<div class="metadata-property" data-property-key="po_target"></div>',
    "</div></div>",
  ].join("");
  let content = [
    "---",
    "po_source: [alpha, beta]",
    "po_target: [gamma]",
    "po_unrelated: unchanged",
    "---",
    "Acceptance body marker.",
  ].join("\n");
  const editor = {
    getValue: () => content,
  };
  const setViewData = vi.fn((nextContent: string, _clear: boolean) => {
    content = nextContent;
  });
  const requestSave = vi.fn();
  return {
    editor,
    getContent: () => content,
    requestSave,
    setViewData,
    view: {
      containerEl: document.querySelector<HTMLElement>(".view"),
      editor,
      file: { path: "Property Order.md" },
      requestSave,
      setViewData,
    },
  };
}

describe("Property Order acceptance provider", () => {
  afterEach(() => vi.useRealTimers());

  function conditionProvider(path = "Value Suggestions.md") {
    const fixture = createFixture();
    fixture.view.file.path = path;
    const plugin = {
      saveData: vi.fn(async (_value: unknown) => undefined),
      saveSettings: vi.fn(async () => undefined),
      propertyOrderSettings: { language: "en" },
    };
    const provider = new (loadProvider())();
    provider.app = {
      plugins: { getPlugin: () => plugin },
      workspace: { getActiveViewOfType: () => fixture.view },
    };
    provider.onload();
    const command = (id: string) => provider.commands.find((item) => item.id === id)?.callback?.();
    return { command, plugin, provider };
  }

  it("delays only the next settings write and preserves its receiver and payload", async () => {
    vi.useFakeTimers();
    const { command, plugin } = conditionProvider();
    const original = plugin.saveData;
    command("arm-next-settings-save-delay");
    const payload = { draft: "first" };
    const pending = plugin.saveData(payload);
    expect(original).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(19_999);
    expect(original).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(original).toHaveBeenCalledExactlyOnceWith(payload);
    expect(original.mock.contexts[0]).toBe(plugin);
    expect(plugin.saveData).toBe(original);
    await plugin.saveData({ draft: "later" });
    expect(original).toHaveBeenCalledTimes(2);
  });

  it("releases a pending save and restores interception on unload", async () => {
    vi.useFakeTimers();
    const { command, plugin, provider } = conditionProvider();
    const original = plugin.saveData;
    command("arm-next-settings-save-delay");
    const pending = plugin.saveData("pending");
    provider.cleanups.forEach((cleanup) => cleanup());
    await pending;
    expect(plugin.saveData).toBe(original);
    expect(original).toHaveBeenCalledExactlyOnceWith("pending");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("expires unused interception without writing settings", async () => {
    vi.useFakeTimers();
    const { command, plugin } = conditionProvider();
    const original = plugin.saveData;
    command("arm-next-settings-save-delay");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(plugin.saveData).toBe(original);
    expect(original).not.toHaveBeenCalled();
  });

  it("switches language only after the scheduled interval through the refresh boundary", async () => {
    vi.useFakeTimers();
    const { command, plugin } = conditionProvider("Key Suggestions.md");
    command("schedule-language-zh-CN");
    expect(plugin.propertyOrderSettings.language).toBe("en");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(plugin.propertyOrderSettings.language).toBe("zh-CN");
    expect(plugin.saveSettings).toHaveBeenCalledExactlyOnceWith(true, true);
  });

  it("cancels pending language changes on unload and refuses other notes", async () => {
    vi.useFakeTimers();
    const { command, plugin, provider } = conditionProvider();
    command("schedule-language-zh-CN");
    provider.cleanups.forEach((cleanup) => cleanup());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(plugin.propertyOrderSettings.language).toBe("en");
    expect(plugin.saveSettings).not.toHaveBeenCalled();
    const other = conditionProvider("Ordinary.md");
    const original = other.plugin.saveData;
    other.command("schedule-language-zh-CN");
    other.command("arm-next-settings-save-delay");
    expect(other.plugin.saveData).toBe(original);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("injects foreign releases once after a frame and only after the source drag activates", () => {
    const fixture = createFixture();
    const foreignWindow = new HappyDomWindow();
    const provider = new (loadProvider())();
    const callbacks: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    provider.app = { workspace: {
      getActiveViewOfType: () => fixture.view,
      iterateAllLeaves: (callback) => callback({ view: {
        containerEl: foreignWindow.document.body as unknown as HTMLElement,
      } }),
    } };
    provider.onload();
    const up = vi.fn();
    const cancel = vi.fn();
    foreignWindow.document.addEventListener("pointerup", up);
    foreignWindow.document.addEventListener("pointercancel", cancel);
    provider.commands.find(({ id }) => id === "arm-foreign-pointer-condition")?.callback?.();
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 17, pointerType: "mouse" }));
    expect(up).not.toHaveBeenCalled();
    callbacks.shift()?.(0);
    expect(up).not.toHaveBeenCalled();
    document.querySelector(".multi-select-pill")?.classList.add("property-order-dragging");
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 17, pointerType: "mouse" }));
    callbacks.shift()?.(1);
    expect(up).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(up.mock.calls[0]?.[0]).toMatchObject({ pointerId: 17 });
    expect(up.mock.calls[0]?.[0].isTrusted).not.toBe(true);
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 17 }));
    expect(callbacks).toHaveLength(0);
    expect(fixture.setViewData).not.toHaveBeenCalled();
    provider.cleanups.forEach((cleanup) => cleanup());
    raf.mockRestore();
    foreignWindow.close();
  });

  it("refuses foreign injection without a second document and cancels an armed frame on unload", () => {
    const fixture = createFixture();
    const provider = new (loadProvider())();
    provider.app = { workspace: { getActiveViewOfType: () => fixture.view } };
    provider.onload();
    const command = provider.commands.find(({ id }) => id === "arm-foreign-pointer-condition");
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    command?.callback?.();
    document.dispatchEvent(new PointerEvent("pointermove"));
    expect(raf).not.toHaveBeenCalled();
    const foreignWindow = new HappyDomWindow();
    provider.app.workspace.iterateAllLeaves = (callback) => callback({ view: {
      containerEl: foreignWindow.document.body as unknown as HTMLElement,
    } });
    command?.callback?.();
    document.dispatchEvent(new PointerEvent("pointermove"));
    expect(raf).toHaveBeenCalledOnce();
    provider.cleanups.forEach((cleanup) => cleanup());
    expect(cancel).toHaveBeenCalledWith(7);
    document.dispatchEvent(new PointerEvent("pointermove"));
    expect(raf).toHaveBeenCalledOnce();
    raf.mockRestore();
    cancel.mockRestore();
    foreignWindow.close();
  });

  it("exports only condition evidence and refuses an unknown existing file", async () => {
    const { command, provider } = conditionProvider();
    const vault = {
      getAbstractFileByPath: vi.fn<() => unknown>(() => null),
      read: vi.fn(async () => "private existing content"),
      modify: vi.fn(async () => undefined),
      create: vi.fn(async (_path: string, _content: string) => undefined),
    };
    provider.app.vault = vault;
    await command("export-condition-events");
    expect(vault.create).toHaveBeenCalledOnce();
    expect(vault.create.mock.calls[0]?.[0]).toBe("Acceptance Conditions.json");
    expect(JSON.parse(vault.create.mock.calls[0]?.[1] ?? "{}")).toEqual({
      kind: "property-order-acceptance-conditions", events: [],
    });
    vault.getAbstractFileByPath.mockReturnValue({ path: "Acceptance Conditions.json" });
    await command("export-condition-events");
    expect(vault.modify).not.toHaveBeenCalled();
    expect(vault.create).toHaveBeenCalledOnce();
  });

  it("records delayed geometry, focus and stable menu identity without changing UI", async () => {
    vi.useFakeTimers();
    const { command, provider } = conditionProvider();
    const root = document.createElement("div");
    root.innerHTML = '<div class="property-order-settings-tabs" role="tablist" style="direction:rtl"><button class="property-order-settings-tab is-active" role="tab" aria-selected="true">General</button></div><input value="later draft"><div class="suggestion-container mod-property-key"><div class="suggestion-item">key</div></div>';
    document.body.append(root);
    const bar = root.querySelector<HTMLElement>("[role=tablist]")!;
    bar.scrollLeft = -15;
    const input = root.querySelector("input")!;
    input.focus();
    input.setSelectionRange(2, 4);
    command("capture-settings-geometry");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(provider.conditionEvents.filter(({ event }) => event === "read-only UI observation")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    const first = provider.conditionEvents.find(({ event }) => event === "read-only UI observation")?.observation?.[0];
    expect(first?.tabBar).toMatchObject({ direction: "rtl", scrollLeft: -15 });
    expect(first?.focused).toMatchObject({ value: "later draft", selectionStart: 2 });
    command("schedule-readonly-snapshot");
    await vi.advanceTimersByTimeAsync(3_000);
    const last = provider.conditionEvents.at(-1)?.observation?.[0];
    expect(last?.menus).toEqual(first?.menus);
    expect(last?.menus[0]?.candidateCount).toBe(1);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("later draft");
    expect(bar.scrollLeft).toBe(-15);
    command("capture-settings-geometry");
    provider.cleanups.forEach((cleanup) => cleanup());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("observes a detached host settings document even without a workspace leaf", async () => {
    vi.useFakeTimers();
    const { command, provider } = conditionProvider();
    const settingsWindow = new HappyDomWindow();
    settingsWindow.document.body.innerHTML = '<div class="property-order-settings-tabs" role="tablist"><button role="tab" class="property-order-settings-tab is-active">General</button></div>';
    provider.app.setting = { containerEl: settingsWindow.document.body as unknown as HTMLElement };
    command("schedule-readonly-snapshot");
    await vi.advanceTimersByTimeAsync(3_000);
    const observation = provider.conditionEvents.at(-1)?.observation;
    expect(observation).toHaveLength(2);
    expect(observation?.[1]?.tabBar.tabs).toHaveLength(1);
    provider.cleanups.forEach((cleanup) => cleanup());
    settingsWindow.close();
  });

  it("requests real window focus only after drag activation and removes observers on unload", () => {
    const fixture = createFixture();
    const targetWindow = new HappyDomWindow();
    const provider = new (loadProvider())();
    const sourceWindow = fixture.view.containerEl!.ownerDocument.defaultView!;
    const listeners = vi.spyOn(sourceWindow, "addEventListener");
    const callbacks: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const focus = vi.spyOn(targetWindow, "focus").mockImplementation(() => undefined);
    provider.app = { workspace: {
      getActiveViewOfType: () => fixture.view,
      iterateAllLeaves: (callback) => callback({ view: {
        containerEl: targetWindow.document.body as unknown as HTMLElement,
      } }),
    } };
    provider.onload();
    provider.commands.find(({ id }) => id === "arm-next-drag-focus-switch")?.callback?.();
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7 }));
    callbacks.shift()?.(0);
    expect(focus).not.toHaveBeenCalled();
    document.querySelector(".multi-select-pill")?.classList.add("property-order-dragging");
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7 }));
    expect(focus).not.toHaveBeenCalled();
    callbacks.shift()?.(1);
    expect(focus).toHaveBeenCalledOnce();
    expect(provider.conditionEvents.some(({ event }) => event === "source window blur observed")).toBe(false);
    // Unit-only stimulus validates observation, not a trusted host blur claim.
    const blurListener = listeners.mock.calls.find(([type]) => type === "blur")?.[1] as EventListener;
    blurListener({ target: sourceWindow, isTrusted: false } as unknown as Event);
    document.querySelector(".multi-select-pill")?.classList.remove("property-order-dragging");
    callbacks.shift()?.(2);
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7 }));
    expect(provider.conditionEvents.map(({ event }) => event)).toContain("source drag after blur frame");
    expect(provider.conditionEvents.map(({ event }) => event)).toContain("source pointerup after focus request");
    expect(fixture.setViewData).not.toHaveBeenCalled();
    provider.cleanups.forEach((cleanup) => cleanup());
    const count = provider.conditionEvents.length;
    fixture.view.containerEl!.ownerDocument.defaultView!.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7 }));
    expect(provider.conditionEvents).toHaveLength(count);
    expect(focus).toHaveBeenCalledOnce();
    listeners.mockRestore();
    raf.mockRestore();
    focus.mockRestore();
    targetWindow.close();
  });

  it("refuses a drag focus switch without a second workspace window", () => {
    const { command, provider } = conditionProvider("Property Order.md");
    command("arm-next-drag-focus-switch");
    expect(provider.conditionEvents.at(-1)?.event).toBe("focus switch refused: second workspace window required");
    provider.cleanups.forEach((cleanup) => cleanup());
  });

  it("prepares grouped key suggestions through the plugin settings boundary", async () => {
    const fixture = createFixture();
    const saveSettings = vi.fn(async () => undefined);
    const propertyOrderSettings = {
      enableNativeKeySuggestionOrder: false,
      groupKeySuggestionsByType: false,
      keySuggestionSortMode: "recent",
      pinnedPropertyKeys: [],
      bottomPropertyKeys: [],
      hiddenPropertyKeyPatterns: [],
    };
    const Provider = loadProvider();
    const provider = new Provider();
    provider.app = {
      plugins: {
        getPlugin: (id: string) =>
          id === "property-order"
            ? { propertyOrderSettings, saveSettings }
            : null,
      },
      workspace: { getActiveViewOfType: () => fixture.view },
    };
    provider.onload();

    const command = provider.commands.find(
      ({ id }) => id === "prepare-key-type-grouping",
    );
    const ribbon = provider.ribbons.find(
      ({ title }) => title === "Acceptance: prepare key type grouping",
    );

    expect(command?.callback).toBeTypeOf("function");
    expect(ribbon).toMatchObject({ icon: "list-tree" });
    await command?.callback?.();

    expect(propertyOrderSettings).toEqual({
      enableNativeKeySuggestionOrder: true,
      groupKeySuggestionsByType: true,
      keySuggestionSortMode: "name",
      pinnedPropertyKeys: ["tags"],
      bottomPropertyKeys: ["key_bottom"],
      hiddenPropertyKeyPatterns: ["key_hidden"],
    });
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(saveSettings).toHaveBeenCalledWith(true, false);
  });

  it("is inert until its explicit menu command dispatches one context-menu event", () => {
    const fixture = createFixture();
    const Provider = loadProvider();
    const provider = new Provider();
    provider.app = { workspace: { getActiveViewOfType: () => fixture.view } };
    provider.onload();
    const command = provider.commands.find(({ id }) => id === "open-first-source-value-menu");
    const observed = vi.fn();
    document.addEventListener("contextmenu", observed);

    expect(observed).not.toHaveBeenCalled();
    expect(command?.checkCallback?.(true)).toBe(true);
    expect(observed).not.toHaveBeenCalled();
    expect(command?.checkCallback?.(false)).toBe(true);
    expect(observed).toHaveBeenCalledOnce();
    expect(observed.mock.calls[0]?.[0]).toMatchObject({ bubbles: true, cancelable: true });
  });

  it.each(["command", "ribbon"] as const)(
    "injects and saves exactly one target edit through the %s entry point",
    (entryPoint) => {
    const fixture = createFixture();
    const Provider = loadProvider();
    const provider = new Provider();
    provider.app = { workspace: { getActiveViewOfType: () => fixture.view } };
    provider.onload();
    const command = provider.commands.find(({ id }) => id === "arm-next-drag-conflict");
    const ribbon = provider.ribbons.find(
      ({ title }) => title === "Acceptance: change target during next drag",
    );

    expect(command?.callback).toBeTypeOf("function");
    expect(ribbon).toMatchObject({ icon: "shield-alert" });
    if (entryPoint === "command") command?.callback?.();
    else ribbon?.callback();
    document.addEventListener("pointermove", () => {
      document.querySelector(".multi-select-pill")?.classList.add("property-order-dragging");
    }, { capture: true, once: true });
    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    expect(fixture.setViewData).not.toHaveBeenCalled();

    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));

    expect(fixture.setViewData).toHaveBeenCalledOnce();
    expect(fixture.setViewData).toHaveBeenCalledWith(fixture.getContent(), false);
    expect(fixture.requestSave).toHaveBeenCalledOnce();
    expect(fixture.getContent()).toBe([
      "---",
      "po_source: [alpha, beta]",
      "po_target: [blocked]",
      "po_unrelated: unchanged",
      "---",
      "Acceptance body marker.",
    ].join("\n"));
    },
  );
});
