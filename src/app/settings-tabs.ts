export type SettingsTabId = "general" | "valueDrag" | "keyOrder" | "valueSuggestions";

export interface SettingsTabDefinition {
  id: SettingsTabId;
  label: string;
}

export interface SettingsTabLayout {
  activeTabEl: HTMLButtonElement;
  readonly cleanup: () => void;
  panelEl: HTMLElement;
}

export interface SettingsTabScrollLayout {
  readonly clientWidth: number;
  readonly rightToLeft?: boolean;
  readonly scrollWidth: number;
  readonly scrollLeft: number;
  readonly tabOffsetLeft: number;
  readonly tabOffsetWidth: number;
}

let nextLayoutId = 0;

export function createSettingsTabLayout(
  containerEl: HTMLElement,
  tabs: SettingsTabDefinition[],
  activeTab: SettingsTabId,
  ariaLabel: string,
  scrollLabels: { readonly earlier: string; readonly later: string },
  onSelect: (tabId: SettingsTabId) => void,
): SettingsTabLayout {
  const layoutId = `property-order-settings-${++nextLayoutId}`;
  const panelId = `${layoutId}-panel`;
  const strip = containerEl.createDiv();
  strip.className = "property-order-settings-tab-strip";
  const tabBarEl = strip.createDiv();
  tabBarEl.className = "property-order-settings-tabs";
  tabBarEl.setAttribute("role", "tablist");
  tabBarEl.setAttribute("aria-label", ariaLabel);
  tabBarEl.setAttribute("aria-orientation", "horizontal");


  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.id === activeTab),
    0,
  );
  const buttons = tabs.map((tab, index) => {
    const buttonEl = tabBarEl.createEl("button");
    const isActive = index === activeIndex;
    buttonEl.className = isActive
      ? "property-order-settings-tab is-active"
      : "property-order-settings-tab";
    buttonEl.type = "button";
    buttonEl.textContent = tab.label;
    buttonEl.dataset.tabId = tab.id;
    buttonEl.id = `${layoutId}-tab-${tab.id}`;
    buttonEl.setAttribute("role", "tab");
    buttonEl.setAttribute("aria-selected", String(isActive));
    buttonEl.setAttribute("aria-controls", panelId);
    buttonEl.tabIndex = isActive ? 0 : -1;
    buttonEl.addEventListener("click", () => selectTab(tab.id, activeTab, buttonEl, onSelect));
    buttonEl.addEventListener("keydown", (event) => {
      const targetIndex = getKeyboardTargetIndex(
        event.key,
        index,
        tabs.length,
        isRightToLeft(buttonEl),
      );

      if (targetIndex == null) {
        return;
      }

      event.preventDefault();
      const targetTab = tabs[targetIndex];
      const targetButton = buttons[targetIndex];
      selectTab(targetTab.id, activeTab, targetButton, onSelect);
    });
    return buttonEl;
  });

  const panelEl = containerEl.createDiv();
  panelEl.className = "property-order-settings-panel";
  panelEl.id = panelId;
  panelEl.setAttribute("role", "tabpanel");
  panelEl.setAttribute("aria-labelledby", buttons[activeIndex].id);
  panelEl.tabIndex = 0;

  const activeTabEl = buttons[activeIndex];
  const targetWindow = containerEl.ownerDocument.defaultView;
  const revealActiveTab = (): void => {
    if (!tabBarEl.isConnected || !activeTabEl.isConnected) {
      return;
    }

    const tabBarRect = tabBarEl.getBoundingClientRect();
    const activeTabRect = activeTabEl.getBoundingClientRect();
    tabBarEl.scrollLeft = getSettingsTabScrollLeft({
      clientWidth: tabBarEl.clientWidth,
      rightToLeft: isRightToLeft(tabBarEl),
      scrollWidth: tabBarEl.scrollWidth,
      scrollLeft: tabBarEl.scrollLeft,
      tabOffsetLeft: activeTabRect.left - tabBarRect.left + tabBarEl.scrollLeft,
      tabOffsetWidth: activeTabRect.width,
    });
  };
  const cleanupOverflow = installTabOverflow(strip, tabBarEl, buttons, activeTabEl, scrollLabels);
  revealActiveTab();
  const animationFrameId = targetWindow?.requestAnimationFrame(revealActiveTab) ?? null;
  targetWindow?.addEventListener("resize", revealActiveTab);

  return {
    activeTabEl,
    cleanup: () => {
      cleanupOverflow();
      if (animationFrameId != null) {
        targetWindow?.cancelAnimationFrame(animationFrameId);
      }
      targetWindow?.removeEventListener("resize", revealActiveTab);
    },
    panelEl,
  };
}

export function getSettingsTabScrollLeft(layout: SettingsTabScrollLayout): number {
  const clientWidth = finiteNonNegative(layout.clientWidth);
  const scrollWidth = finiteNonNegative(layout.scrollWidth);
  const overflowWidth = Math.max(0, scrollWidth - clientWidth);
  const minScrollLeft = layout.rightToLeft ? -overflowWidth : 0;
  const maxScrollLeft = layout.rightToLeft ? 0 : overflowWidth;
  const current = clamp(
    Number.isFinite(layout.scrollLeft) ? layout.scrollLeft : 0,
    minScrollLeft,
    maxScrollLeft,
  );
  const tabStart = Number.isFinite(layout.tabOffsetLeft) ? layout.tabOffsetLeft : 0;
  const tabEnd = tabStart + finiteNonNegative(layout.tabOffsetWidth);

  if (tabStart < current) {
    return clamp(tabStart, minScrollLeft, maxScrollLeft);
  }

  if (tabEnd > current + clientWidth) {
    return clamp(tabEnd - clientWidth, minScrollLeft, maxScrollLeft);
  }

  return current;
}

function selectTab(
  tabId: SettingsTabId,
  activeTab: SettingsTabId,
  buttonEl: HTMLButtonElement,
  onSelect: (tabId: SettingsTabId) => void,
): void {
  if (tabId === activeTab) {
    focusSettingsTab(buttonEl);
    return;
  }

  onSelect(tabId);
}

export function focusSettingsTab(buttonEl: HTMLButtonElement): void {
  buttonEl.focus({ preventScroll: true });
}

function getKeyboardTargetIndex(
  key: string,
  index: number,
  length: number,
  rightToLeft: boolean,
): number | null {
  const inlineDirection = rightToLeft ? -1 : 1;
  if (key === "ArrowRight") {
    return (index + inlineDirection + length) % length;
  }

  if (key === "ArrowLeft") {
    return (index - inlineDirection + length) % length;
  }

  if (key === "Home") {
    return 0;
  }

  if (key === "End") {
    return length - 1;
  }

  return null;
}

function isRightToLeft(element: HTMLElement): boolean {
  const explicitDirection = element.closest<HTMLElement>("[dir]")?.dir;
  if (explicitDirection === "rtl") {
    return true;
  }
  if (explicitDirection === "ltr") {
    return false;
  }
  if (element.ownerDocument.documentElement.dir === "rtl") {
    return true;
  }
  return element.ownerDocument.defaultView?.getComputedStyle(element).direction === "rtl";
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

// The two gutters appear together only when the uncropped row overflows.
// Keeping them stable prevents the first or last tab from moving as a button hides.
function installTabOverflow(
  strip: HTMLElement,
  list: HTMLElement,
  tabs: readonly HTMLButtonElement[],
  active: HTMLButtonElement,
  labels: { readonly earlier: string; readonly later: string },
): () => void {
  const view = list.ownerDocument.defaultView;
  const earlier = scrollButton("earlier");
  const later = scrollButton("later");
  strip.prepend(earlier);
  strip.append(later);

  function scrollButton(direction: "earlier" | "later"): HTMLButtonElement {
    const button = strip.createEl("button");
    button.type = "button";
    button.className = "property-order-settings-tab-scroll";
    button.dataset.direction = direction;
    button.hidden = true;
    button.title = labels[direction];
    button.setAttribute("aria-label", labels[direction]);
    return button;
  }

  function distanceToEdge(tab: HTMLButtonElement, viewport: DOMRect, toLeft: boolean): number {
    const rect = tab.getBoundingClientRect();
    return toLeft ? viewport.left - rect.left : rect.right - viewport.right;
  }

  function firstClippedTab(toLeft: boolean): HTMLButtonElement | undefined {
    const viewport = list.getBoundingClientRect();
    if (viewport.width <= 0) return;
    let nearest = Infinity;
    let target: HTMLButtonElement | undefined;
    for (const tab of tabs) {
      const distance = distanceToEdge(tab, viewport, toLeft);
      if (distance <= 1 || distance >= nearest) continue;
      nearest = distance;
      target = tab;
    }
    return target;
  }

  function refresh(): void {
    const overflow = strip.clientWidth > 0 && list.scrollWidth > strip.clientWidth;
    strip.classList.toggle("has-overflow", overflow);
    const rtl = isRightToLeft(list);
    const focus = strip.ownerDocument.activeElement;
    const canScrollEarlier = overflow && firstClippedTab(!rtl) !== undefined;
    const canScrollLater = overflow && firstClippedTab(rtl) !== undefined;
    earlier.hidden = !canScrollEarlier;
    later.hidden = !canScrollLater;
    if ((focus === earlier && earlier.hidden) || (focus === later && later.hidden)) {
      const next = [earlier, later].find((button) => !button.hidden) ?? active;
      next.focus({ preventScroll: true });
    }
  }

  function scroll(event: MouseEvent): void {
    const rtl = isRightToLeft(list);
    const towardEarlier = event.currentTarget === earlier;
    const toLeft = towardEarlier ? !rtl : rtl;
    const target = firstClippedTab(toLeft);
    if (target === undefined) return;
    // Reveal the same tab after reserving space for the reverse control.
    const other = towardEarlier ? later : earlier;
    other.hidden = false;
    const viewport = list.getBoundingClientRect();
    const distance = Math.max(0, Math.min(distanceToEdge(target, viewport, toLeft), viewport.width));
    list.scrollLeft += toLeft ? -distance : distance;
    refresh();
  }

  earlier.addEventListener("click", scroll);
  later.addEventListener("click", scroll);
  list.addEventListener("scroll", refresh, { passive: true });
  view?.addEventListener("resize", refresh);
  const observer = view?.ResizeObserver && new view.ResizeObserver(refresh);
  observer?.observe(strip);
  for (const tab of tabs) observer?.observe(tab);
  refresh();
  return () => {
    earlier.removeEventListener("click", scroll);
    later.removeEventListener("click", scroll);
    list.removeEventListener("scroll", refresh);
    view?.removeEventListener("resize", refresh);
    observer?.disconnect();
  };
}
