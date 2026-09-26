import type { PropertyValueSuggestionContext } from "../../obsidian/native-suggest-dom";

export interface CustomValuePopupMount {
  cleanup(): void;
  container: HTMLElement;
}

export function mountCustomValuePopup(
  context: PropertyValueSuggestionContext,
  values: readonly string[],
  onCommit: (value: string) => void,
): CustomValuePopupMount | null {
  const input = getPropertyValueInput(context);
  const targetWindow = context.editor.ownerDocument.defaultView;

  if (input == null || targetWindow == null) {
    return null;
  }

  const query = input.value.toLocaleLowerCase();
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

  const editorRect = context.editor.getBoundingClientRect();
  container.style.left = `${Math.round(editorRect.left)}px`;
  container.style.top = `${Math.round(editorRect.bottom)}px`;
  container.style.minWidth = `${Math.max(160, Math.round(editorRect.width))}px`;
  container.style.maxWidth = `${Math.max(200, targetWindow.innerWidth - 16)}px`;

  for (const [index, value] of visibleValues.entries()) {
    const item = container.createDiv({
      cls: index === 0 ? "suggestion-item is-selected" : "suggestion-item",
    });
    item.dataset.propertyOrderPresetValue = "true";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(index === 0));

    const title = item.createDiv({ cls: "suggestion-title" });
    title.textContent = value;
    item.addEventListener("mousedown", (event) => {
      // Keep the native property editor focused so its commit path remains the
      // authority for writing the selected preset value.
      event.preventDefault();
    });
    item.addEventListener("click", () => onCommit(value));
  }

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
    cleanup() {
      if (cleaned) {
        return;
      }
      cleaned = true;
      input.removeEventListener("keydown", handleTab, true);
      container.remove();
    },
  };
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
  input.value = value;
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
): HTMLInputElement | HTMLTextAreaElement | null {
  const targetWindow = context.editor.ownerDocument.defaultView;
  if (targetWindow == null) {
    return null;
  }

  if (context.editor.matches("input, textarea")) {
    return context.editor as HTMLInputElement | HTMLTextAreaElement;
  }

  return context.editor.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea",
  );
}
