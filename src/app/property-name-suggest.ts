import { AbstractInputSuggest, type App } from "obsidian";

import { getPropertyNameSuggestions } from "../core/suggestions/property-names";

interface PropertyNameSuggestOptions {
  availableNames: string[];
  getExcludedNames(): string[];
  onSelect(name: string): Promise<void>;
}

export class PropertyNameSuggest extends AbstractInputSuggest<string> {
  private readonly inputEl: HTMLInputElement;
  private readonly options: PropertyNameSuggestOptions;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    options: PropertyNameSuggestOptions,
  ) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.options = options;
  }

  protected override getSuggestions(query: string): string[] {
    return getPropertyNameSuggestions(
      this.options.availableNames,
      this.options.getExcludedNames(),
      query,
    );
  }

  override renderSuggestion(name: string, el: HTMLElement): void {
    el.setText(name);
  }

  override selectSuggestion(name: string): void {
    queueMicrotask(() => {
      this.inputEl.value = "";
      this.inputEl.blur();
      this.close();
      void this.options.onSelect(name).catch((error: unknown) => {
        console.error("Property Order: failed to add property name rule", error);
      });
    });
  }
}
