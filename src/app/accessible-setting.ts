import { Setting, type ToggleComponent, type DropdownComponent, type TextComponent, type TextAreaComponent } from "obsidian";

let nextField = 0;

/** Link native setting fields to the visible copy, including rebuilt or localized rows. */
export class AccessibleSetting extends Setting {
  private focusKey?: string;

  setFocusKey(key: string): this {
    this.focusKey = key;
    return this;
  }

  private describe(field: HTMLElement | undefined): void {
    if (!field || !this.nameEl?.textContent?.trim()) return;
    if (this.focusKey) field.dataset.settingsFocus = this.focusKey;
    if (!this.nameEl.id) this.nameEl.id = `property-order-field-${++nextField}`;
    if (!field.hasAttribute("aria-label") && !field.hasAttribute("aria-labelledby")) {
      field.setAttribute("aria-labelledby", this.nameEl.id);
    }
    if (this.descEl?.textContent?.trim() && !field.hasAttribute("aria-describedby")) {
      if (!this.descEl.id) this.descEl.id = `${this.nameEl.id}-description`;
      field.setAttribute("aria-describedby", this.descEl.id);
    }
  }

  override addToggle(configure: (component: ToggleComponent) => unknown): this {
    return super.addToggle((component) => {
      configure(component);
      const wrapper = component.toggleEl;
      if (!wrapper) return;
      const input = wrapper.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const field = input ?? wrapper;
      this.describe(field);
      if (input) {
        wrapper.tabIndex = -1;
        wrapper.classList.add("property-order-named-toggle");
        input.tabIndex = 0;
      } else {
        wrapper.setAttribute("role", "switch");
      }
      const sync = (): void => {
        const disabled = wrapper.classList.contains("is-disabled");
        if (input) {
          input.checked = component.getValue();
          input.disabled = disabled;
        } else {
          wrapper.setAttribute("aria-checked", String(component.getValue()));
          wrapper.setAttribute("aria-disabled", String(disabled));
          wrapper.tabIndex = disabled ? -1 : 0;
        }
      };
      sync();
      // These run after the host has handled pointer and keyboard activation.
      wrapper.addEventListener("change", sync);
      wrapper.addEventListener("keydown", sync);
      if (!input) wrapper.addEventListener("click", sync);
    });
  }

  override addDropdown(configure: (component: DropdownComponent) => unknown): this {
    return super.addDropdown((component) => {
      configure(component);
      this.describe(component.selectEl);
    });
  }

  override addText(configure: (component: TextComponent) => unknown): this {
    return super.addText((component) => {
      configure(component);
      this.describe(component.inputEl);
    });
  }

  override addTextArea(configure: (component: TextAreaComponent) => unknown): this {
    return super.addTextArea((component) => {
      configure(component);
      this.describe(component.inputEl);
    });
  }
}
