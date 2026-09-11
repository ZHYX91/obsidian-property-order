export type SettingsTabId = "general" | "valueDrag" | "keyOrder" | "valueSuggestions";

export interface SettingsTabDefinition {
  id: SettingsTabId;
  label: string;
}

export interface SettingsTabLayout {
  activeTabEl: HTMLButtonElement;
  cleanup(): void;
  panelEl: HTMLElement;
}

export function createSettingsTabLayout(
  containerEl: HTMLElement,
  tabs: readonly SettingsTabDefinition[],
  activeTab: SettingsTabId,
  ariaLabel: string,
  onSelect: (tabId: SettingsTabId) => void,
): SettingsTabLayout {
  const targetDocument = containerEl.ownerDocument;
  const targetWindow = targetDocument.defaultView ?? window;
  const tabListEl = containerEl.createDiv({ cls: "property-order-settings-tabs" });
  tabListEl.setAttribute("role", "tablist");
  tabListEl.setAttribute("aria-label", ariaLabel);
  tabListEl.setAttribute("aria-orientation", "horizontal");
  const panelEl = containerEl.createDiv({ cls: "property-order-settings-panel" });
  panelEl.setAttribute("role", "tabpanel");
  panelEl.tabIndex = 0;
  const instanceId = createSettingsTabInstanceId();
  panelEl.id = `property-order-settings-panel-${instanceId}`;
  const tabElements = new Map<SettingsTabId, HTMLButtonElement>();

  for (const tab of tabs) {
    const buttonEl = tabListEl.createEl("button", {
      cls: "property-order-settings-tab",
      text: tab.label,
      type: "button",
    });
    const selected = tab.id === activeTab;
    buttonEl.id = `property-order-settings-tab-${instanceId}-${tab.id}`;
    buttonEl.setAttribute("role", "tab");
    buttonEl.setAttribute("aria-controls", panelEl.id);
    buttonEl.setAttribute("aria-selected", String(selected));
    buttonEl.tabIndex = selected ? 0 : -1;
    buttonEl.addEventListener("click", () => {
      if (tab.id !== activeTab) {
        onSelect(tab.id);
      }
    });
    buttonEl.addEventListener("keydown", (event) => {
      const targetTabId = getKeyboardTargetTab(
        event,
        tabs,
        tab.id,
        getComputedDirection(tabListEl),
      );

      if (targetTabId == null) {
        return;
      }

      event.preventDefault();
      onSelect(targetTabId);
    });
    tabElements.set(tab.id, buttonEl);
  }

  const activeTabEl = tabElements.get(activeTab) ?? tabElements.values().next().value;

  if (activeTabEl == null) {
    throw new Error("Property Order settings require at least one tab.");
  }

  panelEl.setAttribute("aria-labelledby", activeTabEl.id);
  activeTabEl.setAttribute("aria-selected", "true");
  activeTabEl.tabIndex = 0;

  const ensureActiveTabVisible = (): void => {
    scrollTabIntoView(tabListEl, activeTabEl);
  };
  const animationFrameId = targetWindow.requestAnimationFrame(ensureActiveTabVisible);
  targetWindow.addEventListener("resize", ensureActiveTabVisible);

  return {
    activeTabEl,
    cleanup: () => {
      targetWindow.cancelAnimationFrame(animationFrameId);
      targetWindow.removeEventListener("resize", ensureActiveTabVisible);
    },
    panelEl,
  };
}

export function focusSettingsTab(tabEl: HTMLElement): void {
  tabEl.focus({ preventScroll: true });
}

function getKeyboardTargetTab(
  event: KeyboardEvent,
  tabs: readonly SettingsTabDefinition[],
  currentTab: SettingsTabId,
  direction: "ltr" | "rtl",
): SettingsTabId | null {
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);

  if (currentIndex < 0 || tabs.length === 0) {
    return null;
  }

  if (event.key === "Home") {
    return tabs[0]?.id ?? null;
  }

  if (event.key === "End") {
    return tabs.at(-1)?.id ?? null;
  }

  const normalizedKey = event.key === "Left"
    ? "ArrowLeft"
    : event.key === "Right"
      ? "ArrowRight"
      : event.key;

  if (normalizedKey !== "ArrowLeft" && normalizedKey !== "ArrowRight") {
    return null;
  }

  const forward = direction === "rtl"
    ? normalizedKey === "ArrowLeft"
    : normalizedKey === "ArrowRight";
  const delta = forward ? 1 : -1;
  return tabs[(currentIndex + delta + tabs.length) % tabs.length]?.id ?? null;
}

function getComputedDirection(element: HTMLElement): "ltr" | "rtl" {
  const targetWindow = element.ownerDocument.defaultView ?? window;
  return targetWindow.getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";
}

function scrollTabIntoView(
  tabListEl: HTMLElement,
  activeTabEl: HTMLElement,
): void {
  const nextScrollLeft = getSettingsTabScrollLeft({
    clientWidth: tabListEl.clientWidth,
    scrollLeft: tabListEl.scrollLeft,
    scrollWidth: tabListEl.scrollWidth,
    tabOffsetLeft: activeTabEl.offsetLeft,
    tabOffsetWidth: activeTabEl.offsetWidth,
  });

  if (Math.abs(nextScrollLeft - tabListEl.scrollLeft) > 0.5) {
    tabListEl.scrollLeft = nextScrollLeft;
  }
}

export function getSettingsTabScrollLeft(layout: {
  clientWidth: number;
  scrollLeft: number;
  scrollWidth: number;
  tabOffsetLeft: number;
  tabOffsetWidth: number;
}): number {
  const clientWidth = Math.max(0, finiteOrZero(layout.clientWidth));
  const scrollWidth = Math.max(clientWidth, finiteOrZero(layout.scrollWidth));
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const currentScrollLeft = clamp(finiteOrZero(layout.scrollLeft), 0, maxScrollLeft);
  const tabStart = clamp(finiteOrZero(layout.tabOffsetLeft), 0, scrollWidth);
  const tabEnd = clamp(
    tabStart + Math.max(0, finiteOrZero(layout.tabOffsetWidth)),
    0,
    scrollWidth,
  );
  const viewportStart = currentScrollLeft;
  const viewportEnd = currentScrollLeft + clientWidth;

  if (tabStart < viewportStart) {
    return clamp(tabStart, 0, maxScrollLeft);
  }

  if (tabEnd > viewportEnd) {
    return clamp(tabEnd - clientWidth, 0, maxScrollLeft);
  }

  return currentScrollLeft;
}

let nextSettingsTabInstanceId = 1;

function createSettingsTabInstanceId(): number {
  const instanceId = nextSettingsTabInstanceId;
  nextSettingsTabInstanceId += 1;
  return instanceId;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
