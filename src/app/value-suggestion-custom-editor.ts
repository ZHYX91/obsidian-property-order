import { Setting, type App } from "obsidian";

import {
  getPropertyValueCustomOrder,
  moveCustomCandidate,
  removeCustomPreset,
  reorderCustomCandidate,
  setCustomMiddleSortMode,
  upsertPropertyValueCustomOrder,
  type CustomCandidatePlacement,
} from "../core/suggestions/custom-value-order";
import { groupPropertyValueBehaviors } from "../core/suggestions/value-behavior";
import { planCustomPropertyValueCandidates } from "../core/suggestions/value-candidates";
import {
  getCachedPropertyValueUsage,
  getCachedPropertyValueVocabulary,
} from "../obsidian/metadata";
import type { TranslationKey } from "../shared/i18n";
import type {
  PropertyValueBehaviorAssignment,
  PropertyValueCustomOrder,
  PropertyValueUsage,
  ValueSuggestionKeyDisplayOrder,
  ValueSuggestionMiddleSortMode,
} from "../shared/types";

export interface CustomValueSuggestionEditorOptions {
  app: App;
  assignments: readonly PropertyValueBehaviorAssignment[];
  containerEl: HTMLElement;
  customOrders: readonly PropertyValueCustomOrder[];
  displayOrder: ValueSuggestionKeyDisplayOrder;
  getFrequency(propertyKey: string): readonly PropertyValueUsage[];
  onCustomOrdersChange(orders: PropertyValueCustomOrder[]): Promise<void>;
  rerender(selectedPropertyKey?: string): void;
  selectedPropertyKey?: string | null;
  t(key: TranslationKey): string;
}

export interface CustomValueSuggestionEditorLifecycle {
  selectedPropertyKey: string | null;
}

export function renderCustomValueSuggestionEditor(
  options: CustomValueSuggestionEditorOptions,
): CustomValueSuggestionEditorLifecycle {
  const customKeys =
    groupPropertyValueBehaviors(options.assignments, options.displayOrder)
      .find((group) => group.behavior === "custom")?.propertyKeys ?? [];
  const selectedPropertyKey =
    options.selectedPropertyKey != null &&
    customKeys.some((key) => equalKey(key, options.selectedPropertyKey ?? ""))
      ? customKeys.find((key) => equalKey(key, options.selectedPropertyKey ?? "")) ?? null
      : customKeys[0] ?? null;

  if (selectedPropertyKey == null) {
    const hint = options.containerEl.createDiv({
      cls: "property-order-settings-hint",
    });
    hint.textContent = options.t("settings.valueSuggestions.custom.empty");
    return { selectedPropertyKey: null };
  }

  const layout = options.containerEl.createDiv({
    cls: "property-order-custom-value-layout",
  });
  const keyList = layout.createDiv({
    cls: "property-order-custom-value-keys",
  });
  const editor = layout.createDiv({
    cls: "property-order-custom-value-editor",
  });

  for (const propertyKey of customKeys) {
    const button = keyList.createEl("button");
    button.type = "button";
    button.className = equalKey(propertyKey, selectedPropertyKey)
      ? "property-order-custom-value-key is-active"
      : "property-order-custom-value-key";
    button.textContent = propertyKey;
    button.setAttribute("aria-pressed", String(equalKey(propertyKey, selectedPropertyKey)));
    button.addEventListener("click", () => options.rerender(propertyKey));
  }

  const heading = editor.createEl("h4");
  heading.textContent = selectedPropertyKey;

  let order = getPropertyValueCustomOrder(options.customOrders, selectedPropertyKey);
  const nativeValues = getCachedPropertyValueVocabulary(options.app, selectedPropertyKey);
  const noteCounts = getCachedPropertyValueUsage(options.app, selectedPropertyKey);
  const frequency = options.getFrequency(selectedPropertyKey);
  const plan = planCustomPropertyValueCandidates({
    bottomValues: order.bottomValues,
    frequency,
    middleSortMode: order.middleSortMode,
    middleValues: order.middleValues,
    nativeValues,
    noteCounts,
    pinnedValues: order.pinnedValues,
  });
  const middleCandidates = plan.filter((candidate) => candidate.placement === "middle");

  const persist = async (nextOrder: PropertyValueCustomOrder): Promise<void> => {
    order = nextOrder;
    await options.onCustomOrdersChange(
      upsertPropertyValueCustomOrder(options.customOrders, nextOrder),
    );
    options.rerender(selectedPropertyKey);
  };

  let draggedValue: string | null = null;

  const renderSection = (
    placement: CustomCandidatePlacement,
    values: Array<{ isPreset: boolean; value: string }>,
    allowManualAdd: boolean,
  ): void => {
    const section = editor.createDiv({
      cls: `property-order-custom-value-section is-${placement}`,
    });
    const title = section.createDiv({
      cls: "property-order-custom-value-section-title",
    });
    title.textContent =
      placement === "pinned"
        ? options.t("settings.valueSuggestions.custom.pinned")
        : placement === "bottom"
          ? options.t("settings.valueSuggestions.custom.bottom")
          : options.t("settings.valueSuggestions.custom.middle");

    section.addEventListener("dragover", (event) => {
      if (draggedValue != null) {
        event.preventDefault();
      }
    });
    section.addEventListener("drop", (event) => {
      if (draggedValue == null) {
        return;
      }
      event.preventDefault();
      const value = draggedValue;
      draggedValue = null;
      void persist(moveCustomCandidate(order, value, placement));
    });

    const list = section.createDiv({
      cls: "property-order-custom-value-list",
    });

    for (const item of values) {
      const row = list.createDiv({
        cls: "property-order-custom-value-item",
      });
      row.draggable = true;
      row.addEventListener("dragstart", (event) => {
        draggedValue = item.value;
        event.dataTransfer?.setData("text/plain", item.value);
        if (event.dataTransfer != null) {
          event.dataTransfer.effectAllowed = "move";
        }
      });
      row.addEventListener("dragend", () => {
        draggedValue = null;
      });

      const label = row.createSpan({
        cls: "property-order-custom-value-label",
      });
      label.textContent = item.value;

      const actions = row.createDiv({
        cls: "property-order-custom-value-actions",
      });

      const addAction = (
        text: string,
        labelText: string,
        onClick: () => void,
        disabled = false,
      ): void => {
        const button = actions.createEl("button");
        button.type = "button";
        button.textContent = text;
        button.title = labelText;
        button.setAttribute("aria-label", `${labelText}: ${item.value}`);
        button.disabled = disabled;
        button.addEventListener("click", onClick);
      };

      if (placement === "pinned") {
        const index = order.pinnedValues.indexOf(item.value);
        addAction(
          "↑",
          options.t("settings.valueSuggestions.custom.moveUp"),
          () => void persist(reorderCustomCandidate(order, "pinned", item.value, -1)),
          index <= 0,
        );
        addAction(
          "↓",
          options.t("settings.valueSuggestions.custom.moveDown"),
          () => void persist(reorderCustomCandidate(order, "pinned", item.value, 1)),
          index < 0 || index >= order.pinnedValues.length - 1,
        );
      } else {
        addAction(
          "⇧",
          options.t("settings.valueSuggestions.custom.toPinned"),
          () => void persist(moveCustomCandidate(order, item.value, "pinned")),
        );
      }

      if (placement !== "middle") {
        addAction(
          "↔",
          options.t("settings.valueSuggestions.custom.toMiddle"),
          () => void persist(moveCustomCandidate(order, item.value, "middle")),
        );
      }

      if (placement === "bottom") {
        const index = order.bottomValues.indexOf(item.value);
        addAction(
          "↑",
          options.t("settings.valueSuggestions.custom.moveUp"),
          () => void persist(reorderCustomCandidate(order, "bottom", item.value, -1)),
          index <= 0,
        );
        addAction(
          "↓",
          options.t("settings.valueSuggestions.custom.moveDown"),
          () => void persist(reorderCustomCandidate(order, "bottom", item.value, 1)),
          index < 0 || index >= order.bottomValues.length - 1,
        );
      } else {
        addAction(
          "⇩",
          options.t("settings.valueSuggestions.custom.toBottom"),
          () => void persist(moveCustomCandidate(order, item.value, "bottom")),
        );
      }

      if (item.isPreset) {
        addAction(
          "×",
          options.t("settings.valueSuggestions.custom.removePreset"),
          () => void persist(removeCustomPreset(order, item.value)),
        );
      }
    }

    if (placement === "middle") {
      new Setting(section)
        .setName(options.t("settings.valueSuggestions.custom.middleSort"))
        .addDropdown((dropdown) => {
          dropdown
            .addOption("native", options.t("settings.valueSuggestions.sortMode.native"))
            .addOption("name", options.t("settings.valueSuggestions.sortMode.nameOption"))
            .addOption("frequency", options.t("settings.valueSuggestions.behavior.frequency"))
            .addOption("note-count", options.t("settings.valueSuggestions.sortMode.usage"))
            .setValue(order.middleSortMode)
            .onChange((value) => {
              if (!isMiddleSortMode(value)) {
                return;
              }
              void persist(setCustomMiddleSortMode(order, value));
            });
        });
    }

    if (allowManualAdd) {
      const addRow = section.createDiv({
        cls: "property-order-custom-value-add",
      });
      const input = addRow.createEl("input");
      input.type = "text";
      input.placeholder = options.t("settings.valueSuggestions.custom.valuePlaceholder");
      const button = addRow.createEl("button");
      button.type = "button";
      button.textContent = options.t("settings.valueSuggestions.custom.addValue");
      const commit = (): void => {
        if (input.value.length === 0) {
          return;
        }
        const value = input.value;
        input.value = "";
        void persist(moveCustomCandidate(order, value, placement));
      };
      button.addEventListener("click", commit);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.isComposing) {
          return;
        }
        event.preventDefault();
        commit();
      });
    }
  };

  renderSection(
    "pinned",
    order.pinnedValues.map((value) => ({ isPreset: true, value })),
    true,
  );
  renderSection(
    "middle",
    middleCandidates.map((candidate) => ({
      isPreset: candidate.isPreset,
      value: candidate.value,
    })),
    false,
  );
  renderSection(
    "bottom",
    order.bottomValues.map((value) => ({ isPreset: true, value })),
    true,
  );

  return { selectedPropertyKey };
}

function equalKey(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function isMiddleSortMode(value: string): value is ValueSuggestionMiddleSortMode {
  return (
    value === "native" ||
    value === "name" ||
    value === "frequency" ||
    value === "note-count"
  );
}
