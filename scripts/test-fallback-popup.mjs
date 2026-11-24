import assert from "node:assert/strict";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright-core";

const fixture = await build({
  stdin: {
    contents: `
      import "./tests/setup/obsidian-dom";
      import { mountCustomValuePopup } from "./src/features/value-suggestions/custom-value-popup";
      window.openChoices = (count, selected) => {
        const input = document.querySelector("input");
        return mountCustomValuePopup({ editor: input, row: input.parentElement, propertyKey: "status" },
          Array.from({length: count}, (_, i) => String(i)), () => {}, String(selected));
      };`,
    resolveDir: process.cwd(),
  },
  alias: { obsidian: resolve("tests/mocks/obsidian.ts") },
  bundle: true, platform: "browser", write: false,
});
const browser = await chromium.launch(process.env.CHROME_BIN
  ? { executablePath: process.env.CHROME_BIN } : { channel: "chrome" });
try {
  for (const direction of ["ltr", "rtl"]) {
    const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
    await page.setContent(`<main dir="${direction}"><input style="position:fixed;left:200px;top:20px;width:90px"></main>
      <style>.suggestion-item { padding:6px } .suggestion-container { width:180px }</style>`);
    await page.addStyleTag({ path: "styles.css" });
    await page.addScriptTag({ content: fixture.outputFiles[0].text });
    for (const count of [24, 32, 33, 96]) {
      const selected = count - 2;
      const result = await page.evaluate(({ count, selected }) => {
        const input = document.querySelector("input");
        input.focus();
        const popup = window.openChoices(count, selected);
        const list = popup.container;
        const row = list.querySelector(".is-selected");
        const anchor = input.getBoundingClientRect();
        const rect = list.getBoundingClientRect();
        const option = row.getBoundingClientRect();
        const result = {
          selected: popup.getSelectedValue(), visible: option.top >= rect.top - 1 && option.bottom <= rect.bottom + 1,
          named: list.getAttribute("aria-label"), ownsFocus: document.activeElement === input,
          startDelta: getComputedStyle(input).direction === "rtl" ? anchor.right - rect.right : anchor.left - rect.left,
        };
        list.scrollTop = 0;
        list.dispatchEvent(new Event("scroll"));
        window.dispatchEvent(new Event("resize"));
        result.manualScroll = list.scrollTop;
        popup.cleanup();
        return result;
      }, { count, selected });
      assert.equal(result.selected, String(selected));
      assert.ok(result.visible, `Restored option outside ${direction} list of ${count}`);
      assert.ok(result.ownsFocus);
      assert.equal(result.named, "status");
      assert.ok(Math.abs(result.startDelta) < 1, `Detached ${direction} anchor`);
      assert.equal(result.manualScroll, 0);
    }
    await page.close();
  }
  console.log("Fallback selections and popup anchors passed in both writing directions.");
} finally {
  await browser.close();
}
