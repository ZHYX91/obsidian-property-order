import type { TranslationKey } from "../shared/i18n";
import type { CustomCandidatePlacement } from "../core/suggestions/custom-value-order";

const PAGE_SIZE = 32;

interface CandidatePage {
  id: string;
  page: number;
  restore(previousPage: number, focusGroup: string | null, value: string | null): void;
}

const mountedPages = new WeakMap<HTMLElement, CandidatePage>();

// A settings redraw replaces the whole candidate editor. Restore its pages before
// the existing focus restorer looks for the moved candidate's action button.
export function captureCandidatePages(container: HTMLElement): () => void {
  const findLists = () => container.querySelectorAll<HTMLElement>(".property-order-paged-candidates");
  const pages = new Map<string, number>();
  for (const list of findLists()) {
    const state = mountedPages.get(list);
    if (state) pages.set(state.id, state.page);
  }
  const active = container.ownerDocument.activeElement;
  const focused = container.contains(active) ? active : null;
  const focusGroup = focused?.getAttribute("data-settings-focus-group") ?? null;
  const value = focused?.closest(".property-order-custom-value-item")
    ?.querySelector(".property-order-custom-value-label")?.textContent ?? null;
  return () => {
    for (const list of findLists()) {
      const state = mountedPages.get(list);
      if (state) state.restore(pages.get(state.id) ?? 0, focusGroup, value);
    }
  };
}

export function renderCandidatePages<T extends { value: string }>(
  list: HTMLElement,
  values: readonly T[],
  propertyKey: string,
  placement: CustomCandidatePlacement,
  t: (key: TranslationKey) => string,
  renderRow: (value: T, index: number) => void,
): void {
  if (values.length <= PAGE_SIZE) {
    values.forEach(renderRow);
    return;
  }

  const id = JSON.stringify([propertyKey, placement]);
  const count = Math.ceil(values.length / PAGE_SIZE);
  list.classList.add("property-order-paged-candidates");
  const nav = list.createDiv({ cls: "property-order-candidate-pages" });
  list.before(nav);
  const previous = nav.createEl("button", { text: t("settings.valueSuggestions.custom.previousPage") });
  previous.type = "button";
  previous.dataset.settingsFocus = `previous:${id}`;
  const label = nav.createEl("label");
  label.createSpan({ text: t("settings.valueSuggestions.custom.page") });
  const pageNumber = label.createEl("input", { attr: { type: "number", min: "1", max: String(count), step: "1" } });
  pageNumber.dataset.settingsFocus = `page:${id}`;
  label.createSpan({ text: `/ ${count}` });
  const next = nav.createEl("button", { text: t("settings.valueSuggestions.custom.nextPage") });
  next.type = "button";
  next.dataset.settingsFocus = `next:${id}`;

  const state: CandidatePage = {
    id,
    page: -1,
    restore(previousPage, focusGroup, value) {
      if (value !== null && focusGroup === JSON.stringify([propertyKey, value])) {
        const index = values.findIndex((item) => item.value === value);
        if (index >= 0) {
          showPage(Math.floor(index / PAGE_SIZE));
          return;
        }
      }
      showPage(previousPage);
    },
  };
  function showPage(requested: number): void {
    const page = Math.max(0, Math.min(count - 1, requested));
    pageNumber.value = String(page + 1);
    if (page === state.page) return;
    state.page = page;
    const active = nav.ownerDocument.activeElement;
    previous.disabled = page === 0;
    next.disabled = page === count - 1;
    list.replaceChildren();
    const start = page * PAGE_SIZE;
    for (let index = start; index < Math.min(start + PAGE_SIZE, values.length); index++) {
      renderRow(values[index], index);
    }
    if ((previous.disabled && active === previous) || (next.disabled && active === next)) {
      pageNumber.focus({ preventScroll: true });
    }
  }
  previous.addEventListener("click", () => showPage(state.page - 1));
  next.addEventListener("click", () => showPage(state.page + 1));
  const choosePage = (): void => {
    const requested = pageNumber.valueAsNumber;
    showPage(Number.isInteger(requested) ? requested - 1 : state.page);
  };
  pageNumber.addEventListener("change", choosePage);
  pageNumber.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      choosePage();
    }
  });
  mountedPages.set(list, state);
  showPage(0);
}
