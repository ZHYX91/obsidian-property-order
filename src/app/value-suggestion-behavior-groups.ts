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
import { PropertyBehaviorSuggest } from "./property-behavior-suggest";

export interface ValueSuggestionBehaviorGroupsOptions {
  app: App;
  containerEl: HTMLElement;
  customOrderKeys: readonly string[];
  displayOrder: ValueSuggestionKeyDisplayOrder;
  getAssignments: () => readonly PropertyValueBehaviorAssignment[];
  onAssignmentsChange: (assignments: PropertyValueBehaviorAssignment[]) => Promise<void>;
  onDisplayOrderChange: (displayOrder: ValueSuggestionKeyDisplayOrder) => Promise<void>;
  rerender: () => void;
  t: (key: TranslationKey) => string;
}

export interface ValueSuggestionBehaviorGroupsLifecycle {
  close(): void;
}

export function renderValueSuggestionBehaviorGroups(
  options: ValueSuggestionBehaviorGroupsOptions,
): ValueSuggestionBehaviorGroupsLifecycle {
  const suggesters: PropertyBehaviorSuggest[] = [];
  let availableKeys: string[] | null = null;
  const getAvailableKeys = (): string[] => {
    availableKeys ??= getPropertyNameSuggestions(
      getCachedPropertyKeyUsage(options.app).map((item) => item.key),
      [],
      "",
    );
    return availableKeys;
  };

  new Setting(options.containerEl)
    .setName(options.t("settings.valueSuggestions.keyDisplayOrder.name"))
    .addDropdown((dropdown) => {
      dropdown
        .addOption("name", options.t("settings.valueSuggestions.keyDisplayOrder.byName"))
        .addOption("recent", options.t("settings.valueSuggestions.keyDisplayOrder.recent"))
        .setValue(options.displayOrder)
        .onChange((value) => {
          if (value !== "name" && value !== "recent") {
            return;
          }

          void options.onDisplayOrderChange(value).then(() => options.rerender());
        });
    });

  for (const group of groupPropertyValueBehaviors(
    options.getAssignments(),
    options.displayOrder,
  )) {
    const section = options.containerEl.createDiv({
      cls: "property-order-value-behavior-group",
    });
    const header = section.createDiv({
      cls: "property-order-value-behavior-group-header",
    });
    const heading = header.createEl("h4");
    heading.textContent = getBehaviorLabel(options.t, group.behavior);
    const count = header.createSpan({
      cls: "property-order-value-behavior-group-count",
    });
    count.textContent = String(group.propertyKeys.length);

    if (group.behavior !== "custom") {
      const chips = section.createDiv({
        cls: "property-order-value-behavior-chips",
      });
      for (const propertyKey of group.propertyKeys) {
        const chip = chips.createSpan({
          cls: "property-order-value-behavior-chip",
        });
        const label = chip.createSpan();
        label.textContent = propertyKey;
        const removeButton = chip.createEl("button");
        removeButton.type = "button";
        removeButton.className = "property-order-value-behavior-chip-remove";
        removeButton.setAttribute("aria-label", `Remove ${propertyKey}`);
        removeButton.textContent = "×";
        removeButton.addEventListener("click", () => {
          const nextAssignments = removePropertyValueBehavior(
            options.getAssignments(),
            propertyKey,
          );
          void options.onAssignmentsChange(nextAssignments).then(() => options.rerender());
        });
      }
    }

    const addRow = section.createDiv({
      cls: "property-order-value-behavior-add",
    });
    const input = addRow.createEl("input");
    input.type = "text";
    input.placeholder = options.t("settings.valueSuggestions.addProperty.placeholder");
    input.className = "property-order-value-behavior-input";
    const addButton = addRow.createEl("button");
    addButton.type = "button";
    addButton.textContent = options.t("settings.valueSuggestions.addProperty.button");

    const addProperty = async (rawPropertyKey: string): Promise<void> => {
      const propertyKey = rawPropertyKey.trim();
      if (propertyKey.length === 0) {
        return;
      }

      const currentBehavior = getPropertyValueBehavior(
        options.getAssignments(),
        propertyKey,
      );
      if (currentBehavior === group.behavior) {
        input.value = "";
        return;
      }

      if (currentBehavior != null) {
        const targetWindow = section.ownerDocument.defaultView;
        const confirmation = options
          .t("settings.valueSuggestions.moveConfirm")
          .replace("{property}", propertyKey)
          .replace("{from}", getBehaviorLabel(options.t, currentBehavior))
          .replace("{to}", getBehaviorLabel(options.t, group.behavior));
        if (targetWindow?.confirm(confirmation) !== true) {
          return;
        }
      }

      const move = movePropertyValueBehavior(
        options.getAssignments(),
        propertyKey,
        group.behavior,
      );
      if (!move.changed) {
        input.value = "";
        return;
      }

      input.value = "";
      await options.onAssignmentsChange(move.nextAssignments);
      options.rerender();
    };

    addButton.addEventListener("click", () => {
      void addProperty(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) {
        return;
      }
      event.preventDefault();
      void addProperty(input.value);
    });

    const suggester = new PropertyBehaviorSuggest(options.app, input, {
      customOrderKeys: options.customOrderKeys,
      getAlreadyHereLabel: () =>
        options.t("settings.valueSuggestions.behavior.alreadyHere"),
      getAssignments: options.getAssignments,
      getAvailableKeys,
      getBehaviorLabel: (behavior) => getBehaviorLabel(options.t, behavior),
      getFollowDefaultLabel: () =>
        options.t("settings.valueSuggestions.behavior.followDefault"),
      onSelect: addProperty,
      targetBehavior: group.behavior,
    });
    suggesters.push(suggester);
  }

  return {
    close() {
      for (const suggester of suggesters) {
        suggester.close();
      }
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
