import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch(process.env.CHROME_BIN
  ? { executablePath: process.env.CHROME_BIN } : { channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
  // Obsidian owns the scrolling element. Property Order can use a different
  // language inside it, and the dropdown reads offsetWidth from a hidden select.
  await page.setContent(`<style>
    main { box-sizing:border-box; height:400px; padding-inline:32px; overflow-y:auto; container-type:inline-size; font:20px system-ui }
    .setting-item { position:relative; display:flex; gap:8px }
    .setting-item-info { align-self:flex-start }
    .setting-item-name,.setting-item-description { overflow:hidden }
    .setting-item-control .external-link { padding-inline-end:.9em }
    .setting-item-control button { font:inherit; height:28px }
    .support { flex-direction:column; padding-inline:16px }
    .setting-item-control { display:flex; justify-content:flex-end; width:100% }
    .dropdown.is-measuring { position:absolute; visibility:hidden; width:max-content!important; max-width:none!important }
    button { white-space:nowrap }
  </style><main class="vertical-tab-content"><div class="property-order-settings-content">
    <section class="property-order-settings-panel"><div class="setting-item">
    <div class="setting-item-control"><select class="dropdown"><option>Aktuell</option></select>
    <select aria-hidden="true" tabindex="-1" class="dropdown is-measuring">
      <option>Nummern nach bekannten Schematiteln und benutzerdefinierten Nummerierungen erkennen</option>
    </select></div></div><div class="setting-item support property-order-settings-support">
    <div class="setting-item-info"><div class="setting-item-name">Eigenschaftswertvorschläge</div>
    <div class="setting-item-description">Eigenschaftswertvorschläge anpassen</div></div>
    <div class="setting-item-control"><a class="external-link" href="#guide">Benutzerhandbuch</a></div>
    <div class="setting-item-control"><button>Effacer les compteurs</button></div></div><div class="property-order-value-behavior-add"><button>Ajouter une très longue règle de classement</button></div></section></div></main>`);
  await page.addStyleTag({ path: "styles.css" });
  for (const hostDirection of ["ltr", "rtl"]) {
    for (const pluginDirection of ["ltr", "rtl"]) {
      for (const width of [260, 320, 760]) {
        const result = await page.evaluate(({ hostDirection, pluginDirection, width }) => {
          document.documentElement.dir = hostDirection;
          const main = document.querySelector("main");
          main.style.width = width + "px";
          const content = main.querySelector(".property-order-settings-content");
          content.dir = pluginDirection;
          const panel = content.querySelector("section");
          const probe = panel.querySelector(".is-measuring");
          return {
            hostOverflow: main.scrollWidth - main.clientWidth,
            panelOverflow: panel.scrollWidth - panel.clientWidth,
            measured: probe.offsetWidth,
            contentFits: Array.from(panel.querySelectorAll(".support .setting-item-name,.support .setting-item-description,.support a,.support button")).every((element) =>
              element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1 &&
              element.getBoundingClientRect().width <= element.parentElement.getBoundingClientRect().width + 1),

          };
        }, { hostDirection, pluginDirection, width });
        const description = `host ${hostDirection}, plugin ${pluginDirection}, ${width}px`;
        assert.ok(result.hostOverflow <= 1, `${description}: settings scroller overflowed by ${result.hostOverflow}px`);
        assert.ok(result.panelOverflow <= 1, `${description}: panel overflowed by ${result.panelOverflow}px`);
        assert.ok(result.contentFits, `${description}: a translated label, guide link or action is clipped`);
        assert.ok(result.measured > 320, "Host dropdown must still measure natural width");
      }
    }
  }
  // Paging controls must meet the shared 44 × 44 CSS-pixel target on touch.
  const touchPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await touchPage.setContent(`<div class="property-order-settings-tab-strip">
      <button class="property-order-settings-tab-scroll" data-direction="earlier" aria-label="Previous tabs"></button>
      <div class="property-order-settings-tabs">
        <button class="property-order-settings-tab is-active">General</button>
        <button class="property-order-settings-tab">Value order</button>
      </div>
      <button class="property-order-settings-tab-scroll" data-direction="later" aria-label="Next tabs"></button>
    </div>`);
    await touchPage.addStyleTag({ path: "styles.css" });
    const geometry = await touchPage.locator(".property-order-settings-tab-scroll").evaluateAll((buttons) => ({
      coarse: window.matchMedia("(pointer: coarse)").matches,
      bounds: buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    }));
    assert.equal(geometry.coarse, true, "touch fixture must expose a coarse primary pointer");
    assert.equal(geometry.bounds.length, 2);
    for (const [index, rect] of geometry.bounds.entries()) {
      assert.ok(rect.width >= 44, `settings tab arrow ${index} is only ${rect.width}px wide`);
      assert.ok(rect.height >= 44, `settings tab arrow ${index} is only ${rect.height}px high`);
    }
  } finally {
    await touchPage.close();
  }

  console.log("The host scroller and settings panel fit in all four host/plugin direction combinations.");
} finally {
  await browser.close();
}
