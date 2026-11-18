// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderWritebackFormatExamples } from "../../src/app/writeback-format-examples";

describe("writeback examples disclosure lifetime", () => {
  it("is default closed and preserves in-memory open choice only while settings are visible", () => {
    Object.assign(HTMLElement.prototype, {
      createEl(this: HTMLElement, tag: string, opts?: { text?: string; cls?: string }) {
        const el = this.ownerDocument.createElement(tag);
        if (opts?.text) el.textContent = opts.text;
        if (opts?.cls) el.className = opts.cls;
        this.append(el);
        return el;
      },
    });
    const panel = document.createElement("section");
    const expanded = new Set<string>();
    const t = (key: string) => key;
    renderWritebackFormatExamples(panel, t as never, expanded);
    let detail = panel.querySelector("details")!;
    expect(detail.open).toBe(false);
    detail.open = true; detail.dispatchEvent(new Event("toggle"));
    expect(expanded.has("writeback-formats")).toBe(true);
    panel.replaceChildren();
    renderWritebackFormatExamples(panel, t as never, expanded);
    detail = panel.querySelector("details")!;
    expect(detail.open).toBe(true);
    expanded.clear(); // PropertyOrderSettingTab.hide() only clears in-memory session.
    panel.replaceChildren();
    renderWritebackFormatExamples(panel, t as never, expanded);
    expect(panel.querySelector("details")?.open).toBe(false);
  });
});
