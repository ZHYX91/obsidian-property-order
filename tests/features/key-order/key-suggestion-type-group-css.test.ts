import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const styles = readFileSync(
  fileURLToPath(new URL("../../../styles.css", import.meta.url)),
  "utf8",
);

describe("property-type suggestion group label CSS", () => {
  it("keeps the display label outside the candidate pseudo-element hit area", () => {
    expect(styles).toMatch(
      /\.property-order-suggestion-type-group-label\s*\{[^}]*display:\s*block;[^}]*pointer-events:\s*none;[^}]*user-select:\s*none;/s,
    );
    expect(styles).not.toMatch(/\.property-order-suggestion-type-group-start::before/);
  });
});
