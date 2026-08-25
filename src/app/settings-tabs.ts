export type SettingsTabId = "general" | "valueDrag" | "keyOrder";

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
  readonly scrollWidth: number;
  readonly scrollLeft: number;
  readonly tabOffsetLeft: number;
  readonly tabOffsetWidth: number;
}

export function createSettingsTabLayout(
  containerEl: HTMLElement,
  tabs: SettingsTabDefinition[],
  activeTab: SettingsTabId,
  ariaLabel: string,
  onSelect: (tabId: SettingsTabId) => void,
): SettingsTabLayout {
  const tabBarEl = containerEl.createDiv();
  tabBarEl.className = "property-order-settings-tabs";
  tabBarEl.setAttribute("role", "tablist");
  tabBarEl.setAttribute("aria-label", ariaLabel);
  tabBarEl.setAttribute("aria-orientation", "horizontal");
  containerEl.appendChild(tabBarEl);

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
    buttonEl.id = getTabElementId(tab.id);
    buttonEl.setAttribute("role", "tab");
    buttonEl.setAttribute("aria-selected", String(isActive));
    buttonEl.setAttribute("aria-controls", getPanelElementId(tab.id));
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

  const activeDefinition = tabs[activeIndex];
  const panelEl = containerEl.createDiv();
  panelEl.className = "property-order-settings-panel";
  panelEl.id = getPanelElementId(activeDefinition.id);
  panelEl.setAttribute("role", "tabpanel");
  panelEl.setAttribute("aria-labelledby", getTabElementId(activeDefinition.id));
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
      scrollWidth: tabBarEl.scrollWidth,
      scrollLeft: tabBarEl.scrollLeft,
      tabOffsetLeft: activeTabRect.left - tabBarRect.left + tabBarEl.scrollLeft,
      tabOffsetWidth: activeTabRect.width,
    });
  };
  revealActiveTab();
  const animationFrameId = targetWindow?.requestAnimationFrame(revealActiveTab) ?? null;
  targetWindow?.addEventListener("resize", revealActiveTab);

  return {
    activeTabEl,
    cleanup: () => {
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
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const current = clamp(finiteNonNegative(layout.scrollLeft), 0, maxScrollLeft);
  const tabStart = Number.isFinite(layout.tabOffsetLeft) ? layout.tabOffsetLeft : 0;
  const tabEnd = tabStart + finiteNonNegative(layout.tabOffsetWidth);

  if (tabStart < current) {
    return clamp(tabStart, 0, maxScrollLeft);
  }

  if (tabEnd > current + clientWidth) {
    return clamp(tabEnd - clientWidth, 0, maxScrollLeft);
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

function getTabElementId(tabId: SettingsTabId): string {
  return `property-order-settings-tab-${tabId}`;
}

function getPanelElementId(tabId: SettingsTabId): string {
  return `property-order-settings-panel-${tabId}`;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
