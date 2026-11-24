import { Modal, type App } from "obsidian";
import type { KeyboardReorderDraft, KeyboardReorderRequest } from "../features/value-order/keyboard-reorder";
import type { TranslationKey } from "../shared/i18n";
import type { ResolvedPluginLocale } from "../shared/locale-catalog";

/** Native controls provide the same value edit without depending on pill focusability. */
export class KeyboardValueOrderModal extends Modal {
  private disposed = false;
  private pending = false;
  private failed = false;
  private readonly returnFocusTarget: HTMLElement | null;
  private restoreFocusOnClose = true;

  constructor(
    app: App,
    private readonly draft: KeyboardReorderDraft,
    private readonly t: (key: TranslationKey) => string,
    private readonly locale: ResolvedPluginLocale = "en",
  ) {
    super(app);
    // Capture the command invoker before Obsidian moves focus into the modal.
    const ownerDocument = this.contentEl.ownerDocument;
    const active = ownerDocument.activeElement as HTMLElement | null;
    this.returnFocusTarget = active !== ownerDocument.body && typeof active?.focus === "function"
      ? active : null;
  }

  override onOpen(): void {
    if (this.disposed) return;
    this.setTitle(this.t("keyboard.command"));
    const root = this.contentEl;
    const direction = this.locale === "ar" ? "rtl" : "ltr";
    for (const element of [this.titleEl, root]) {
      element.lang = this.locale;
      element.dir = direction;
    }
    root.classList.add("property-order-keyboard-reorder");
    root.createEl("p", { text: this.t("keyboard.description") });
    const addSelect = (key: TranslationKey): HTMLSelectElement => {
      const label = root.createEl("label", { cls: "property-order-keyboard-field" });
      label.createSpan({ text: this.t(key) });
      return label.createEl("select");
    };
    const source = addSelect("keyboard.source");
    const value = addSelect("keyboard.value");
    const positionLabel = root.createEl("label", { cls: "property-order-keyboard-field" });
    positionLabel.createSpan({ text: this.t("keyboard.position") });
    const position = positionLabel.createEl("input", { attr: { type: "number", min: "1", step: "1" } });
    const target = addSelect("keyboard.target");
    const sourceProperties = this.draft.properties.filter((property) => property.canSource && property.values.length > 0);
    for (const property of sourceProperties) source.createEl("option", { text: property.key, attr: { value: property.key, lang: "", dir: "auto" } });
    const actions = root.createDiv({ cls: "property-order-keyboard-actions" });
    const up = actions.createEl("button", { text: this.t("keyboard.up") });
    const down = actions.createEl("button", { text: this.t("keyboard.down") });
    const first = actions.createEl("button", { text: this.t("keyboard.first") });
    const last = actions.createEl("button", { text: this.t("keyboard.last") });
    const atPosition = actions.createEl("button", { text: this.t("keyboard.atPosition") });
    const move = actions.createEl("button", { text: this.t("keyboard.move") });
    const cancel = actions.createEl("button", { text: this.t("keyboard.cancel") });
    for (const button of [up, down, first, last, atPosition, move, cancel]) button.type = "button";
    const status = root.createEl("p", { attr: { role: "status", "aria-live": "polite", tabindex: "-1" } });
    const updateControls = (): void => {
      const locked = this.pending || this.failed;
      const values = sourceProperties.find((property) => property.key === source.value)?.values ?? [];
      source.disabled = locked;
      value.disabled = locked;
      position.disabled = locked || values.length < 2;
      const validPosition = Number.isInteger(position.valueAsNumber) && position.valueAsNumber >= 1 &&
        position.valueAsNumber <= values.length;
      position.setAttribute("aria-invalid", String(!validPosition));
      target.disabled = locked || target.options.length === 0;
      up.disabled = locked || Number(value.value) <= 0;
      down.disabled = locked || Number(value.value) >= values.length - 1;
      first.disabled = up.disabled;
      last.disabled = down.disabled;
      atPosition.disabled = locked || !validPosition || position.valueAsNumber === Number(value.value) + 1;
      move.disabled = locked || target.options.length === 0;
      cancel.disabled = this.pending;
      root.setAttribute("aria-busy", String(this.pending));
    };
    const updateValue = (): void => {
      position.max = String(sourceProperties.find((property) => property.key === source.value)?.values.length ?? 0);
      position.value = String(Number(value.value) + 1);
      updateControls();
    };
    const updateSource = (): void => {
      value.replaceChildren();
      const values = sourceProperties.find((property) => property.key === source.value)?.values ?? [];
      values.forEach((text, index) => value.createEl("option", { text: `${index + 1}. ${text}`, attr: { value: String(index), lang: "", dir: "auto" } }));
      target.replaceChildren();
      for (const property of this.draft.properties) {
        if (property.key !== source.value) target.createEl("option", { text: property.key, attr: { value: property.key, lang: "", dir: "auto" } });
      }
      updateValue();
    };
    source.addEventListener("change", updateSource);
    value.addEventListener("change", updateValue);
    position.addEventListener("input", updateControls);
    const apply = async (action: KeyboardReorderRequest["action"], targetIndex?: number): Promise<void> => {
      if (this.disposed || this.pending || this.failed) return;
      if (action === "position" && (targetIndex === undefined || !Number.isInteger(targetIndex) ||
          targetIndex < 0 || targetIndex >= Number(position.max) || targetIndex === Number(value.value))) return;
      // A disabled action button loses focus immediately. Keep keyboard and
      // screen-reader focus in the dialog while its asynchronous write runs.
      status.focus({ preventScroll: true });
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
          ...(action === "position" ? { targetIndex } : {}),
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
        cancel.focus({ preventScroll: true });
      }
    };
    up.addEventListener("click", () => { void apply("up"); });
    down.addEventListener("click", () => { void apply("down"); });
    first.addEventListener("click", () => { void apply("position", 0); });
    last.addEventListener("click", () => { void apply("position", Number(position.max) - 1); });
    atPosition.addEventListener("click", () => { void apply("position", position.valueAsNumber - 1); });
    move.addEventListener("click", () => { void apply("move"); });
    cancel.addEventListener("click", () => this.close());
    updateSource();
    source.focus();
  }

  override close(): void {
    if (!this.pending) super.close();
  }

  dispose(): void {
    this.restoreFocusOnClose = false;
    this.pending = false;
    this.close();
  }

  override onClose(): void {
    this.disposed = true;
    this.draft.cancel();
    this.contentEl.replaceChildren();
    const target = this.restoreFocusOnClose ? this.returnFocusTarget : null;
    if (target === null) return;
    // Obsidian may restore focus itself. Only supply a fallback after the
    // overlay is removed, and never override another focus destination.
    queueMicrotask(() => {
      const doc = target.ownerDocument;
      if (!target.isConnected || target.matches(":disabled")) return;
      const active = doc.activeElement;
      if (active === doc.body || active === null) target.focus({ preventScroll: true });
    });
  }
}
