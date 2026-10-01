import type { PropertyValueSuggestionContext } from "../../obsidian/native-suggest-dom";

export interface CustomValuePopupMount {
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
  const visibleValues = values.filter(
    (value) => query.length === 0 || value.toLocaleLowerCase().includes(query),
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
  const itemValues: Array<{ element: HTMLElement; value: string }> = [];

  for (const [index, value] of visibleValues.entries()) {
    const isSelected = index === selectedIndex;
    const item = container.createDiv({
      cls: isSelected ? "suggestion-item is-selected" : "suggestion-item",
    });
    itemValues.push({ element: item, value });
    item.dataset.propertyOrderPresetValue = "true";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(isSelected));

    const title = item.createDiv({ cls: "suggestion-title" });
    title.textContent = value;
    item.addEventListener("mousedown", (event) => {
      // Keep the native property editor focused so its commit path remains the
      // authority for writing the selected preset value.
      event.preventDefault();
    });
    item.addEventListener("click", () => onCommit(value));
  }

  const position = (event?: Event): void => {
    // Scrolling the candidate list must retain its scroll position; only
    // surrounding layout changes move the popup's anchor.
    if (event?.type === "scroll" && event.target instanceof targetWindow.Node &&
      container.contains(event.target)) {
      return;
    }
    positionCustomValuePopup(container, context.editor, targetWindow);
  };
  position();
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
    getSelectedValue() {
      return itemValues.find(({ element }) =>
        element.classList.contains("is-selected") &&
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true"
      )?.value ?? null;
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

  if (input == null || targetWindow == null || !context.editor.isConnected) {
    return false;
  }

  input.focus({ preventScroll: true });
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

  const keydown = new targetWindow.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: "Enter",
    key: "Enter",
  });
  Reflect.set(keydown, "propertyOrderPresetCommit", true);
  input.dispatchEvent(keydown);
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

export function getPropertyValueInputText(input: HTMLElement | null): string {
  if (input == null) return "";
  return input.matches("input, textarea")
    ? (input as HTMLInputElement | HTMLTextAreaElement).value
    : input.textContent ?? "";
}
