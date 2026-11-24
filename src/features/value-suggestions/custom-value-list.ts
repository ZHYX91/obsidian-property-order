type TargetIndex = (current: number, count: number, pageSize: number) => number;

const WINDOW_SIZE = 32;
let nextPopupId = 0;

export function renderCustomValueList(
  container: HTMLElement,
  input: HTMLElement,
  values: readonly string[],
  initialIndex: number,
  onCommit: (value: string) => void,
) {
  const view = container.ownerDocument.defaultView!;
  const windowed = values.length > WINDOW_SIZE;
  const list = windowed ? container.createDiv({ cls: "property-order-windowed-values" }) : container;
  const fontProbe = windowed ? container.createDiv({ cls: "property-order-value-font-probe" }) : null;
  fontProbe?.setAttribute("aria-hidden", "true");
  const rows = new Map<number, HTMLElement>();
  const id = `property-order-values-${++nextPopupId}`;
  const previousControls = input.getAttribute("aria-controls");
  const previousActive = input.getAttribute("aria-activedescendant");
  let selected = initialIndex;
  let rowHeight = 32;
  let firstRendered = -1;
  let lastViewportHeight: number | null = null;
  container.id = id;
  input.setAttribute("aria-controls", [previousControls, id].filter(Boolean).join(" "));
  input.setAttribute("aria-activedescendant", `${id}-${selected}`);

  const addRow = (index: number): void => {
    if (rows.has(index)) return;
    const value = values[index];
    const row = list.createDiv({ cls: "suggestion-item" });
    rows.set(index, row);
    row.classList.toggle("is-selected", index === selected);
    row.dataset.propertyOrderPresetValue = "true";
    row.dataset.propertyOrderIndex = String(index);
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(index === selected));
    row.id = `${id}-${index}`;
    if (windowed) {
      row.setAttribute("aria-setsize", String(values.length));
      row.setAttribute("aria-posinset", String(index + 1));
      row.style.top = `${index * rowHeight}px`;
      row.style.height = `${rowHeight}px`;
      row.title = value;
    }
    row.createDiv({ cls: "suggestion-title" }).textContent = value;
  };

  const renderWindow = (): void => {
    const first = Math.max(0, Math.min(values.length - WINDOW_SIZE,
      Math.floor((container.scrollTop - list.offsetTop) / rowHeight) - 4));
    if (first === firstRendered) return;
    firstRendered = first;
    for (const [index, row] of rows) {
      if (index !== selected && (index < first || index >= first + WINDOW_SIZE)) {
        row.remove();
        rows.delete(index);
      }
    }
    for (let index = first; index < first + WINDOW_SIZE; index++) addRow(index);
    addRow(selected);
    // Keep DOM reading order aligned with aria-posinset after scrolling up or down.
    let next: HTMLElement | null = null;
    for (const index of [...rows.keys()].sort((a, b) => b - a)) {
      const row = rows.get(index)!;
      if (row.nextElementSibling !== next) list.insertBefore(row, next);
      next = row;
    }
    input.setAttribute("aria-activedescendant", `${id}-${selected}`);
  };

  const selectedBounds = (): { top: number; height: number } => {
    if (windowed) return { top: list.offsetTop + selected * rowHeight, height: rowHeight };
    const row = rows.get(selected)!;
    return { top: row.offsetTop, height: row.offsetHeight };
  };

  const revealSelection = (): void => {
    const { top: offset, height: itemHeight } = selectedBounds();
    const height = container.clientHeight || rowHeight;
    if (offset < container.scrollTop) container.scrollTop = offset;
    else if (offset + itemHeight > container.scrollTop + height) {
      container.scrollTop = offset + itemHeight - height;
    }
    if (windowed) {
      firstRendered = -1;
      renderWindow();
    }
  };

  const resize = (): void => {
    if (!windowed) return;
    const fontSize = Number.parseFloat(view.getComputedStyle(container).fontSize) || 16;
    const newHeight = Math.max(24, Math.ceil(fontSize * 2.2));
    if (rowHeight !== newHeight) {
      rowHeight = newHeight;
      for (const [index, row] of rows) {
        row.style.top = `${index * rowHeight}px`;
        row.style.height = `${rowHeight}px`;
      }
    }
    list.style.height = `${values.length * rowHeight}px`;
    renderWindow();
  };

  if (windowed) {
    resize();
    container.addEventListener("scroll", renderWindow);
  } else {
    for (let index = 0; index < values.length; index++) addRow(index);
  }

  const rowForEvent = (event: Event) => event.target instanceof view.Element
    ? event.target.closest<HTMLElement>("[data-property-order-index]") : null;
  container.addEventListener("mousedown", (event) => {
    if (rowForEvent(event)) event.preventDefault();
  });
  container.addEventListener("click", (event) => {
    const row = rowForEvent(event);
    if (row != null) onCommit(values[Number(row.dataset.propertyOrderIndex)]);
  });

  return {
    preparePosition(): boolean {
      const { top, height } = selectedBounds();
      const wasVisible = lastViewportHeight == null ||
        (top >= container.scrollTop && top + height <= container.scrollTop + lastViewportHeight);
      resize();
      return wasVisible;
    },
    finishPosition(reveal: boolean): void {
      lastViewportHeight = container.clientHeight;
      if (reveal) revealSelection();
    },
    observeSize(position: () => void): () => void {
      if (!view.ResizeObserver) return () => undefined;
      const observer = new view.ResizeObserver(position);
      if (fontProbe) observer.observe(fontProbe);
      observer.observe(container);
      return () => observer.disconnect();
    },
    navigate(target: TargetIndex): boolean {
      const old = rows.get(selected);
      const height = windowed ? rowHeight : old?.getBoundingClientRect().height ?? 0;
      const pageSize = height > 0 ? Math.max(1, Math.floor(container.clientHeight / height) - 1) : 1;
      old?.setAttribute("aria-selected", "false");
      old?.classList.remove("is-selected");
      selected = target(selected, values.length, pageSize);
      revealSelection();
      const active = rows.get(selected)!;
      input.setAttribute("aria-activedescendant", active.id);
      active.setAttribute("aria-selected", "true");
      active.classList.add("is-selected");
      return true;
    },
    cleanup(): void {
      if (windowed) container.removeEventListener("scroll", renderWindow);
      if (input.getAttribute("aria-activedescendant") === `${id}-${selected}`) {
        if (previousActive == null) input.removeAttribute("aria-activedescendant");
        else input.setAttribute("aria-activedescendant", previousActive);
      }
      const controls = (input.getAttribute("aria-controls") ?? "").split(/\s+/)
        .filter((value) => value && value !== id);
      if (controls.length) input.setAttribute("aria-controls", controls.join(" "));
      else input.removeAttribute("aria-controls");
    },
  };
}
