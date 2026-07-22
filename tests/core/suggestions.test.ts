import { describe, expect, it } from "vitest";

import { orderPropertyKeys } from "../../src/core/suggestions/order-keys";

describe("orderPropertyKeys", () => {
  it("pins, hides, sorts, and bottoms property keys", () => {
    const orderedKeys = orderPropertyKeys(["TQ_show_tree", "单位", "aliases", "主题", "tags"], {
      bottomKeys: ["tags"],
      hiddenPatterns: ["TQ_*"],
      pinnedKeys: ["主题", "aliases"],
      sortMode: "name",
      usage: [],
    });

    expect(orderedKeys.map((item) => item.key)).toEqual(["主题", "aliases", "单位", "tags"]);
  });

  it("sorts unmatched keys by usage count with name-order tie-breaking", () => {
    const orderedKeys = orderPropertyKeys(["beta", "alpha", "gamma"], {
      bottomKeys: [],
      hiddenPatterns: [],
      pinnedKeys: [],
      sortMode: "usage",
      usage: [
        { key: "alpha", count: 3 },
        { key: "beta", count: 8 },
        { key: "gamma", count: 3 },
      ],
    });

    expect(orderedKeys.map((item) => item.key)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("uses mixed-language name order to break usage-count ties", () => {
    const orderedKeys = orderPropertyKeys(["张三", "beta", "李四", "Alpha"], {
      bottomKeys: [],
      hiddenPatterns: [],
      pinnedKeys: [],
      sortMode: "usage",
      usage: [
        { key: "张三", count: 2 },
        { key: "beta", count: 2 },
        { key: "李四", count: 2 },
        { key: "Alpha", count: 2 },
      ],
    });

    expect(orderedKeys.map((item) => item.key)).toEqual(["Alpha", "beta", "李四", "张三"]);
  });

  it("deduplicates keys without exposing unused source indexes", () => {
    const orderedKeys = orderPropertyKeys(["tags", "aliases", "tags"], {
      bottomKeys: [],
      hiddenPatterns: [],
      pinnedKeys: [],
      sortMode: "name",
      usage: [],
    });

    expect(orderedKeys).toEqual([
      { key: "aliases" },
      { key: "tags" },
    ]);
  });

  it("matches exact and wildcard rules case-insensitively", () => {
    const orderedKeys = orderPropertyKeys(
      ["Pinned", "BOTTOM", "hideMe", "HiddenWildcard", "middle"],
      {
        bottomKeys: ["bot*"],
        hiddenPatterns: ["HIDEME", "hidden*"],
        pinnedKeys: ["pinned"],
        sortMode: "name",
        usage: [],
      },
    );

    expect(orderedKeys.map((item) => item.key)).toEqual(["Pinned", "middle", "BOTTOM"]);
  });

  it("expands wildcard pinned and bottom rules in candidate order", () => {
    const orderedKeys = orderPropertyKeys(
      ["misc", "TQ_beta", "alpha", "TQ_alpha", "done_date", "created_date"],
      {
        bottomKeys: ["*_date"],
        hiddenPatterns: [],
        pinnedKeys: ["TQ_*"],
        sortMode: "name",
        usage: [],
      },
    );

    expect(orderedKeys.map((item) => item.key)).toEqual([
      "TQ_beta",
      "TQ_alpha",
      "alpha",
      "misc",
      "done_date",
      "created_date",
    ]);
  });

  it("gives pinned rules priority over bottom rules after hidden filtering", () => {
    const orderedKeys = orderPropertyKeys(["TQ_keep", "TQ_hide", "alpha", "zeta"], {
      bottomKeys: ["TQ_*"],
      hiddenPatterns: ["TQ_hide"],
      pinnedKeys: ["TQ_keep"],
      sortMode: "name",
      usage: [],
    });

    expect(orderedKeys.map((item) => item.key)).toEqual(["TQ_keep", "alpha", "zeta"]);
  });
});
