import { normalizePropertyKeyIdentity } from "../../core/suggestions/property-names";
import { getActivePropertyValueSuggestionContext, type PropertyValueSuggestionContext } from "../../obsidian/native-suggest-dom";

import { renderCustomValueList } from "./custom-value-list";

export interface CustomValuePopupMount {
  navigate(target: (current: number, count: number, pageSize: number) => number): boolean;
  cleanup(): void;
  container: HTMLElement;
  editor: HTMLElement;
  getSelectedValue(): string | null;
  propertyKey: string;
  query: string;
}

export function mountCustomValuePopup(
  context: PropertyValueSuggestionContext,
  values: readonly string[],
  onCommit: (value: string) => void,
  selectedValue: string | null = null,
): CustomValuePopupMount | null {
  const input = getPropertyValueInput(context);
  const targetWindow = context.editor.ownerDocument.defaultView;

  if (input == null || targetWindow == null) {
    return null;
  }

  const rawQuery = getPropertyValueInputText(input);
  const query = rawQuery.toLocaleLowerCase();
  const acceptsValue = getCustomValueValidator(input);
  const visibleValues = values.filter(
    (value) => (query.length === 0 || value.toLocaleLowerCase().includes(query)) && acceptsValue(value),
  );

  if (visibleValues.length === 0) {
    return null;
  }

  const container = context.editor.ownerDocument.body.createDiv({
    cls: "suggestion-container property-order-custom-value-popup",
  });
  container.dataset.propertyOrderValueEnhanced = "true";
  container.setAttribute("role", "listbox");

  const selectedIndex = Math.max(0, visibleValues.indexOf(selectedValue ?? ""));
  const list = renderCustomValueList(container, input, visibleValues, selectedIndex, onCommit);

  const position = (event?: Event): void => {
    // Scrolling the candidate list must retain its scroll position; only
    // surrounding layout changes move the popup's anchor.
    if (event?.type === "scroll" && event.target instanceof targetWindow.Node &&
      container.contains(event.target)) {
      return;
    }
    const reveal = list.preparePosition();
    positionCustomValuePopup(container, context.editor, targetWindow);
    list.finishPosition(reveal);
  };
  position();
  const stopObservingSize = list.observeSize(() => position());
  targetWindow.addEventListener("resize", position);
  context.editor.ownerDocument.addEventListener("scroll", position, true);
  const viewport = targetWindow.visualViewport;
  viewport?.addEventListener("resize", position);
  viewport?.addEventListener("scroll", position);

  const handleTab = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    if (
      keyboardEvent.key !== "Tab" ||
      keyboardEvent.shiftKey ||
      keyboardEvent.altKey ||
      keyboardEvent.ctrlKey ||
      keyboardEvent.metaKey ||
      keyboardEvent.isComposing
    ) {
      return;
    }

    const selected = container.querySelector<HTMLElement>(
      ".suggestion-item.is-selected:not([hidden])",
    );
    selected?.click();
  };
  input.addEventListener("keydown", handleTab, true);

  let cleaned = false;
  return {
    container,
    editor: context.editor,
    propertyKey: context.propertyKey,
    query: rawQuery,
    navigate: (target) => list.navigate(target),
    getSelectedValue() {
      const selected = container.querySelector<HTMLElement>('.is-selected:not([hidden]):not([aria-hidden="true"])');
      return selected ? visibleValues[Number(selected.dataset.propertyOrderIndex)] : null;
    },
    cleanup() {
      if (cleaned) {
        return;
      }
      cleaned = true;
      input.removeEventListener("keydown", handleTab, true);
      targetWindow.removeEventListener("resize", position);
      context.editor.ownerDocument.removeEventListener("scroll", position, true);
      viewport?.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
      stopObservingSize();
      list.cleanup();
      container.remove();
    },
  };
}

function positionCustomValuePopup(
  container: HTMLElement,
  editor: HTMLElement,
  targetWindow: Window,
): void {
  const viewport = targetWindow.visualViewport;
  const width = viewport?.width ?? targetWindow.innerWidth;
  const height = viewport?.height ?? targetWindow.innerHeight;
  const inset = Math.min(8, width / 2, height / 2);
  const left = (viewport?.offsetLeft ?? 0) + inset;
  const top = (viewport?.offsetTop ?? 0) + inset;
  const right = left + Math.max(0, width - inset * 2);
  const bottom = top + Math.max(0, height - inset * 2);
  const editorRect = editor.getBoundingClientRect();
  const availableWidth = right - left;

  container.style.minWidth = `${Math.min(availableWidth, Math.max(160, editorRect.width))}px`;
  container.style.maxWidth = `${availableWidth}px`;
  container.style.maxHeight = `${Math.min(320, height / 2)}px`;

  const popupRect = container.getBoundingClientRect();
  const below = Math.max(0, bottom - Math.max(top, editorRect.bottom));
  const above = Math.max(0, Math.min(bottom, editorRect.top) - top);
  const placeBelow = below >= popupRect.height || below >= above;
  const availableHeight = placeBelow ? below : above;
  const popupHeight = Math.min(popupRect.height, availableHeight);
  const popupTop = placeBelow ? editorRect.bottom : editorRect.top - popupHeight;

  container.style.maxHeight = `${Math.min(320, height / 2, availableHeight)}px`;
  container.style.left = `${Math.min(Math.max(left, editorRect.left), Math.max(left, right - popupRect.width))}px`;
  container.style.top = `${Math.min(Math.max(top, popupTop), bottom - popupHeight)}px`;
}

export function commitCustomPropertyValueCandidate(
  context: PropertyValueSuggestionContext,
  value: string,
): boolean {
  const input = getPropertyValueInput(context);
  const targetWindow = context.editor.ownerDocument.defaultView;

  if (input == null || targetWindow == null || !context.editor.isConnected ||
    !getCustomValueValidator(input)(value)) {
    return false;
  }

  const stillEditingProperty = (): boolean => {
    const current = getActivePropertyValueSuggestionContext(input.ownerDocument);
    return current?.editor === context.editor && current.row === context.row &&
      normalizePropertyKeyIdentity(current.propertyKey) === normalizePropertyKeyIdentity(context.propertyKey) &&
      getPropertyValueInput(current) === input;
  };
  input.focus({ preventScroll: true });
  if (!stillEditingProperty()) return false;
  if (input.matches("input, textarea")) {
    (input as HTMLInputElement | HTMLTextAreaElement).value = value;
  } else {
    input.textContent = value;
  }
  input.dispatchEvent(new targetWindow.InputEvent("input", {
    bubbles: true,
    data: value,
    inputType: "insertText",
  }));

  // The host can consume this input or start another draft in the same editor.
  if (!stillEditingProperty() || getPropertyValueInputText(input) !== value) return false;
  const keydown = new targetWindow.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: "Enter",
    key: "Enter",
  });
  Reflect.set(keydown, "propertyOrderPresetCommit", true);
  input.dispatchEvent(keydown);
  if (!stillEditingProperty()) return true;
  input.dispatchEvent(new targetWindow.KeyboardEvent("keyup", {
    bubbles: true,
    code: "Enter",
    key: "Enter",
  }));
  return true;
}

export function getPropertyValueInput(
  context: PropertyValueSuggestionContext,
): HTMLElement | null {
  const targetWindow = context.editor.ownerDocument.defaultView;
  if (targetWindow == null) {
    return null;
  }

  const selector = "input, textarea, [contenteditable=true]";
  const active = context.editor.ownerDocument.activeElement;
  if (active instanceof targetWindow.HTMLElement &&
    context.editor.contains(active) && active.matches(selector)) {
    return active;
  }

  return context.editor.matches(selector)
    ? context.editor
    : context.editor.querySelector<HTMLElement>(selector);
}

export function getCustomValueValidator(input: HTMLElement | null): (value: string) => boolean {
  if (input == null || input.matches(":disabled, [readonly]")) return () => false;
  if (!input.matches("input, textarea")) {
    const editable = input.matches("[contenteditable=true]");
    return () => editable;
  }

  // Test on a detached control. Assigning an incompatible preset to the live
  // editor can silently turn its existing value into an empty string.
  const probe = input.cloneNode(false) as HTMLInputElement | HTMLTextAreaElement;
  if (probe.tagName === "INPUT" && !CUSTOM_VALUE_INPUT_TYPES.has(probe.type)) return () => false;
  // These single-line input types remove only CR/LF. A text comparison avoids
  // setting a detached input once for every matching vocabulary entry.
  if (probe.tagName === "INPUT" && ["text", "search", "tel"].includes(probe.type)) {
    return (value) => !/[\r\n]/.test(value);
  }
  return (value) => {
    probe.value = value;
    return probe.value === value && (probe.type !== "number" || Number.isFinite(Number(value)));
  };
}

const CUSTOM_VALUE_INPUT_TYPES = new Set([
  "text", "search", "tel", "url", "email", "number",
  "date", "datetime-local", "month", "time", "week",
]);

export function getPropertyValueInputText(input: HTMLElement | null): string {
  if (input == null) return "";
  return input.matches("input, textarea")
    ? (input as HTMLInputElement | HTMLTextAreaElement).value
    : input.textContent ?? "";
}
