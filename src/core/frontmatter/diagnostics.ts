import { extractFrontmatterBounds, physicalLines } from "./bounds";
import { parseTopLevelPropertyLine } from "./property-line";
import { indexFrontmatterProperties } from "./property-reader";
import type { FrontmatterDiagnosis } from "./types";

export function diagnoseFrontmatterReorder(
  content: string,
  propertyKey: string,
): FrontmatterDiagnosis {
  const frontmatter = extractFrontmatterBounds(content);

  if (frontmatter == null) {
    return "no_frontmatter";
  }

  const lines = physicalLines(frontmatter.body);
  let hasMatchingProperty = false;

  for (const { text: line } of lines) {
    const propertyLine = parseTopLevelPropertyLine(line);

    if (propertyLine == null || propertyLine.key !== propertyKey) {
      continue;
    }

    hasMatchingProperty = true;
    break;
  }

  if (!hasMatchingProperty) {
    return "property_not_found";
  }

  return indexFrontmatterProperties(frontmatter.body)(propertyKey) == null ? "unsupported_property" : "ok";
}
