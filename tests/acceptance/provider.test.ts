// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it, vi } from "vitest";

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
    workspace: {
      getActiveViewOfType: () => unknown;
    };
  };
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
