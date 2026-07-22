import { detectNewline, extractFrontmatterBounds, splitLines } from "./bounds";
import { parseTopLevelPropertyLine } from "./property-line";
import { findProperty } from "./rewrite";
import type { FrontmatterDiagnosis } from "./types";

export function diagnoseFrontmatterReorder(
  content: string,
  propertyKey: string,
): FrontmatterDiagnosis {
  const frontmatter = extractFrontmatterBounds(content);

  if (frontmatter == null) {
    return "no_frontmatter";
  }

  const lines = splitLines(frontmatter.body, detectNewline(frontmatter.body));
  let hasMatchingProperty = false;

  for (const line of lines) {
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

  return findProperty(frontmatter.body, propertyKey) == null ? "unsupported_property" : "ok";
}
