import { describe, expect, it } from "vitest";

import { parseDoubleQuotedScalar } from "../../src/core/frontmatter/scalar";

describe("parseDoubleQuotedScalar", () => {
  it.each([
    [String.raw`"\0"`, "\0"],
    [String.raw`"\a"`, "\u0007"],
    [String.raw`"\b"`, "\b"],
    [String.raw`"\t"`, "\t"],
    [String.raw`"\n"`, "\n"],
    [String.raw`"\v"`, "\u000b"],
    [String.raw`"\f"`, "\f"],
    [String.raw`"\r"`, "\r"],
    [String.raw`"\e"`, "\u001b"],
    [String.raw`"\ "`, " "],
    [String.raw`"\""`, "\""],
    [String.raw`"\/"`, "/"],
    [String.raw`"\\"`, "\\"],
  ])("decodes the standard single-character escape in %s", (raw, expected) => {
    expect(parseDoubleQuotedScalar(raw)).toBe(expected);
  });
});

