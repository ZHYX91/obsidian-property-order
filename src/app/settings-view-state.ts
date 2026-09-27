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
