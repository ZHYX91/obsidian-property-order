import { describe, expect, it } from "vitest";

// @ts-expect-error The release-notes selector is implemented in JavaScript.
import { selectReleaseNotesBaseline } from "../../scripts/release-notes-baseline.mjs";

function published(tagName: string, overrides: Record<string, unknown> = {}) {
  return {
    draft: false,
    prerelease: false,
    published_at: "2026-07-31T00:00:00Z",
    tag_name: tagName,
    ...overrides,
  };
}

describe("release notes baseline", () => {
  it("selects the highest older stable version from real published Releases", () => {
    expect(selectReleaseNotesBaseline([
      [
        published("0.3.1"),
        published("0.4.0"),
        published("v0.4.1"),
        published("0.4.1", { draft: true }),
        published("0.4.9", { published_at: null }),
      ],
      [
        published("0.3.9"),
        published("0.4.1", { prerelease: true }),
      ],
    ], "0.4.1")).toBe("0.4.0");
  });

  it("returns no baseline for the first real Release", () => {
    expect(selectReleaseNotesBaseline([
      published("0.0.9", { draft: true }),
      published("preview"),
    ], "0.1.0")).toBeNull();
  });

  it("fails closed when a published stable Release is not older", () => {
    expect(() => selectReleaseNotesBaseline([
      published("0.4.2"),
    ], "0.4.2")).toThrow(/must advance/u);
    expect(() => selectReleaseNotesBaseline([
      published("0.5.0"),
    ], "0.4.2")).toThrow(/must advance/u);
    expect(() => selectReleaseNotesBaseline([], "9007199254740992.0.0")).toThrow(
      /safe integers/u,
    );
  });
});
