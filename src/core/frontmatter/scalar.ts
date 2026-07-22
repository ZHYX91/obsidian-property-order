import type { FrontmatterScalar } from "./types";

const AMBIGUOUS_PLAIN_VALUES = new Set([
  "",
  "~",
  "null",
  "true",
  "false",
  "yes",
  "no",
  "on",
  "off",
  "y",
  "n",
]);

const DOUBLE_QUOTED_ESCAPES: Record<string, string> = {
  "0": "\0",
  a: "\u0007",
  b: "\b",
  t: "\t",
  n: "\n",
  v: "\u000b",
  f: "\f",
  r: "\r",
  e: "\u001b",
  " ": " ",
  "\"": "\"",
  "/": "/",
  "\\": "\\",
  N: "\u0085",
  _: "\u00a0",
  L: "\u2028",
  P: "\u2029",
};

const YAML_CORE_NULL_PATTERN = /^(?:~|[Nn]ull|NULL)?$/;
const YAML_CORE_BOOLEAN_PATTERN = /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/;
const YAML_CORE_OCTAL_PATTERN = /^0o[0-7]+$/;
const YAML_CORE_DECIMAL_INTEGER_PATTERN = /^[-+]?[0-9]+$/;
const YAML_CORE_HEXADECIMAL_PATTERN = /^0x[0-9a-fA-F]+$/;
const YAML_CORE_SPECIAL_FLOAT_PATTERN = /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/;
const YAML_CORE_EXPONENTIAL_PATTERN =
  /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/;
const YAML_CORE_DECIMAL_FLOAT_PATTERN = /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/;

export function parseScalarValue(raw: string): string {
  return parseScalar(raw).value;
}

export function parseScalar(raw: string): FrontmatterScalar {
  const trimmed = raw.trim();

  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return {
      kind: "string",
      value: trimmed.slice(1, -1).replace(/''/g, "'"),
    };
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"") && trimmed.length >= 2) {
    return {
      kind: "string",
      value: parseDoubleQuotedScalar(trimmed) ?? trimmed.slice(1, -1),
    };
  }

  return parsePlainScalar(trimmed);
}

export function serializeNormalizedScalar(scalar: FrontmatterScalar): string {
  if (scalar.kind === "null") {
    return "null";
  }

  if (scalar.kind === "boolean") {
    return scalar.value;
  }

  if (scalar.kind === "number") {
    return scalar.value === "Infinity"
      ? ".inf"
      : scalar.value === "-Infinity"
        ? "-.inf"
        : scalar.value === "NaN"
          ? ".nan"
          : scalar.value;
  }

  return isSafePlainScalar(scalar.value)
    ? scalar.value
    : JSON.stringify(scalar.value)
        .replace(/\u0085/g, "\\u0085")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

export function isValidQuotedScalar(raw: string): boolean {
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) {
      return false;
    }

    for (let index = 1; index < raw.length - 1; index += 1) {
      if (raw[index] !== "'") {
        continue;
      }

      if (raw[index + 1] !== "'" || index + 1 >= raw.length - 1) {
        return false;
      }

      index += 1;
    }

    return true;
  }

  return parseDoubleQuotedScalar(raw) != null;
}

export function parseDoubleQuotedScalar(raw: string): string | null {
  if (!raw.startsWith("\"") || raw.length < 2 || !raw.endsWith("\"")) {
    return null;
  }

  let result = "";

  for (let index = 1; index < raw.length - 1; index += 1) {
    const character = raw[index];

    if (character === "\"") {
      return null;
    }

    if (character !== "\\") {
      if (character.charCodeAt(0) < 0x20 && character !== "\t") {
        return null;
      }

      result += character;
      continue;
    }

    const escape = raw[index + 1];

    if (escape == null || index + 1 >= raw.length - 1) {
      return null;
    }

    const escapedCharacter = DOUBLE_QUOTED_ESCAPES[escape];

    if (escapedCharacter != null) {
      result += escapedCharacter;
      index += 1;
      continue;
    }

    const width = escape === "x" ? 2 : escape === "u" ? 4 : escape === "U" ? 8 : 0;

    if (width === 0) {
      return null;
    }

    const digits = raw.slice(index + 2, index + 2 + width);

    if (digits.length !== width || !/^[0-9a-fA-F]+$/.test(digits)) {
      return null;
    }

    const codePoint = Number.parseInt(digits, 16);

    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return null;
    }

    result += String.fromCodePoint(codePoint);
    index += width + 1;
  }

  return result;
}

export function renderInlineComment(inlineComment: string): string {
  if (inlineComment.length === 0 || /^\s/.test(inlineComment)) {
    return inlineComment;
  }

  return ` ${inlineComment}`;
}

export function splitInlineComment(raw: string, context: "flow" | "scalar" = "scalar"): {
  rawValue: string;
  inlineComment: string;
} {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];

    if (character === "'" && !inDoubleQuote) {
      const next = raw[index + 1] ?? "";

      if (inSingleQuote && next === "'") {
        index += 1;
        continue;
      }

      if (inSingleQuote || canStartQuotedScalar(raw, index, context)) {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (character === "\"" && !inSingleQuote) {
      let escaping = false;
      let cursor = index - 1;

      while (cursor >= 0 && raw[cursor] === "\\") {
        escaping = !escaping;
        cursor -= 1;
      }

      if (!escaping && (inDoubleQuote || canStartQuotedScalar(raw, index, context))) {
        inDoubleQuote = !inDoubleQuote;
      }

      continue;
    }

    if (
      character !== "#" ||
      inSingleQuote ||
      inDoubleQuote ||
      (index > 0 && raw[index - 1] !== " " && raw[index - 1] !== "\t")
    ) {
      continue;
    }

    let commentStart = index;

    while (commentStart > 0 && (raw[commentStart - 1] === " " || raw[commentStart - 1] === "\t")) {
      commentStart -= 1;
    }

    return {
      rawValue: raw.slice(0, commentStart).trimEnd(),
      inlineComment: raw.slice(commentStart),
    };
  }

  return { rawValue: raw, inlineComment: "" };
}

function canStartQuotedScalar(raw: string, index: number, context: "flow" | "scalar"): boolean {
  const prefix = raw.slice(0, index).trimEnd();
  return prefix.length === 0 || (context === "flow" && /[[,{]$/.test(prefix));
}

function isSafePlainScalar(value: string): boolean {
  if (!/^[A-Za-z0-9._/-]+$/.test(value)) {
    return false;
  }

  if (AMBIGUOUS_PLAIN_VALUES.has(value.toLowerCase())) {
    return false;
  }

  // A leading sign, digit, dot, or tilde can opt a plain scalar into YAML's
  // null, numeric, timestamp, infinity, or NaN resolution rules. Quoting all
  // such values is intentionally conservative: normalized writeback must not
  // turn an Obsidian text value into another YAML type.
  if (/^[+\d.~-]/.test(value)) {
    return false;
  }

  return true;
}

function parsePlainScalar(value: string): FrontmatterScalar {
  // Obsidian's parseYaml uses the YAML core schema. Mirror its untagged
  // scalar resolution, including its type. Preserve-mode rendering continues
  // to use the untouched raw token.
  if (YAML_CORE_NULL_PATTERN.test(value)) {
    return { kind: "null", value: "null" };
  }

  if (YAML_CORE_BOOLEAN_PATTERN.test(value)) {
    return {
      kind: "boolean",
      value: value[0]?.toLowerCase() === "t" ? "true" : "false",
    };
  }

  if (YAML_CORE_OCTAL_PATTERN.test(value)) {
    return { kind: "number", value: String(Number.parseInt(value.slice(2), 8)) };
  }

  if (YAML_CORE_DECIMAL_INTEGER_PATTERN.test(value)) {
    return { kind: "number", value: String(Number.parseInt(value, 10)) };
  }

  if (YAML_CORE_HEXADECIMAL_PATTERN.test(value)) {
    return { kind: "number", value: String(Number.parseInt(value.slice(2), 16)) };
  }

  if (YAML_CORE_SPECIAL_FLOAT_PATTERN.test(value)) {
    if (value.slice(-3).toLowerCase() === "nan") {
      return { kind: "number", value: "NaN" };
    }

    return {
      kind: "number",
      value: value.startsWith("-") ? "-Infinity" : "Infinity",
    };
  }

  if (
    YAML_CORE_EXPONENTIAL_PATTERN.test(value) ||
    YAML_CORE_DECIMAL_FLOAT_PATTERN.test(value)
  ) {
    return { kind: "number", value: String(Number.parseFloat(value)) };
  }

  return { kind: "string", value };
}
