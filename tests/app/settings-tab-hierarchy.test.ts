import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../src/app/settings-tab.ts", import.meta.url), "utf8");

describe("settings page hierarchy", () => {
  it("does not repeat the active tab as the first content heading", () => {
    expect(source).not.toContain('setName(this.t("settings.general.heading"))');
    expect(source).not.toContain('setName(this.t("settings.valueDrag.heading"))');
    expect(source).not.toContain('setName(this.t("settings.keyOrder.heading"))');
  });
});
