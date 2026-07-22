export interface FrontmatterBounds {
  body: string;
  bodyStart: number;
  bodyEnd: number;
  newline: string;
}

export type FrontmatterScalarKind = "string" | "null" | "boolean" | "number";

/** Parsed scalar identity; raw YAML spelling remains on the containing token. */
export interface FrontmatterScalar {
  readonly kind: FrontmatterScalarKind;
  /** Canonical String(metadataCacheValue) representation. */
  readonly value: string;
}

export interface ListItemToken {
  raw: string;
  scalar: FrontmatterScalar;
}

export interface BlockItemToken {
  leadingLines: string[];
  lineIndent: string;
  dashSpace: string;
  originalLine: string;
  rawValue: string;
  scalar: FrontmatterScalar;
  inlineComment: string;
  continuationLines: string[];
}

export interface FlowPropertyMatch {
  kind: "flow";
  keyText: string;
  start: number;
  end: number;
  items: ListItemToken[];
  inlineComment: string;
}

export interface BlockPropertyMatch {
  kind: "block";
  keyText: string;
  start: number;
  end: number;
  hasTrailingNewline: boolean;
  preambleLines: string[];
  trailingLines: string[];
  items: BlockItemToken[];
  inlineComment: string;
}

export type PropertyMatch = FlowPropertyMatch | BlockPropertyMatch;
export type PropertyItem = ListItemToken | BlockItemToken;

export interface BlockRenderContext {
  keyText: string;
  hasTrailingNewline: boolean;
  preambleLines: string[];
  trailingLines: string[];
  items: BlockItemToken[];
  inlineComment: string;
}

export type FrontmatterDiagnosis =
  | "ok"
  | "no_frontmatter"
  | "property_not_found"
  | "unsupported_property";
