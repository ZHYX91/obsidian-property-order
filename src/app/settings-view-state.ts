import { captureCandidatePages } from "./candidate-pages";

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
  const row = focused?.closest<HTMLElement>(".property-order-custom-value-item");
  const sectionId = row?.closest<HTMLElement>("[data-candidate-section]")?.dataset.candidateSection;
  const rowIndex = row?.parentElement ? Array.from(row.parentElement.children).indexOf(row) : -1;
  const restorePages = captureCandidatePages(container);
  update();
  restorePages();
  if (focusId != null) {
    const controls = Array.from(container.querySelectorAll<HTMLElement>("[data-settings-focus]:not(:disabled)"))
      .filter((element) => element.dataset.settingsFocusGroup === focusGroup);
    // A move can remove its own action. Continue from the moved item's first enabled control.
    let target = controls.find((element) => element.dataset.settingsFocus === focusId)
      ?? (focusGroup === undefined ? undefined : controls[0]);
    if (!target && sectionId && rowIndex >= 0) {
      const section = Array.from(container.querySelectorAll<HTMLElement>("[data-candidate-section]"))
        .find((candidate) => candidate.dataset.candidateSection === sectionId);
      const rows = section?.querySelectorAll<HTMLElement>(".property-order-custom-value-item");
      const neighbor = rows?.[Math.min(rowIndex, rows.length - 1)];
      const actions = Array.from(neighbor?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      target = actions.find((button) => button.textContent === focused?.textContent) ?? actions[0]
        ?? section?.querySelector<HTMLElement>(".property-order-custom-value-add input, select:not(:disabled)") ?? undefined;
    }
    target?.focus({ preventScroll: true });
  }
  for (const { element, top, left } of positions) {
    element.scrollTop = top;
    element.scrollLeft = left;
  }
}
