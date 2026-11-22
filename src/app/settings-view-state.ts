// Keep the surrounding settings page stable during a local DOM update.
export function preserveSettingsView(container: HTMLElement, update: () => void): void {
  const positions: Array<{ element: HTMLElement; top: number; left: number }> = [];
  for (let element: HTMLElement | null = container; element != null; element = element.parentElement) {
    positions.push({ element, top: element.scrollTop, left: element.scrollLeft });
  }
  const active = container.ownerDocument.activeElement;
  // Obsidian's settings popout adopts nodes created in the opener's JavaScript realm.
  const focused = container.contains(active) ? active : null;
  const focusId = focused?.getAttribute("data-settings-focus");
  const focusGroup = focused?.getAttribute("data-settings-focus-group") ?? undefined;
  update();
  if (focusId != null) {
    const controls = Array.from(container.querySelectorAll<HTMLElement>("[data-settings-focus]:not(:disabled)"))
      .filter((element) => element.dataset.settingsFocusGroup === focusGroup);
    // A move can remove its own action. Continue from the moved item's first enabled control.
    const target = controls.find((element) => element.dataset.settingsFocus === focusId)
      ?? (focusGroup === undefined ? undefined : controls[0]);
    target?.focus({ preventScroll: true });
  }
  for (const { element, top, left } of positions) {
    element.scrollTop = top;
    element.scrollLeft = left;
  }
}
