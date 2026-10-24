import { getFrontmatterListPropertyScalars, getFrontmatterTextListPropertyValues, type FrontmatterScalar } from "../../core/frontmatter";
import { findPropertyListContextByKey, getListTypeMismatchDisplayValue, getPropertyPillValueEvidence, type PropertyContainerContext } from "../../obsidian/properties-dom";
import { arePropertyListValuesAligned } from "./value-alignment";

export function isSourceContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  return isListContextAlignedWithContent(context, content, false);
}

export function isTargetContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  return isListContextAlignedWithContent(context, content, true);
}

export function isListContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
  allowMultipleMismatchValues: boolean,
): boolean {
  if (context.editorKind === "list-type-mismatch") {
    return isListTypeMismatchContextAlignedWithContent(
      context,
      content,
      allowMultipleMismatchValues,
    );
  }

  return isMultiSelectContextAlignedWithContent(context, content);
}

export function isMultiSelectContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
): boolean {
  if (context.editorKind !== "multi-select") {
    return false;
  }

  const expectedValues = getFrontmatterTextListPropertyValues(content, context.propertyKey);
  const visibleValues = getPropertyPillValueEvidence(context);

  return arePropertyListValuesAligned(expectedValues, visibleValues);
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
      isListContextAlignedWithContent(context, content, true)
    );
  });
}


function isListTypeMismatchContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
  allowMultipleValues: boolean,
): boolean {
  const expectedTextValues = getFrontmatterTextListPropertyValues(
    content,
    context.propertyKey,
  );
  const expectedScalars = getFrontmatterListPropertyScalars(
    content,
    context.propertyKey,
    true,
  );
  const displayedValue = getListTypeMismatchDisplayValue(context);

  if (
    expectedTextValues == null ||
    expectedScalars == null ||
    displayedValue == null ||
    expectedTextValues.length !== expectedScalars.length
  ) {
    return false;
  }

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

  if (!allowMultipleValues) {
    return false;
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
