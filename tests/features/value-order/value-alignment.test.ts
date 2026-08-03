import { describe, expect, it } from "vitest";

import type { PropertyPillValueEvidence } from "../../../src/obsidian/properties-dom";
import { arePropertyListValuesAligned } from "../../../src/features/value-order/value-alignment";

const text = (text: string): PropertyPillValueEvidence => ({ kind: "text", text });
const link = (target: string, text: string): PropertyPillValueEvidence => ({
  kind: "link",
  target,
  text,
});
const unsupported: PropertyPillValueEvidence = { kind: "unsupported" };

describe("property list value alignment", () => {
  it("aligns plain text values by exact display text", () => {
    expect(arePropertyListValuesAligned(["alpha", "beta"], [text("alpha"), text("beta")])).toBe(
      true,
    );
  });

  it("rejects a changed plain text value", () => {
    expect(arePropertyListValuesAligned(["alpha"], [text("beta")])).toBe(false);
  });

  it("keeps aligning an unrendered wiki link shown as the full raw text", () => {
    expect(
      arePropertyListValuesAligned(["[[医院 A|医院]]"], [text("[[医院 A|医院]]")]),
    ).toBe(true);
  });

  it("aligns a rendered wiki link when target and explicit alias both match", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|医院]]"],
        [link("医院 A", "医院")],
      ),
    ).toBe(true);
  });

  it("rejects a rendered link whose target differs even when the alias matches", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|医院]]"],
        [link("医院 B", "医院")],
      ),
    ).toBe(false);
  });

  it("rejects a rendered link whose alias differs even when the target matches", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|医院]]"],
        [link("医院 A", "门诊")],
      ),
    ).toBe(false);
  });

  it("aligns an alias-less wiki link by target identity alone", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[目录/医院 A]]"],
        [link("目录/医院 A", "医院 A")],
      ),
    ).toBe(true);
  });

  it("rejects an alias-less wiki link whose target differs", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A]]"],
        [link("医院 B", "医院 B")],
      ),
    ).toBe(false);
  });

  it("rejects a plain expected value against rendered link evidence", () => {
    expect(
      arePropertyListValuesAligned(["医院 A"], [link("医院 A", "医院 A")]),
    ).toBe(false);
  });

  it("rejects malformed wiki link syntax against rendered link evidence", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|医院|重复]]"],
        [link("医院 A", "医院")],
      ),
    ).toBe(false);
    expect(
      arePropertyListValuesAligned(
        ["[[|空目标]]"],
        [link("空目标", "空目标")],
      ),
    ).toBe(false);
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|]]"],
        [link("医院 A", "医院 A")],
      ),
    ).toBe(false);
    expect(arePropertyListValuesAligned(["前缀[[医院 A]]"], [link("医院 A", "医院 A")])).toBe(
      false,
    );
  });

  it("fails closed on unsupported pill evidence", () => {
    expect(arePropertyListValuesAligned(["alpha"], [unsupported])).toBe(false);
    expect(
      arePropertyListValuesAligned(["[[医院 A|医院]]"], [unsupported]),
    ).toBe(false);
  });

  it("rejects a changed value count", () => {
    expect(
      arePropertyListValuesAligned(
        ["alpha", "beta"],
        [text("alpha"), text("beta"), text("gamma")],
      ),
    ).toBe(false);
    expect(arePropertyListValuesAligned(["alpha", "beta"], [text("alpha")])).toBe(false);
  });

  it("rejects a changed order at the same index", () => {
    expect(
      arePropertyListValuesAligned(
        ["alpha", "beta"],
        [text("beta"), text("alpha")],
      ),
    ).toBe(false);
  });

  it("still proves repeated links by index", () => {
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|医院]]", "[[医院 A|医院]]"],
        [link("医院 A", "医院"), link("医院 A", "医院")],
      ),
    ).toBe(true);
    expect(
      arePropertyListValuesAligned(
        ["[[医院 A|医院]]", "[[医院 A|医院]]"],
        [link("医院 A", "医院"), link("医院 A", "门诊")],
      ),
    ).toBe(false);
  });

  it("fails closed when either side is missing", () => {
    expect(arePropertyListValuesAligned(null, [text("alpha")])).toBe(false);
    expect(arePropertyListValuesAligned(["alpha"], null)).toBe(false);
  });
});
