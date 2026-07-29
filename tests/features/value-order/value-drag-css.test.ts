import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../../../styles.css", import.meta.url), "utf8");

describe("property value drag CSS", () => {
  it("keeps native touch scrolling available while property value drag is enabled", () => {
    expect(styles).toMatch(
      /body\.property-order-value-drag-enabled \.metadata-property \.multi-select-pill\s*\{[^}]*touch-action:\s*manipulation;/s,
    );
    expect(styles).not.toMatch(
      /(?:^|})\s*\.metadata-property \.multi-select-pill\s*\{[^}]*touch-action:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /body\.property-order-value-drag-enabled \.metadata-property \.multi-select-pill\s*\{[^}]*touch-action:\s*none;/s,
    );
  });

  it("disables touch scrolling only for the value armed from the mobile menu", () => {
    expect(styles).toMatch(
      /\.property-order-mobile-reorder-armed\s*\{[^}]*outline:[^}]*touch-action:\s*none\s*!important;/s,
    );
    expect(styles).not.toContain("property-order-mobile-reorder-active");
    expect(styles).not.toMatch(
      /\.property-order-mobile-reorder-armed\s*\{[^}]*box-shadow:/s,
    );
  });

  it("keeps the floating preview on one clipped line without consuming source content space", () => {
    expect(styles).toMatch(
      /\.property-order-drag-preview\s*\{[^}]*box-sizing:\s*border-box;[^}]*overflow:\s*hidden;[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*box-shadow:\s*inset 0 0 0 1px[^}]*white-space:\s*nowrap;/s,
    );
    expect(styles).toMatch(
      /\.property-order-drag-preview \.multi-select-pill-content\s*\{[^}]*min-width:\s*1ch;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s,
    );
    expect(styles).toMatch(
      /\.property-order-drag-preview \.multi-select-pill-remove-button\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("shows a rejected property target with a no-drop cursor", () => {
    expect(styles).toMatch(
      /body\.property-order-drag-cursor-active\.property-order-drag-cursor-invalid[^}]*\{[^}]*cursor:\s*not-allowed\s*!important;/s,
    );
    expect(styles).toMatch(
      /\.metadata-property\.property-order-invalid-drop-target\s*\{[^}]*outline:\s*2px solid var\(--text-error\);[^}]*background:/s,
    );
  });

  it("adds a dedicated grip without covering a native list-type mismatch input", () => {
    expect(styles).toMatch(
      /body\.property-order-value-drag-enabled[\s\S]*?\.metadata-property:not\(:has\(\.multi-select-container\)\):has\([\s\S]*?\.metadata-property-icon[\s\S]*?\):has\(\.metadata-property-warning-icon\)[\s\S]*?\.metadata-property-value\s*\{[^}]*position:\s*relative;[^}]*padding-inline-end:\s*24px;/s,
    );
    expect(styles).toMatch(
      /\.metadata-property-value::after\s*\{[^}]*inset-inline-end:\s*3px;[^}]*width:\s*18px;[^}]*content:\s*"⠿";[^}]*cursor:\s*grab;[^}]*touch-action:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /\.metadata-property-value(?:\s+input)?\s*\{[^}]*pointer-events:\s*none;/s,
    );
  });
});
