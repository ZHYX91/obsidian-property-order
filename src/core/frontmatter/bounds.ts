import type { FrontmatterBounds } from "./types";
import { parseTopLevelPropertyLine } from "./property-line";
import { splitInlineComment } from "./scalar";

export function extractFrontmatterBounds(content: string): FrontmatterBounds | null {
  const newline = detectNewline(content);
  const lines = splitLines(content, newline);
  const openingLine = lines[0]?.replace(/^\uFEFF/, "").trim();

  if (lines.length < 2 || openingLine !== "---") {
    return null;
  }

  const lineOffsets = getLineOffsets(lines, newline);
  let closingLineIndex = -1;
  let blockScalar: BlockScalarState | null = null;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
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

    const candidate = line.trim();

    if (candidate === "---" || candidate === "...") {
      closingLineIndex = index;
      break;
    }

    blockScalar = parseBlockScalarHeader(line);
  }

  if (closingLineIndex === -1) {
    return null;
  }

  const bodyStart = lineOffsets[1];
  const bodyEnd = lineOffsets[closingLineIndex];

  return {
    body: content.slice(bodyStart, bodyEnd),
    bodyStart,
    bodyEnd,
    newline,
  };
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
    const match = /^(?:(?:![^\s]+|&[^\s]+)\s+)*[>|]([1-9+\-]{0,2})$/.exec(
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

export function detectNewline(input: string): string {
  return /\r\n|\n|\r/.exec(input)?.[0] ?? "\n";
}

export function splitLines(input: string, newline: string): string[] {
  return input.length === 0 ? [] : input.split(newline);
}

export function getLineOffsets(lines: string[], newline: string): number[] {
  const offsets: number[] = [];
  let currentOffset = 0;

  for (const line of lines) {
    offsets.push(currentOffset);
    currentOffset += line.length + newline.length;
  }

  return offsets;
}
