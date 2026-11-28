import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("settings tab layout CSS", () => {
  it("keeps the theme accent on the disclosure chevron and the logical content edge", () => {
    expect(styles).toMatch(/\.property-order-help-disclosure\s*\{[^}]*background-color: color-mix\(in srgb, var\(--interactive-accent\) 5%, var\(--background-primary\)\);[^}]*border: 1px solid var\(--background-modifier-border\);/s);
    expect(styles).toMatch(/\.property-order-help-disclosure > [^{]*summary::before\s*\{[^}]*color: var\(--interactive-accent\);/s);
    expect(styles).toMatch(/\.property-order-help-disclosure\[open\] > [^{]+\{[^}]*border-inline-start: 2px solid var\(--interactive-accent\);/s);
  });

  it("uses compact tab padding when the settings strip is at most 600px wide", () => {
    expect(styles).toMatch(
      /@container \(max-width:\s*600px\)\s*\{\s*\.property-order-settings-content \.property-order-settings-tab-strip > \.property-order-settings-tabs > button\.property-order-settings-tab\s*\{[^}]*padding-inline:\s*8px/s,
    );
  });

  it("keeps the tab list on one horizontally scrollable row", () => {
    expect(styles).toMatch(
      /\.property-order-settings-tabs\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s,
    );
  });

  it("resets theme button chrome and uses only an active underline", () => {
    expect(styles).toMatch(
      /> button\.property-order-settings-tab\s*\{[^}]*appearance:\s*none;[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-block-end:\s*2px solid transparent;[^}]*border-radius:\s*0;/s,
    );
    expect(styles).toMatch(
      /> button\.property-order-settings-tab\.is-active,[\s\S]*?border-block-end-color:\s*var\(--interactive-accent\);/s,
    );
    expect(styles).toMatch(
      /> button\.property-order-settings-tab\.is-active,[\s\S]*?font-weight:\s*var\(--font-semibold\);/s,
    );
  });

  it("scales with UI text and preserves a 44px coarse-pointer target", () => {
    expect(styles).toMatch(
      /> button\.property-order-settings-tab\s*\{[^}]*block-size:\s*auto;[^}]*min-block-size:\s*34px;[^}]*padding:\s*7px 12px;/s,
    );
    expect(styles).not.toMatch(/\.property-order-settings-tab[^}]*\bheight:\s*34px/s);
    expect(styles).toMatch(
      /@media \(pointer:\s*coarse\)[\s\S]*?> button\.property-order-settings-tab\s*\{[^}]*min-block-size:\s*44px;/s,
    );
  });

  it("keeps a stable gap before the active settings panel", () => {
    expect(styles).toMatch(
      /\.property-order-settings-panel\s*\{[^}]*margin-block-start:\s*var\(--size-4-5\);/s,
    );
  });

  it("stacks candidate and property-name controls inside a narrow settings panel", () => {
    const scoped = styles.match(/@container [\w-]+ \(max-width:\s*480px\)\s*\{(.*?)^\}/ms)?.[1];
    expect(scoped).toBeDefined();
    expect(scoped).toMatch(
      /\.property-order-custom-value-layout\s*\{[^}]*grid-template-columns:\s*(?:minmax\(0, 1fr\)|1fr);/s,
    );
    expect(scoped).toMatch(
      /\.property-order-key-list-setting \.setting-item-control,\s*\.property-order-rule-diagnostic-setting \.setting-item-control\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/s,
    );
    expect(scoped).toMatch(
      /\.property-order-key-list-input,[\s\S]*?\.property-order-property-name-input,[\s\S]*?\.property-order-rule-diagnostic-input\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s,
    );
  });

  it("provides a visible keyboard focus treatment", () => {
    expect(styles).toMatch(
      /> button\.property-order-settings-tab:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*-2px;/s,
    );
  });
});
