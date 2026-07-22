import { parseDoubleQuotedScalar, parseScalarValue } from "./scalar";

export interface PropertyLine {
  key: string;
  keyText: string;
  restText: string;
}

export function parseTopLevelPropertyLine(line: string): PropertyLine | null {
  if (line.length === 0 || /^[ \t]/.test(line)) {
    return null;
  }

  const separatorIndex = findPropertySeparator(line);

  if (separatorIndex <= 0) {
    return null;
  }

  const keyText = line.slice(0, separatorIndex);
  const key = parsePropertyKey(keyText.trimEnd());

  if (key == null) {
    return null;
  }

  return {
    key,
    keyText,
    restText: line.slice(separatorIndex + 1),
  };
}

function findPropertySeparator(line: string): number {
  if (line.startsWith("'") || line.startsWith("\"")) {
    return findQuotedKeySeparator(line, line[0]);
  }

  let fallbackSeparator = -1;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1] ?? "";

    if (character !== ":") {
      continue;
    }

    if (nextCharacter.length === 0 || /[\s\[{]/.test(nextCharacter)) {
      return index;
    }

    fallbackSeparator = fallbackSeparator === -1 ? index : fallbackSeparator;
  }

  return fallbackSeparator;
}

function parsePropertyKey(rawKey: string): string | null {
  if (rawKey.length === 0) {
    return null;
  }

  if (rawKey.startsWith("'")) {
    return rawKey.endsWith("'") && rawKey.length >= 2 ? parseScalarValue(rawKey) : null;
  }

  if (rawKey.startsWith("\"")) {
    if (!rawKey.endsWith("\"") || rawKey.length < 2) {
      return null;
    }

    return parseDoubleQuotedScalar(rawKey);
  }

  if (/[\[\]{}]/.test(rawKey) || /(^|[ \t])#/.test(rawKey)) {
    return null;
  }

  return rawKey.trim();
}

function findQuotedKeySeparator(line: string, quote: string): number {
  for (let index = 1; index < line.length; index += 1) {
    if (line[index] !== quote) {
      continue;
    }

    if (quote === "'" && line[index + 1] === "'") {
      index += 1;
      continue;
    }

    if (quote === "\"" && isEscaped(line, index)) {
      continue;
    }

    let separatorIndex = index + 1;

    while (line[separatorIndex] === " " || line[separatorIndex] === "\t") {
      separatorIndex += 1;
    }

    return line[separatorIndex] === ":" ? separatorIndex : -1;
  }

  return -1;
}

function isEscaped(value: string, index: number): boolean {
  let escaping = false;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    escaping = !escaping;
  }

  return escaping;
}
