import { AbstractInputSuggest, type App } from "obsidian";

import {
  getPropertyValueBehavior,
  mergePropertyValueKeyCandidates,
} from "../core/suggestions/value-behavior";
import { comparePropertyNames } from "../core/suggestions/property-names";
import type {
  PropertyValueBehaviorAssignment,
  ValueSuggestionBehavior,
} from "../shared/types";

export interface PropertyBehaviorSuggestOptions {
  availableKeys: readonly string[];
  customOrderKeys: readonly string[];
  getAssignments(): readonly PropertyValueBehaviorAssignment[];
  getBehaviorLabel(behavior: ValueSuggestionBehavior | null): string;
  onSelect(propertyKey: string): Promise<void>;
  targetBehavior: ValueSuggestionBehavior;
}

export class PropertyBehaviorSuggest extends AbstractInputSuggest<string> {
  private readonly inputEl: HTMLInputElement;
  private readonly options: PropertyBehaviorSuggestOptions;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    options: PropertyBehaviorSuggestOptions,
  ) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.options = options;
  }

  protected override getSuggestions(query: string): string[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const candidates = mergePropertyValueKeyCandidates(
      this.options.availableKeys,
      this.options.getAssignments(),
      this.options.customOrderKeys,
    );

    return candidates
      .filter(
        (propertyKey) =>
          normalizedQuery.length === 0 ||
          propertyKey.toLocaleLowerCase().includes(normalizedQuery),
      )
      .sort(comparePropertyNames);
  }

  override renderSuggestion(propertyKey: string, el: HTMLElement): void {
    const currentBehavior = getPropertyValueBehavior(
      this.options.getAssignments(),
      propertyKey,
    );
    const title = el.createDiv();
    title.className = "property-order-behavior-suggest-title";
    title.textContent = propertyKey;
    const status = el.createDiv();
    status.className = "property-order-behavior-suggest-status";
    status.textContent =
      currentBehavior === this.options.targetBehavior
        ? this.options.getBehaviorLabel(currentBehavior)
        : currentBehavior == null
          ? this.options.getBehaviorLabel(null)
          : this.options.getBehaviorLabel(currentBehavior);

    if (currentBehavior === this.options.targetBehavior) {
      el.classList.add("is-disabled");
      el.setAttribute("aria-disabled", "true");
    }
  }

  override selectSuggestion(propertyKey: string): void {
    const currentBehavior = getPropertyValueBehavior(
      this.options.getAssignments(),
      propertyKey,
    );

    queueMicrotask(() => {
      this.inputEl.value = "";
      this.close();

      if (currentBehavior === this.options.targetBehavior) {
        return;
      }

      void this.options.onSelect(propertyKey).catch((error: unknown) => {
        console.error("Property Order: failed to update property value behavior", error);
      });
    });
  }
}
