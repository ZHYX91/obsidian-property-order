// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Window as HappyDomWindow } from "happy-dom";
import type { Keymap } from "obsidian";

import { registerSuggestionKeyboardBridge } from "../../../src/features/key-order/suggestion-keyboard-bridge";

function createContainer(hidden = false): HTMLElement {
  const container = document.createElement("div");
  container.className = "suggestion-container";

  for (const value of ["alpha", "beta"]) {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = value;
    item.hidden = hidden;
    container.appendChild(item);
  }

  container.firstElementChild?.classList.add("is-selected");
  document.body.appendChild(container);
  return container;
}

function createExactValueContainer(values: readonly string[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "suggestion-container";

  for (const value of values) {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    const title = document.createElement("div");
    title.className = "suggestion-title";
    title.textContent = value;
    item.appendChild(title);
    container.appendChild(item);
  }

  container.firstElementChild?.classList.add("is-selected");
  document.body.appendChild(container);
  return container;
}

const listenerCleanups = new Set<() => void>();

describe("suggestion keyboard bridge", () => {
  beforeEach(() => document.body.replaceChildren());
  afterEach(() => {
    for (const cleanup of listenerCleanups) cleanup();
    listenerCleanups.clear();
    vi.restoreAllMocks();
  });

  it("owns the host scope before native selection and releases it on cleanup", () => {
    const container = createContainer();
    const selected = container.querySelector<HTMLElement>(".suggestion-item")!;
    const click = vi.spyOn(selected, "click");
    let currentScope: { handler: (event: KeyboardEvent) => boolean | void } | null = null;
    const nativeCommit = vi.fn();
    const hostListener = (event: KeyboardEvent): void => {
      if (currentScope != null) {
        if (currentScope.handler(event) === false) event.stopPropagation();
      } else {
        nativeCommit();
      }
    };
    window.addEventListener("keydown", hostListener, true);
    const keymap = {
      pushScope: vi.fn((scope) => { currentScope = scope; }),
      popScope: vi.fn(() => { currentScope = null; }),
    };
    const cleanup = registerSuggestionKeyboardBridge({
      keymap: keymap as unknown as Keymap,
      getActiveContainer: () => container,
      hasActiveContext: () => true,
      onSynchronizationFailure: vi.fn(),
      supportsEmacsNavigation: false,
      targetWindow: window,
    });
    cleanup.synchronizeScope(true);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true, cancelable: true, key: "Enter",
    }));
    expect(click).toHaveBeenCalledOnce();
    expect(nativeCommit).not.toHaveBeenCalled();
    const synthetic = new KeyboardEvent("keydown", { key: "Enter" });
    Reflect.set(synthetic, "propertyOrderPresetCommit", true);
    window.dispatchEvent(synthetic);
    expect(click).toHaveBeenCalledOnce();
    cleanup.synchronizeScope(false);
    expect(keymap.popScope).toHaveBeenCalled();
    cleanup();
    window.removeEventListener("keydown", hostListener, true);
  });

  it("reports Escape intent before a host capture layer consumes the forwarded event", () => {
    const container = createContainer();
    const editor = document.createElement("input");
    document.body.appendChild(editor);
    editor.focus();

    let currentScope: { handler: ((event: KeyboardEvent) => boolean | void) | null } | null = null;
    let physicalEscape: KeyboardEvent | null = null;
    const swallowedForwardedEscape = vi.fn();
    const onEscapeIntent = vi.fn();
    const hostCapture = (event: KeyboardEvent): void => {
      if (event !== physicalEscape) {
        swallowedForwardedEscape();
        event.stopImmediatePropagation();
        return;
      }

      const handled = currentScope?.handler?.(event);
      if (handled === false) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", hostCapture, true);
    listenerCleanups.add(() => window.removeEventListener("keydown", hostCapture, true));

    const keymap = {
      pushScope: vi.fn((scope) => {
        currentScope = scope as { handler: ((event: KeyboardEvent) => boolean | void) | null };
      }),
      popScope: vi.fn(() => {
        currentScope = null;
      }),
    };
    const options = {
      keymap: keymap as unknown as Keymap,
      getActiveContainer: () => container,
      hasActiveContext: () => true,
      onEscapeIntent,
      onSynchronizationFailure: vi.fn(),
      supportsEmacsNavigation: false,
      targetWindow: window,
    } as Parameters<typeof registerSuggestionKeyboardBridge>[0] & {
      onEscapeIntent: (event: KeyboardEvent) => void;
    };
    const cleanup = registerSuggestionKeyboardBridge(options);
    listenerCleanups.add(cleanup);
    cleanup.synchronizeScope(true);

    physicalEscape = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Escape",
      key: "Escape",
    });
    editor.dispatchEvent(physicalEscape);

    expect(swallowedForwardedEscape).toHaveBeenCalledOnce();
    expect(onEscapeIntent).toHaveBeenCalledOnce();
    expect(onEscapeIntent).toHaveBeenCalledWith(physicalEscape);
    expect(keymap.popScope).toHaveBeenCalledOnce();

    cleanup();
    window.removeEventListener("keydown", hostCapture, true);
  });

  it.each(["Enter", "Tab", "ArrowDown", "Escape"])(
    "leaves another window's %s event alone even if this document owns the shared scope",
    (key) => {
      const container = createContainer();
      const first = container.querySelector<HTMLElement>(".suggestion-item")!;
      const click = vi.spyOn(first, "click");
      const scopes: Array<{ handler: ((event: KeyboardEvent) => boolean | void) | null }> = [];
      const keymap = {
        pushScope: vi.fn((scope) => { scopes.push(scope); }),
        popScope: vi.fn(() => { scopes.pop(); }),
      };
      const onActivationIntent = vi.fn();
      const onEscapeIntent = vi.fn();
      const keyboard = registerSuggestionKeyboardBridge({
        keymap: keymap as unknown as Keymap,
        getActiveContainer: () => container,
        hasActiveContext: () => true,
        onActivationIntent,
        onEscapeIntent,
        onSynchronizationFailure: vi.fn(),
        supportsEmacsNavigation: false,
        targetWindow: window,
      });
      listenerCleanups.add(keyboard);
      keyboard.synchronizeScope(true);

      const otherWindow = new HappyDomWindow();
      const input = otherWindow.document.createElement("input");
      otherWindow.document.body.appendChild(input);
      input.focus();
      otherWindow.addEventListener("keydown", (event) => {
        scopes.at(-1)?.handler?.(event as unknown as KeyboardEvent);
      }, true);

      try {
        const event = new otherWindow.KeyboardEvent("keydown", {
          bubbles: true, cancelable: true, key,
        });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        expect(click).not.toHaveBeenCalled();
        expect(onActivationIntent).not.toHaveBeenCalled();
        expect(onEscapeIntent).not.toHaveBeenCalled();
        expect(keymap.popScope).not.toHaveBeenCalled();
        expect(container.querySelector(".is-selected")).toBe(first);

        window.dispatchEvent(new KeyboardEvent("keydown", {
          bubbles: true, cancelable: true, key: "Enter",
        }));
        expect(click).toHaveBeenCalledOnce();
      } finally {
        otherWindow.close();
      }
    },
  );

  it("ignores internal preset commit Enter events", () => {
    const container = createContainer(false);
    const onActivationIntent = vi.fn();
    const firstItem = container.querySelector<HTMLElement>(".suggestion-item");
    const click = vi.spyOn(firstItem!, "click");
    const cleanup = registerSuggestionKeyboardBridge({
      getActiveContainer: () => container,
      hasActiveContext: () => true,
      onActivationIntent,
      onSynchronizationFailure: vi.fn(),
      supportsEmacsNavigation: false,
      targetWindow: window,
    });

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    Reflect.set(event, "propertyOrderPresetCommit", true);
    window.dispatchEvent(event);

    expect(onActivationIntent).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    cleanup();
  });

  it("activates plugin-owned preset candidates on unmodified Tab", () => {
    const container = createContainer(false);
    const selected = container.querySelector<HTMLElement>(".suggestion-item");
    selected!.dataset.propertyOrderPresetValue = "true";
    const click = vi.spyOn(selected!, "click");
    const onActivationIntent = vi.fn();
    const cleanup = registerSuggestionKeyboardBridge({
      getActiveContainer: () => container,
      hasActiveContext: () => true,
      onActivationIntent,
      onSynchronizationFailure: vi.fn(),
      supportsEmacsNavigation: false,
      targetWindow: window,
    });

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onActivationIntent).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    cleanup();
  });

  it("does not treat modified Tab as a candidate activation", () => {
    const container = createContainer(false);
    const onActivationIntent = vi.fn();
    const cleanup = registerSuggestionKeyboardBridge({
      getActiveContainer: () => container,
      hasActiveContext: () => true,
      onActivationIntent,
      onSynchronizationFailure: vi.fn(),
      supportsEmacsNavigation: false,
      targetWindow: window,
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
    expect(onActivationIntent).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(onActivationIntent).toHaveBeenCalledOnce();
    cleanup();
  });

  it("navigates and activates whitespace-only and near-label candidates by element identity", () => {
    const values = [" ", "\u00a0", "\u3000", "alpha", " alpha", "alpha "];
    const container = createExactValueContainer(values);
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(".suggestion-item"),
    );
    const clicks = items.map((item) => vi.spyOn(item, "click"));
    const onActivationIntent = vi.fn();
    const keymap = {
      popScope: vi.fn(),
      pushScope: vi.fn(),
    };
    const cleanup = registerSuggestionKeyboardBridge({
      keymap: keymap as unknown as Keymap,
      getActiveContainer: () => container,
      hasActiveContext: () => true,
      onActivationIntent,
      onSynchronizationFailure: vi.fn(),
      supportsEmacsNavigation: false,
      targetWindow: window,
    });

    const enter = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });
    window.dispatchEvent(enter);
    expect(clicks[0]).toHaveBeenCalledOnce();
    expect(onActivationIntent).toHaveBeenLastCalledWith(
      items[0],
      "enter",
      enter,
    );

    items.forEach((item, index) => item.classList.toggle("is-selected", index === 0));
    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    }));
    expect(items[1]?.classList.contains("is-selected")).toBe(true);

    items.forEach((item, index) => item.classList.toggle("is-selected", index === 2));
    const tab = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    window.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(clicks[2]).toHaveBeenCalledOnce();
    expect(onActivationIntent).toHaveBeenLastCalledWith(
      items[2],
      "tab",
      tab,
    );

    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    }));
    expect(items[3]?.classList.contains("is-selected")).toBe(true);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    }));
    expect(items[4]?.classList.contains("is-selected")).toBe(true);
    expect(items[4]?.textContent).toBe(" alpha");

    cleanup();
  });
});
