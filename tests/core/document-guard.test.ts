import { describe, expect, it } from "vitest";

import { isSameNoteDocument } from "../../src/core/interaction/document-guard";

describe("isSameNoteDocument", () => {
  it("accepts only the exact file path captured at drag start", () => {
    expect(isSameNoteDocument("folder/source.md", "folder/source.md")).toBe(true);
    expect(isSameNoteDocument("folder/source.md", "folder/other.md")).toBe(false);
    expect(isSameNoteDocument("folder/source.md", null)).toBe(false);
    expect(isSameNoteDocument("folder/source.md", undefined)).toBe(false);
  });
});
