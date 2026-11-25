// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { AccessibleSetting } from "../../src/app/accessible-setting";
import { preserveSettingsView } from "../../src/app/settings-view-state";

vi.mock("obsidian", () => ({
  Setting: class {
    readonly nameEl: HTMLElement;
    readonly descEl: HTMLElement;
    constructor(readonly controlEl: HTMLElement) {
      this.nameEl = controlEl.appendChild(document.createElement("div"));
      this.descEl = controlEl.appendChild(document.createElement("div"));
    }
    addText(configure: (component: { inputEl: HTMLInputElement }) => void): this {
      configure({ inputEl: this.controlEl.appendChild(document.createElement("input")) });
      return this;
    }
    addToggle(configure: (component: { toggleEl: HTMLElement; getValue: () => boolean }) => void): this {
      const wrapper = this.controlEl.appendChild(document.createElement("label"));
      const input = wrapper.appendChild(document.createElement("input"));
      input.type = "checkbox";
      input.tabIndex = -1;
      wrapper.tabIndex = 0;
      let on = true;
      wrapper.addEventListener("keydown", () => { on = !on; });
      configure({ toggleEl: wrapper, getValue: () => on });
      return this;
    }
  },
}));

describe("native setting accessibility", () => {
  it("restores focus to a stable native setting after the row changes language", () => {
    const host = document.createElement("div");
    document.body.append(host);
    try {
      const render = (name: string): HTMLInputElement => {
        host.replaceChildren();
        const row = new AccessibleSetting(host).setFocusKey("enablePropertyValueDrag");
        row.nameEl.textContent = name;
        row.addToggle(() => undefined);
        return host.querySelector("input")!;
      };
      const original = render("Enable dragging");
      original.focus();
      preserveSettingsView(host, () => { render("拖动属性值"); });
      expect(original.isConnected).toBe(false);
      expect(document.activeElement).toBe(host.querySelector("input"));
    } finally { host.remove(); }
  });

  it("links the displayed name and description while preserving a field-specific name", () => {
    const host = document.createElement("div");
    const row = new AccessibleSetting(host);
    row.nameEl.textContent = "Property order";
    row.descEl.textContent = "Applies in this vault.";
    row.addText(() => undefined).addText(({ inputEl }) => inputEl.setAttribute("aria-label", "Find a property"));
    const [first, second] = host.querySelectorAll("input");
    expect(first!.getAttribute("aria-labelledby")).toBe(row.nameEl.id);
    expect(row.nameEl.id).not.toBe("");
    expect(first!.getAttribute("aria-describedby")).toBe(row.descEl.id);
    expect(second!.getAttribute("aria-label")).toBe("Find a property");
    expect(second!.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("makes the native checkbox the single named tab stop and follows the host value", () => {
    const host = document.createElement("div");
    const row = new AccessibleSetting(host);
    row.nameEl.textContent = "Enabled";
    row.addToggle(() => undefined);
    const input = host.querySelector("input")!;
    expect(input.getAttribute("aria-labelledby")).toBe(row.nameEl.id);
    expect(input.tabIndex).toBe(0);
    expect(input.parentElement!.tabIndex).toBe(-1);
    expect(input.checked).toBe(true);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(input.checked).toBe(false);
  });
});
