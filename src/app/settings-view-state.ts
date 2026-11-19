// Keep the surrounding settings page stable during a local DOM update.
export function preserveSettingsView(container: HTMLElement, update: () => void): void {
  const positions: Array<{ element: HTMLElement; top: number; left: number }> = [];
  for (let element: HTMLElement | null = container; element != null; element = element.parentElement) {
    positions.push({ element, top: element.scrollTop, left: element.scrollLeft });
  }
  const active = container.ownerDocument.activeElement;
  const focusId = active instanceof (container.ownerDocument.defaultView?.HTMLElement ?? HTMLElement) && container.contains(active)
    ? active.dataset.settingsFocus
    : undefined;
  update();
  if (focusId != null) {
    Array.from(container.querySelectorAll<HTMLElement>("[data-settings-focus]"))
      .find((element) => element.dataset.settingsFocus === focusId)
      ?.focus({ preventScroll: true });
  }
  for (const { element, top, left } of positions) {
    element.scrollTop = top;
    element.scrollLeft = left;
  }
}

/** Carry only unsubmitted additions across a settings redraw, never stored fields. */
export function preserveValueSuggestionDrafts(
  container: HTMLElement, render: (draftBehaviors: ReadonlySet<string>) => void,
): void {
  const draftSelector = ".property-order-value-behavior-input, .property-order-custom-value-add input";
  const drafts = new Map<string, { value: string; start: number | null; end: number | null; direction: HTMLInputElement["selectionDirection"] }>();
  const draftBehaviors = new Set<string>();
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement>(draftSelector))) {
    const id = input.dataset.settingsFocus;
    if (id == null || (!input.value && input !== container.ownerDocument.activeElement)) continue;
    drafts.set(id, { value: input.value, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection });
    const behavior = input.closest<HTMLElement>("[data-behavior]")?.dataset.behavior;
    if (behavior) draftBehaviors.add(behavior);
  }
  preserveSettingsView(container, () => render(draftBehaviors));
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement>(draftSelector))) {
    const draft = drafts.get(input.dataset.settingsFocus ?? "");
    if (!draft) continue;
    input.value = draft.value;
    input.setSelectionRange(draft.start, draft.end, draft.direction ?? "none");
  }
}
