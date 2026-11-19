// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { preserveSettingsView, preserveValueSuggestionDrafts } from "../../src/app/settings-view-state";

it("restores ancestor scrolling and the corresponding control after a local replacement", () => {
  const page = document.body.createDiv();
  const editor = page.createDiv();
  const input = editor.createEl("input");
  input.dataset.settingsFocus = "custom-add:pinned";
  input.focus();
  page.scrollTop = 640;
  preserveSettingsView(editor, () => {
    editor.replaceChildren();
    page.scrollTop = 0;
    const replacement = editor.createEl("input");
    replacement.dataset.settingsFocus = "custom-add:pinned";
  });
  expect(page.scrollTop).toBe(640);
  expect(document.activeElement).toBe(editor.querySelector("input"));
  page.remove();
});

it("preserves both custom value placement drafts and restores the active input after rerender", () => {
  const page = document.body.createDiv();
  const editor = page.createDiv({ cls: "property-order-custom-value-add" });
  const pinned = editor.createEl("input");
  pinned.dataset.settingsFocus = "custom-add:pinned";
  pinned.value = "keep pinned draft";
  const bottom = editor.createEl("input");
  bottom.dataset.settingsFocus = "custom-add:bottom";
  bottom.value = "keep bottom draft";
  bottom.focus();
  bottom.setSelectionRange(5, 10);

  preserveValueSuggestionDrafts(editor, () => {
    editor.replaceChildren();
    const nextPinned = editor.createEl("input");
    nextPinned.dataset.settingsFocus = "custom-add:pinned";
    const nextBottom = editor.createEl("input");
    nextBottom.dataset.settingsFocus = "custom-add:bottom";
  });

  const nextPinned = editor.querySelector<HTMLInputElement>('[data-settings-focus="custom-add:pinned"]')!;
  const nextBottom = editor.querySelector<HTMLInputElement>('[data-settings-focus="custom-add:bottom"]')!;
  expect(nextPinned.value).toBe("keep pinned draft");
  expect(nextBottom.value).toBe("keep bottom draft");
  expect(nextBottom.selectionStart).toBe(5);
  expect(nextBottom.selectionEnd).toBe(10);
  expect(document.activeElement).toBe(nextBottom);
  page.remove();
});
