import { Modal, type App } from "obsidian";
import type { KeyboardReorderDraft, KeyboardReorderRequest } from "../features/value-order/keyboard-reorder";
import type { TranslationKey } from "../shared/i18n";

/** Native controls provide the same value edit without depending on pill focusability. */
export class KeyboardValueOrderModal extends Modal {
  private disposed = false;
  private pending = false;
  private failed = false;

  constructor(
    app: App,
    private readonly draft: KeyboardReorderDraft,
    private readonly t: (key: TranslationKey) => string,
    private readonly direction: "ltr" | "rtl" = "ltr",
  ) { super(app); }

  override onOpen(): void {
    if (this.disposed) return;
    this.setTitle(this.t("keyboard.command"));
    this.titleEl.dir = this.direction;
    const root = this.contentEl;
    root.dir = this.direction;
    root.classList.add("property-order-keyboard-reorder");
    root.createEl("p", { text: this.t("keyboard.description") });
    const addSelect = (key: TranslationKey): HTMLSelectElement => {
      const label = root.createEl("label", { cls: "property-order-keyboard-field" });
      label.createSpan({ text: this.t(key) });
      return label.createEl("select");
    };
    const source = addSelect("keyboard.source");
    const value = addSelect("keyboard.value");
    const target = addSelect("keyboard.target");
    const sourceProperties = this.draft.properties.filter((property) => property.canSource && property.values.length > 0);
    for (const property of sourceProperties) source.createEl("option", { text: property.key, attr: { value: property.key } });
    const actions = root.createDiv({ cls: "property-order-keyboard-actions" });
    const up = actions.createEl("button", { text: this.t("keyboard.up") });
    const down = actions.createEl("button", { text: this.t("keyboard.down") });
    const move = actions.createEl("button", { text: this.t("keyboard.move") });
    const cancel = actions.createEl("button", { text: this.t("keyboard.cancel") });
    for (const button of [up, down, move, cancel]) button.type = "button";
    const status = root.createEl("p", { attr: { role: "status", "aria-live": "polite" } });
    const updateControls = (): void => {
      const locked = this.pending || this.failed;
      const values = sourceProperties.find((property) => property.key === source.value)?.values ?? [];
      source.disabled = locked;
      value.disabled = locked;
      target.disabled = locked || target.options.length === 0;
      up.disabled = locked || Number(value.value) <= 0;
      down.disabled = locked || Number(value.value) >= values.length - 1;
      move.disabled = locked || target.options.length === 0;
      cancel.disabled = this.pending;
      root.setAttribute("aria-busy", String(this.pending));
    };
    const updateSource = (): void => {
      value.replaceChildren();
      const values = sourceProperties.find((property) => property.key === source.value)?.values ?? [];
      values.forEach((text, index) => value.createEl("option", { text: `${index + 1}. ${text}`, attr: { value: String(index) } }));
      target.replaceChildren();
      for (const property of this.draft.properties) {
        if (property.key !== source.value) target.createEl("option", { text: property.key, attr: { value: property.key } });
      }
      updateControls();
    };
    source.addEventListener("change", updateSource);
    value.addEventListener("change", updateControls);
    const apply = async (action: KeyboardReorderRequest["action"]): Promise<void> => {
      if (this.disposed || this.pending || this.failed) return;
      this.pending = true;
      updateControls();
      status.textContent = this.t("keyboard.pending");
      let committed = false;
      try {
        committed = await this.draft.submit({
          sourceProperty: source.value,
          sourceIndex: Number(value.value),
          action,
          targetProperty: target.value,
        });
      } catch (error) {
        console.error("Property Order: keyboard value edit failed", error);
      }
      if (this.disposed) return;
      this.pending = false;
      if (committed) {
        this.close();
      } else {
        this.failed = true;
        updateControls();
        status.textContent = this.t("keyboard.retry");
      }
    };
    up.addEventListener("click", () => { void apply("up"); });
    down.addEventListener("click", () => { void apply("down"); });
    move.addEventListener("click", () => { void apply("move"); });
    cancel.addEventListener("click", () => this.close());
    updateSource();
    source.focus();
  }

  override close(): void {
    if (!this.pending) super.close();
  }

  dispose(): void {
    this.pending = false;
    this.close();
  }

  override onClose(): void {
    this.disposed = true;
    this.draft.cancel();
    this.contentEl.replaceChildren();
  }
}
