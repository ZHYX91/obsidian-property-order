// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("suggestion keyboard bridge", () => {
  beforeEach(() => document.body.replaceChildren());
  afterEach(() => vi.restoreAllMocks());

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
});
