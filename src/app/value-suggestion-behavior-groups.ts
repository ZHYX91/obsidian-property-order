import { Setting, type App } from "obsidian";

import {
  getPropertyValueBehavior,
  groupPropertyValueBehaviors,
  movePropertyValueBehavior,
  removePropertyValueBehavior,
} from "../core/suggestions/value-behavior";
import { getPropertyNameSuggestions } from "../core/suggestions/property-names";
import { getCachedPropertyKeyUsage } from "../obsidian/metadata";
import type {
  PropertyValueBehaviorAssignment,
  ValueSuggestionBehavior,
  ValueSuggestionKeyDisplayOrder,
} from "../shared/types";
import type { TranslationKey } from "../shared/i18n";
import { preserveSettingsView } from "./settings-view-state";
import { PropertyBehaviorSuggest } from "./property-behavior-suggest";

export interface ValueSuggestionBehaviorGroupsOptions {
  app: App;
  containerEl: HTMLElement;
  customOrderKeys: readonly string[];
  displayOrder: ValueSuggestionKeyDisplayOrder;
  getAssignments: () => readonly PropertyValueBehaviorAssignment[];
  onAssignmentsChange: (assignments: PropertyValueBehaviorAssignment[]) => Promise<void>;
  onDisplayOrderChange: (displayOrder: ValueSuggestionKeyDisplayOrder) => Promise<void>;
  renderCustomEditor?: (container: HTMLElement) => void;
  t: (key: TranslationKey) => string;
}

export interface ValueSuggestionBehaviorGroupsLifecycle {
  close(): void;
}

export function renderValueSuggestionBehaviorGroups(
  options: ValueSuggestionBehaviorGroupsOptions,
): ValueSuggestionBehaviorGroupsLifecycle {
  const cards = new Map<ValueSuggestionBehavior, {
    section: HTMLElement;
    input: HTMLInputElement;
    refresh(): void;
    close(): void;
  }>();
  let displayOrder = options.displayOrder;
  let closed = false;
  let availableKeys: string[] | null = null;
  const behaviors = groupPropertyValueBehaviors([], displayOrder).map((group) => group.behavior);
  const getAvailableKeys = (): string[] => {
    availableKeys ??= getPropertyNameSuggestions(
      getCachedPropertyKeyUsage(options.app).map((item) => item.key), [], "",
    );
    return availableKeys;
  };
  const refresh = (): void => {
    if (closed) return;
    preserveSettingsView(options.containerEl, () => {
      for (const card of cards.values()) card.refresh();
      updateAddOptions();
    });
  };
  new Setting(options.containerEl)
    .setName(options.t("settings.valueSuggestions.keyDisplayOrder.name"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("name", options.t("settings.valueSuggestions.keyDisplayOrder.byName"))
        .addOption("recent", options.t("settings.valueSuggestions.keyDisplayOrder.recent"))
        .setValue(displayOrder)
        .onChange((value) => {
          if (value !== "name" && value !== "recent") return;
          void options.onDisplayOrderChange(value).then(() => {
            displayOrder = value;
            refresh();
          });
        });
    });
  const cardList = options.containerEl.createDiv();
  const addRow = options.containerEl.createDiv({ cls: "property-order-value-behavior-add" });
  const addChoice = addRow.createEl("select");
  addChoice.setAttribute("aria-label", options.t("settings.valueSuggestions.card.behavior"));
  const addCardButton = addRow.createEl("button");
  addCardButton.type = "button";
  addCardButton.textContent = options.t("settings.valueSuggestions.card.add");
  const updateAddOptions = (): void => {
    const previous = addChoice.value;
    addChoice.replaceChildren();
    for (const behavior of behaviors.filter((value) => !cards.has(value))) {
      const option = addChoice.createEl("option");
      option.value = behavior;
      option.textContent = getBehaviorLabel(options.t, behavior);
    }
    if (Array.from(addChoice.options).some((option) => option.value === previous)) {
      addChoice.value = previous;
    }
    addRow.hidden = cards.size === behaviors.length;
  };
  const mountCard = (behavior: ValueSuggestionBehavior): void => {
    if (cards.has(behavior) || closed) return;
    const section = cardList.createDiv({ cls: "property-order-value-behavior-group" });
    section.dataset.behavior = behavior;
    const header = section.createDiv({ cls: "property-order-value-behavior-group-header" });
    const label = header.createEl("label");
    label.textContent = options.t("settings.valueSuggestions.card.behavior");
    const select = label.createEl("select");
    select.dataset.settingsFocus = `behavior:${behavior}`;
    for (const value of behaviors) {
      const option = select.createEl("option");
      option.value = value;
      option.textContent = getBehaviorLabel(options.t, value);
    }
    select.value = behavior;
    const count = header.createSpan({ cls: "property-order-value-behavior-group-count" });
    const closeEmpty = header.createEl("button");
    closeEmpty.type = "button";
    closeEmpty.textContent = "×";
    closeEmpty.setAttribute("aria-label", options.t("settings.valueSuggestions.card.close"));
    closeEmpty.addEventListener("click", () => {
      if (options.getAssignments().some((item) => item.behavior === behavior)) return;
      preserveSettingsView(options.containerEl, () => {
        cards.get(behavior)?.close();
        cards.delete(behavior);
        section.remove();
        updateAddOptions();
        addCardButton.focus({ preventScroll: true });
      });
    });
    const chips = section.createDiv({ cls: "property-order-value-behavior-chips" });
    const add = section.createDiv({ cls: "property-order-value-behavior-add" });
    const input = add.createEl("input");
    input.type = "text";
    input.placeholder = options.t("settings.valueSuggestions.addProperty.placeholder");
    input.setAttribute("aria-label", input.placeholder);
    input.className = "property-order-value-behavior-input";
    input.dataset.settingsFocus = `add:${behavior}`;
    const addButton = add.createEl("button");
    addButton.type = "button";
    addButton.textContent = options.t("settings.valueSuggestions.addProperty.button");
    const custom = section.createDiv();
    let pending = false;
    const save = async (next: PropertyValueBehaviorAssignment[], after: () => void): Promise<void> => {
      if (pending || closed) return;
      pending = true;
      try {
        await options.onAssignmentsChange(next);
        if (!closed) after();
      } finally {
        pending = false;
      }
    };
    const addProperty = async (rawKey: string): Promise<void> => {
      const key = rawKey.trim();
      if (!key || pending || closed) return;
      const current = getPropertyValueBehavior(options.getAssignments(), key);
      if (current != null && current !== behavior &&
        section.ownerDocument.defaultView?.confirm(options.t("settings.valueSuggestions.moveConfirm")
          .replace("{property}", key)
          .replace("{from}", getBehaviorLabel(options.t, current))
          .replace("{to}", getBehaviorLabel(options.t, behavior))) !== true) return;
      if (current === behavior) {
        input.value = "";
        input.focus({ preventScroll: true });
        return;
      }
      await save(movePropertyValueBehavior(options.getAssignments(), key, behavior).nextAssignments, () => {
        input.value = "";
        refresh();
        input.focus({ preventScroll: true });
      });
    };
    const suggester = new PropertyBehaviorSuggest(options.app, input, {
      customOrderKeys: options.customOrderKeys,
      getAlreadyHereLabel: () => options.t("settings.valueSuggestions.behavior.alreadyHere"),
      getAssignments: options.getAssignments,
      getAvailableKeys,
      getBehaviorLabel: (value) => getBehaviorLabel(options.t, value),
      getFollowDefaultLabel: () => options.t("settings.valueSuggestions.behavior.followDefault"),
      onSelect: addProperty,
      targetBehavior: behavior,
    });
    addButton.addEventListener("click", () => void addProperty(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      void addProperty(input.value);
    });
    select.addEventListener("change", () => {
      const nextBehavior = behaviors.find((value) => value === select.value);
      if (nextBehavior == null || nextBehavior === behavior || pending) return;
      const next = options.getAssignments().map((assignment) =>
        assignment.behavior === behavior ? { ...assignment, behavior: nextBehavior } : assignment);
      void save(next, () => {
        preserveSettingsView(options.containerEl, () => {
          mountCard(nextBehavior);
          suggester.close();
          cards.delete(behavior);
          section.remove();
          refresh();
          cards.get(nextBehavior)?.input.focus({ preventScroll: true });
        });
      });
    });
    cards.set(behavior, {
      section, input, close: () => suggester.close(),
      refresh() {
        const keys = groupPropertyValueBehaviors(options.getAssignments(), displayOrder)
          .find((group) => group.behavior === behavior)?.propertyKeys ?? [];
        closeEmpty.hidden = keys.length !== 0;
        count.textContent = options.t("settings.valueSuggestions.card.count").replace("{count}", String(keys.length));
        // Detached nodes keep the live card height stable until the atomic swap.
        const nextChips = section.createDiv();
        nextChips.remove();
        for (const key of keys) {
          const chip = nextChips.createSpan();
          chip.className = "property-order-value-behavior-chip";
          chip.createSpan().textContent = key;
          const remove = chip.createEl("button");
          remove.type = "button";
          remove.className = "property-order-value-behavior-chip-remove";
          remove.setAttribute("aria-label", options.t("settings.valueSuggestions.card.remove").replace("{property}", key));
          remove.textContent = "×";
          remove.addEventListener("click", () => void save(
            removePropertyValueBehavior(options.getAssignments(), key),
            () => { refresh(); input.focus({ preventScroll: true }); },
          ));
          nextChips.appendChild(chip);
        }
        chips.replaceChildren(...Array.from(nextChips.childNodes));
        if (behavior === "custom") options.renderCustomEditor?.(custom);
      },
    });
  };
  addCardButton.addEventListener("click", () => {
    const behavior = behaviors.find((value) => value === addChoice.value);
    if (behavior == null) return;
    mountCard(behavior);
    refresh();
    cards.get(behavior)?.input.focus({ preventScroll: true });
  });
  for (const group of groupPropertyValueBehaviors(options.getAssignments(), displayOrder)) {
    if (group.propertyKeys.length > 0) mountCard(group.behavior);
  }
  refresh();
  return {
    close() {
      closed = true;
      for (const card of cards.values()) card.close();
    },
  };
}

export function getBehaviorLabel(
  t: (key: TranslationKey) => string,
  behavior: ValueSuggestionBehavior,
): string {
  if (behavior === "name") {
    return t("settings.valueSuggestions.sortMode.nameOption");
  }
  if (behavior === "frequency") {
    return t("settings.valueSuggestions.behavior.frequency");
  }
  if (behavior === "note-count") {
    return t("settings.valueSuggestions.sortMode.usage");
  }
  if (behavior === "native") {
    return t("settings.valueSuggestions.sortMode.native");
  }
  if (behavior === "none") {
    return t("settings.valueSuggestions.sortMode.none");
  }
  return t("settings.valueSuggestions.behavior.custom");
}
