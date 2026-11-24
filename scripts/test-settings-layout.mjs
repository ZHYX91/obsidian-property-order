import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch(process.env.CHROME_BIN
  ? { executablePath: process.env.CHROME_BIN } : { channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
  // The second select measures the natural text width in Obsidian. Hiding or
  // shrinking it produces an incorrect width for the actual dropdown.
  await page.setContent(`<style>
    main { container-type:inline-size; font:20px system-ui }
    .setting-item { position:relative; display:flex; gap:8px }
    .setting-item-control { display:flex; justify-content:flex-end; width:100% }
    .dropdown.is-measuring { position:absolute; visibility:hidden; width:max-content!important; max-width:none!important }
    button { white-space:nowrap }
  </style><main><section class="property-order-settings-panel"><div class="setting-item">
    <div class="setting-item-control"><select class="dropdown"><option>Aktuell</option></select>
    <select aria-hidden="true" tabindex="-1" class="dropdown is-measuring">
      <option>Nummern nach bekannten Schematiteln und benutzerdefinierten Nummerierungen erkennen</option>
    </select></div></div><div class="property-order-value-behavior-add"><button>Ajouter une très longue règle de classement</button></div></section></main>`);
  await page.addStyleTag({ path: "styles.css" });
  for (const direction of ["ltr", "rtl"]) {
    for (const width of [260, 320, 760]) {
      const result = await page.evaluate(({ direction, width }) => {
        const main = document.querySelector("main");
        main.dir = direction;
        main.style.width = width + "px";
        const panel = main.querySelector("section");
        const probe = main.querySelector(".is-measuring");
        return { actual: panel.scrollWidth, expected: panel.clientWidth, measured: probe.offsetWidth };
      }, { direction, width });
      assert.ok(result.actual <= result.expected + 1, `${direction} ${width}px overflow: ${result.actual}`);
      assert.ok(result.measured > 320, "Host dropdown must still measure natural width");
    }
  }
  console.log("Narrow settings keep the host dropdown measurement without horizontal scrolling.");
} finally {
  await browser.close();
}
