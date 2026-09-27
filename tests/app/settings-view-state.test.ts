// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { preserveSettingsView } from "../../src/app/settings-view-state";

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
