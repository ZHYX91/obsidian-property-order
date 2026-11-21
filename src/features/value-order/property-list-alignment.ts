import { getFrontmatterListPropertyScalars, getFrontmatterTextListProperty, getFrontmatterTextListPropertyValues, type FrontmatterScalar } from "../../core/frontmatter";
import { findPropertyListContextByKey, getListTypeMismatchDisplayValue, getPropertyPillValueEvidence, type PropertyContainerContext } from "../../obsidian/properties-dom";
import { arePropertyListValuesAligned } from "./value-alignment";

export function isSourceContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  return readAlignedPropertyList(context, content)?.canSource === true;
}

export function isTargetContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  return readAlignedPropertyList(context, content) !== null;
}

export function readAlignedPropertyList(context: PropertyContainerContext, content: string) {
  if (context.editorKind === "multi-select") {
    const values = getFrontmatterTextListPropertyValues(content, context.propertyKey);
    return values !== null && arePropertyListValuesAligned(values, getPropertyPillValueEvidence(context))
      ? { values, canSource: true } : null;
  }
  const property = getFrontmatterTextListProperty(content, context.propertyKey);
  if (property === null) return null;
  const { values, scalars } = property;
  const display = getListTypeMismatchDisplayValue(context);
  if (display === null || !matchesMismatchDisplay(values, scalars, display)) return null;
  return { values, canSource: values.length <= 1 };
}

export function arePropertiesAlignedWithContent(
  paneContainer: HTMLElement,
  propertyKeys: readonly string[],
  content: string,
): boolean {
  return propertyKeys.every((propertyKey) => {
    const context = findPropertyListContextByKey(paneContainer, propertyKey);
    return (
      context != null &&
      isTargetContextAlignedWithContent(context, content)
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
