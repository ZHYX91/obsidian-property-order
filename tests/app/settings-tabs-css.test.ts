import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

describe("settings tab layout CSS", () => {
  it("keeps the tab list on one horizontally scrollable row", () => {
    expect(styles).toMatch(
      /\.property-order-settings-tabs\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden;/s,
    );
  });

  it("uses stable fine- and coarse-pointer target heights", () => {
    expect(styles).toMatch(
      /\.property-order-settings-tab\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*34px;[^}]*min-height:\s*34px;[^}]*white-space:\s*nowrap;/s,
    );
    expect(styles).toMatch(
      /@media \(pointer:\s*coarse\)[\s\S]*?\.property-order-settings-tab\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s,
    );
  });

  it("stacks property-name rule controls on narrow screens", () => {
    expect(styles).toMatch(
      /@media \(max-width:\s*480px\)[\s\S]*?\.property-order-key-list-setting \.setting-item-control\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*480px\)[\s\S]*?\.property-order-key-list-input,[\s\S]*?\.property-order-property-name-input\s*\{[^}]*box-sizing:\s*border-box;[^}]*min-width:\s*0;[^}]*width:\s*100%;/s,
    );
  });

  it("provides a visible keyboard focus treatment", () => {
    expect(styles).toMatch(
      /\.property-order-settings-tab:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\);[^}]*outline-offset:\s*-2px;/s,
    );
  });
});
