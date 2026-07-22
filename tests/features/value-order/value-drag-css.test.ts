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
});
