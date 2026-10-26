// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardValueOrderModal } from "../../src/app/keyboard-value-order-modal";
import { renderWritebackFormatExamples } from "../../src/app/writeback-format-examples";
import type { KeyboardReorderDraft } from "../../src/features/value-order/keyboard-reorder";
import { getTranslation, type TranslationKey } from "../../src/shared/i18n";
import { SUPPORTED_LOCALES } from "../../src/shared/locale-catalog";

const t = (key: TranslationKey): string => getTranslation("en", key);

function createDraft(): KeyboardReorderDraft & {
  submit: ReturnType<typeof vi.fn<KeyboardReorderDraft["submit"]>>;
  cancel: ReturnType<typeof vi.fn<() => void>>;
} {
  return {
    properties: [
      { key: "tags", values: ["alpha", "beta"], canSource: true },
      { key: "related", values: ["gamma"], canSource: true },
      { key: "empty", values: [], canSource: true },
    ],
    submit: vi.fn<KeyboardReorderDraft["submit"]>().mockResolvedValue(true),
    cancel: vi.fn<() => void>(),
  };
}

function button(modal: KeyboardValueOrderModal, text: string): HTMLButtonElement {
  const result = Array.from(modal.contentEl.querySelectorAll("button")).find((item) => item.textContent === text);
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}

beforeEach(() => { document.body.replaceChildren(); });

describe("keyboard value order dialog", () => {
  it("labels every select, focuses the source and disables only boundary moves", () => {
    const draft = createDraft();
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    const labels = Array.from(modal.contentEl.querySelectorAll("label"));
    expect(labels.map((label) => label.querySelector("span")?.textContent))
      .toEqual(["Source property", "Value", "Destination position (starting at 1)", "Destination property"]);
    const [source, value, target] = modal.contentEl.querySelectorAll("select");
    expect(source?.value).toBe("tags");
    expect(source?.options.length).toBe(2);
    expect(value?.value).toBe("0");
    expect(target?.value).toBe("related");
    expect(document.activeElement).toBe(source);
    expect(button(modal, "Move up").disabled).toBe(true);
    expect(button(modal, "Move down").disabled).toBe(false);
    expect(button(modal, "Move to first").disabled).toBe(true);
    expect(button(modal, "Move to last").disabled).toBe(false);
    if (value) { value.value = "1"; value.dispatchEvent(new Event("change")); }
    expect(button(modal, "Move up").disabled).toBe(false);
    expect(button(modal, "Move down").disabled).toBe(true);
    expect(button(modal, "Move to first").disabled).toBe(false);
    expect(button(modal, "Move to last").disabled).toBe(true);
    modal.close();
  });

  it("resets value and destination choices when the source property changes", () => {
    const modal = new KeyboardValueOrderModal({} as never, createDraft(), t);
    modal.open();
    const [source, value, target] = modal.contentEl.querySelectorAll("select");
    if (source) { source.value = "related"; source.dispatchEvent(new Event("change")); }
    expect(value?.options.length).toBe(1);
    expect(Array.from(target?.options ?? []).map((option) => option.value)).toEqual(["tags", "empty"]);
    expect(button(modal, "Move up").disabled).toBe(true);
    expect(button(modal, "Move down").disabled).toBe(true);
    expect(modal.contentEl.querySelector("input")?.disabled).toBe(true);
    expect(modal.contentEl.querySelector("input")?.max).toBe("1");
    modal.close();
  });

  it.each([
    { action: "Move to first", sourceIndex: 29, targetIndex: 0 },
    { action: "Move to last", sourceIndex: 0, targetIndex: 29 },
    { action: "Move to position", sourceIndex: 29, targetIndex: 12 },
  ])("moves directly using $action with one submission", async ({ action, sourceIndex, targetIndex }) => {
    const draft = createDraft();
    const modal = new KeyboardValueOrderModal({} as never, {
      ...draft,
      properties: [{ key: "tags", values: Array.from({ length: 30 }, () => "duplicate"), canSource: true }],
    }, t);
    modal.open();
    const value = modal.contentEl.querySelectorAll("select")[1]!;
    value.value = String(sourceIndex);
    value.dispatchEvent(new Event("change"));
    const position = modal.contentEl.querySelector("input")!;
    expect(position.min).toBe("1");
    expect(position.max).toBe("30");
    expect(position.value).toBe(String(sourceIndex + 1));
    position.value = String(targetIndex + 1);
    position.dispatchEvent(new Event("input"));
    button(modal, action).click();
    await vi.waitFor(() => expect(draft.cancel).toHaveBeenCalledOnce());
    expect(draft.submit).toHaveBeenCalledExactlyOnceWith({
      action: "position", sourceProperty: "tags", sourceIndex, targetIndex, targetProperty: "",
    });
  });

  it.each(["", "0", "3", "1.5", "2"])("rejects invalid or unchanged destination position %j", (destination) => {
    const draft = createDraft();
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    const value = modal.contentEl.querySelectorAll("select")[1]!;
    value.value = "1";
    value.dispatchEvent(new Event("change"));
    const position = modal.contentEl.querySelector("input")!;
    position.value = destination;
    position.dispatchEvent(new Event("input"));
    const apply = button(modal, "Move to position");
    expect(apply.disabled).toBe(true);
    apply.dispatchEvent(new MouseEvent("click"));
    expect(draft.submit).not.toHaveBeenCalled();
    button(modal, "Cancel").click();
    expect(draft.cancel).toHaveBeenCalledOnce();
  });

  it.each(["up", "down", "move"] as const)("submits the selected %s action and closes on completion", async (action) => {
    const draft = createDraft();
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    if (action === "up") {
      const value = modal.contentEl.querySelectorAll("select")[1];
      if (value) { value.value = "1"; value.dispatchEvent(new Event("change")); }
    }
    button(modal, action === "up" ? "Move up" : action === "down" ? "Move down" : "Move to property").click();
    await vi.waitFor(() => expect(draft.cancel).toHaveBeenCalledOnce());
    expect(draft.submit).toHaveBeenCalledWith({ action, sourceIndex: action === "up" ? 1 : 0, sourceProperty: "tags", targetProperty: "related" });
    expect(modal.contentEl.isConnected).toBe(false);
  });

  it("waits for a submitted edit, prevents duplicate activation and does not treat closing as cancellation", async () => {
    const draft = createDraft();
    let resolve: (value: boolean) => void = () => undefined;
    draft.submit.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    const down = button(modal, "Move down");
    down.click();
    down.dispatchEvent(new MouseEvent("click"));
    modal.close();
    expect(draft.submit).toHaveBeenCalledOnce();
    expect(draft.cancel).not.toHaveBeenCalled();
    expect(modal.contentEl.getAttribute("aria-busy")).toBe("true");
    expect(button(modal, "Cancel").disabled).toBe(true);
    expect(modal.contentEl.querySelector("input")?.disabled).toBe(true);
    button(modal, "Move to last").dispatchEvent(new MouseEvent("click"));
    expect(draft.submit).toHaveBeenCalledOnce();
    expect(modal.contentEl.querySelector('[role="status"]')?.textContent).toBe("Updating the note…");
    resolve(true);
    await vi.waitFor(() => expect(draft.cancel).toHaveBeenCalledOnce());
  });

  it.each([false, "throw"])("requires a fresh dialog after a rejected or uncertain outcome: %s", async (outcome) => {
    const draft = createDraft();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    if (outcome === "throw") draft.submit.mockRejectedValue(new Error("host failed"));
    else draft.submit.mockResolvedValue(false);
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    const down = button(modal, "Move down");
    down.click();
    await vi.waitFor(() => expect(modal.contentEl.textContent).toContain("Close this dialog and reopen"));
    down.dispatchEvent(new MouseEvent("click"));
    expect(draft.submit).toHaveBeenCalledOnce();
    expect(button(modal, "Cancel").disabled).toBe(false);
    button(modal, "Cancel").click();
    expect(draft.cancel).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("cancels an unused draft and makes retained controls inert", () => {
    const draft = createDraft();
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    const down = button(modal, "Move down");
    button(modal, "Cancel").click();
    down.dispatchEvent(new MouseEvent("click"));
    expect(draft.cancel).toHaveBeenCalledOnce();
    expect(draft.submit).not.toHaveBeenCalled();
  });

  it("releases a pending dialog on unload and ignores a late result", async () => {
    const draft = createDraft();
    let resolve: (value: boolean) => void = () => undefined;
    draft.submit.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const modal = new KeyboardValueOrderModal({} as never, draft, t);
    modal.open();
    button(modal, "Move down").click();
    modal.dispose();
    resolve(false);
    await Promise.resolve();
    expect(modal.contentEl.textContent).toBe("");
    expect(modal.contentEl.isConnected).toBe(false);
    expect(draft.cancel).toHaveBeenCalledOnce();
    modal.onOpen();
    expect(modal.contentEl.textContent).toBe("");
  });

  it("supports RTL and disables cross-property moves when no target exists", () => {
    const draft = createDraft();
    const modal = new KeyboardValueOrderModal({} as never, { ...draft, properties: draft.properties.slice(0, 1) }, t, "rtl");
    modal.open();
    expect(modal.contentEl.dir).toBe("rtl");
    expect(modal.titleEl.dir).toBe("rtl");
    expect(button(modal, "Move to property").disabled).toBe(true);
    expect(modal.contentEl.querySelectorAll("select")[2]?.disabled).toBe(true);
    modal.close();
  });

  it.each(SUPPORTED_LOCALES)("labels direct destination controls in $id", ({ id }) => {
    const translate = (key: TranslationKey) => getTranslation(id, key);
    const modal = new KeyboardValueOrderModal({} as never, createDraft(), translate, id === "ar" ? "rtl" : "ltr");
    modal.open();
    expect(modal.contentEl.querySelector("input")?.closest("label")?.textContent).toBe(translate("keyboard.position"));
    for (const key of ["keyboard.atPosition", "keyboard.first", "keyboard.last"] as const) {
      expect(button(modal, translate(key)).textContent).toBe(translate(key));
    }
    modal.close();
  });
});

it("shows the real planner’s before/after formats including text conversion and comment loss", () => {
  const root = document.createElement("div");
  renderWritebackFormatExamples(root, t);
  expect(root.querySelector("details")?.open).toBe(false);
  const examples = Array.from(root.querySelectorAll("code")).map((code) => code.textContent);
  expect(examples).toHaveLength(4);
  expect(examples[0]).toContain("- 12\n  - true");
  expect(examples[1]).toContain("# Keep with alpha");
  expect(examples[1]).toContain('"12"');
  expect(examples[2]).toContain('tags: [beta, alpha, "12", "true"]');
  expect(examples[2]).not.toContain("# Keep with alpha");
  expect(examples[3]).toContain("- beta\n");
});
