import type { FrontmatterBounds } from "./types";
import { parseTopLevelPropertyLine } from "./property-line";
import { splitInlineComment } from "./scalar";

const FRONTMATTER_OPENING_DELIMITER_PATTERN = /^\uFEFF?---[ \t]*(\r\n|\r|\n)/u;
const FRONTMATTER_CLOSING_DELIMITER_PATTERN = /^(?:---|\.\.\.)[ \t]*$/u;

export function extractFrontmatterBounds(content: string): FrontmatterBounds | null {
  const opening = FRONTMATTER_OPENING_DELIMITER_PATTERN.exec(content);
  if (opening === null) return null;
  const newline = opening[1];
  const bodyStart = opening[0].length;
  let blockScalar: BlockScalarState | null = null;
  for (const { text: line, start } of physicalLines(content, bodyStart)) {
    const indentation = getIndentation(line);

    if (blockScalar != null) {
      if (line.trim().length === 0) {
        continue;
      }

      const contentIndent = blockScalar.contentIndent ?? indentation;

      if (indentation > blockScalar.parentIndent && indentation >= contentIndent) {
        blockScalar.contentIndent = contentIndent;
        continue;
      }

      blockScalar = null;
    }

    if (FRONTMATTER_CLOSING_DELIMITER_PATTERN.test(line)) {
      return { body: content.slice(bodyStart, start), bodyStart, bodyEnd: start, newline };
    }

    blockScalar = parseBlockScalarHeader(line);
  }
  return null;
}

interface BlockScalarState {
  contentIndent: number | null;
  parentIndent: number;
}

function parseBlockScalarHeader(line: string): BlockScalarState | null {
  const indentationText = /^[ \t]*/.exec(line)?.[0] ?? "";
  const headerText = line.slice(indentationText.length);
  const propertyLine = parseTopLevelPropertyLine(headerText);
  const sequenceItemMatch = /^-\s+(.*)$/.exec(headerText);
  const headerValues: string[] = [];

  if (propertyLine != null) {
    headerValues.push(propertyLine.restText);
  }

  if (sequenceItemMatch != null) {
    headerValues.push(sequenceItemMatch[1]);
  }

  const parentIndent = getIndentation(indentationText);

  for (const headerValue of headerValues) {
    const { rawValue } = splitInlineComment(headerValue.trim());
    const match = /^(?:(?:![^\s]+|&[^\s]+)\s+)*[>|]([1-9+-]{0,2})$/.exec(
      rawValue.trim(),
    );

    if (match == null) {
      continue;
    }

    const explicitIndent = /[1-9]/.exec(match[1])?.[0];

    return {
      parentIndent,
      contentIndent: explicitIndent == null ? null : parentIndent + Number(explicitIndent),
    };
  }

  return null;
}

function getIndentation(line: string): number {
  const whitespace = /^[ \t]*/.exec(line)?.[0] ?? "";
  return whitespace.replace(/\t/g, "  ").length;
}

/** Offsets are UTF-16 positions in the authored text, including mixed line endings. */
export function* physicalLines(content: string, from = 0) {
  const breaks = /\r\n|[\r\n]/gu;
  breaks.lastIndex = from;
  let start = from;
  for (const match of content.matchAll(breaks)) {
    yield { text: content.slice(start, match.index), start };
    start = match.index + match[0].length;
  }
  yield { text: content.slice(start), start };
}
