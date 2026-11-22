import { getFrontmatterListPropertyScalars, createTextListReader, getFrontmatterTextListProperty, type FrontmatterScalar, type TextListProperty } from "../../core/frontmatter";
import { findPropertyListContextByKey, getListTypeMismatchDisplayValue, getPropertyPillValueEvidence, type PropertyContainerContext } from "../../obsidian/properties-dom";
import { arePropertyListValuesAligned } from "./value-alignment";

export function isSourceContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  return alignPropertyList(context, getFrontmatterTextListProperty(content, context.propertyKey))?.canSource === true;
}

export function isTargetContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  return alignPropertyList(context, getFrontmatterTextListProperty(content, context.propertyKey)) !== null;
}

export function alignPropertyList(context: PropertyContainerContext, property: TextListProperty | null) {
  if (property === null) return null;
  const { values, scalars } = property;
  if (context.editorKind === "multi-select") {
    return arePropertyListValuesAligned(values, getPropertyPillValueEvidence(context))
      ? { values, canSource: true } : null;
  }
  const display = getListTypeMismatchDisplayValue(context);
  if (display === null || !matchesMismatchDisplay(values, scalars, display)) return null;
  return { values, canSource: values.length <= 1 };
}

export function arePropertiesAlignedWithContent(
  paneContainer: HTMLElement,
  propertyKeys: readonly string[],
  content: string,
): boolean {
  const read = createTextListReader(content);
  return propertyKeys.every((propertyKey) => {
    const context = findPropertyListContextByKey(paneContainer, propertyKey);
    return (
      context != null &&
      alignPropertyList(context, read(context.propertyKey)) !== null
    );
  });
}

function matchesMismatchDisplay(
  expectedTextValues: readonly string[],
  expectedScalars: readonly FrontmatterScalar[],
  displayedValue: string,
): boolean {
  if (expectedTextValues.length === 0) {
    return displayedValue === "" || displayedValue === "null" || displayedValue === "~";
  }

  if (expectedTextValues.length === 1) {
    const expectedScalar = expectedScalars[0];
    return (
      expectedScalar != null &&
      (displayedValue === expectedTextValues[0] || displayedValue === expectedScalar.value)
    );
  }

  const displayedScalars = parseMismatchDisplayScalars(displayedValue);
  return (
    displayedScalars != null &&
    displayedScalars.length === expectedScalars.length &&
    expectedScalars.every((expectedScalar, index) => {
      const displayedScalar = displayedScalars[index];

      if (displayedScalar == null || displayedScalar.value !== expectedScalar.value) {
        return false;
      }

      return (
        displayedScalar.kind === expectedScalar.kind ||
        (expectedScalar.kind !== "string" && displayedScalar.kind === "string")
      );
    })
  );
}

function parseMismatchDisplayScalars(displayedValue: string): readonly FrontmatterScalar[] | null {
  const trimmedValue = displayedValue.trim();
  const flowValue =
    trimmedValue.startsWith("[") && trimmedValue.endsWith("]")
      ? trimmedValue
      : `[${trimmedValue}]`;
  return getFrontmatterListPropertyScalars(
    `---\nproperty-order-value: ${flowValue}\n---\n`,
    "property-order-value",
  );
}
