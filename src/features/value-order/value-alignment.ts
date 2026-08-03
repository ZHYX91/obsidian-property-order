import type { PropertyPillValueEvidence } from "../../obsidian/properties-dom";

interface ExactWholeWikiLink {
  target: string;
  alias: string | null;
}

export function arePropertyListValuesAligned(
  expectedValues: readonly string[] | null,
  visibleValues: readonly PropertyPillValueEvidence[] | null,
): boolean {
  return (
    expectedValues != null &&
    visibleValues != null &&
    expectedValues.length === visibleValues.length &&
    expectedValues.every((value, index) => {
      const visibleValue = visibleValues[index];
      return visibleValue != null && isPropertyValueAligned(value, visibleValue);
    })
  );
}

function isPropertyValueAligned(
  expectedValue: string,
  visibleValue: PropertyPillValueEvidence,
): boolean {
  if (visibleValue.kind === "unsupported") {
    return false;
  }

  if (visibleValue.kind === "text") {
    return visibleValue.text === expectedValue;
  }

  const expectedLink = parseExactWholeWikiLink(expectedValue);

  if (expectedLink == null) {
    return false;
  }

  if (
    normalizeHostTarget(visibleValue.target) !== normalizeHostTarget(expectedLink.target)
  ) {
    return false;
  }

  if (expectedLink.alias == null) {
    return true;
  }

  return visibleValue.text === expectedLink.alias;
}

function normalizeHostTarget(target: string): string {
  return target.trim().normalize("NFC");
}

function parseExactWholeWikiLink(value: string): ExactWholeWikiLink | null {
  const trimmed = value.trim();

  if (!/^\[\[[^[\]\n]+\]\]$/u.test(trimmed)) {
    return null;
  }

  const inner = trimmed.slice(2, -2);
  const separatorIndex = inner.indexOf("|");

  if (separatorIndex !== -1) {
    const target = inner.slice(0, separatorIndex);
    const alias = inner.slice(separatorIndex + 1);

    if (
      target.length === 0 ||
      alias.length === 0 ||
      inner.indexOf("|", separatorIndex + 1) !== -1
    ) {
      return null;
    }

    return { target, alias };
  }

  return { target: inner, alias: null };
}
