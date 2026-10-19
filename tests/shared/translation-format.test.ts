import { describe, expect, it } from "vitest";

import { formatTranslation } from "../../src/shared/translation-format";

describe("formatTranslation", () => {
  it("preserves replacement syntax and placeholder-like text inside inserted values", () => {
    expect(formatTranslation("Move {property} from {from} to {to}.", {
      property: "$& $` $' $$ {from} {to} {property}",
      from: "{to}",
      to: "Name",
    })).toBe("Move $& $` $' $$ {from} {to} {property} from {to} to Name.");
  });

  it("replaces repeated template placeholders while retaining missing and inherited names", () => {
    expect(formatTranslation(
      "Remove {property}; again {property}; {missing}; {constructor}",
      { property: "status" },
    )).toBe("Remove status; again status; {missing}; {constructor}");
  });
});
