import { describe, expect, it } from "vitest";

import {
  explainPropertyKeyRules,
  orderPropertyKeys,
} from "../../src/core/suggestions/order-keys";

describe("orderPropertyKeys", () => {
  it("pins, hides, sorts, and bottoms property keys", () => {
    const orderedKeys = orderPropertyKeys(["TQ_show_tree", "单位", "aliases", "主题", "tags"], {
      bottomKeys: ["tags"],
      hiddenPatterns: ["TQ_*"],
      pinnedKeys: ["主题", "aliases"],
      recentKeys: [],
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
      recentKeys: [],
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
      recentKeys: [],
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

  it("sorts recorded keys by most-recent order and unrecorded keys by name", () => {
    const orderedKeys = orderPropertyKeys(["beta", "alpha", "gamma", "delta"], {
      bottomKeys: [],
      hiddenPatterns: [],
      pinnedKeys: [],
      recentKeys: ["gamma", "beta"],
      sortMode: "recent",
      usage: [
        { key: "delta", count: 100 },
        { key: "alpha", count: 80 },
        { key: "gamma", count: 1 },
        { key: "beta", count: 0 },
      ],
    });

    expect(orderedKeys.map((item) => item.key)).toEqual([
      "gamma",
      "beta",
      "alpha",
      "delta",
    ]);
  });

  it("deduplicates keys without exposing unused source indexes", () => {
    const orderedKeys = orderPropertyKeys(["tags", "aliases", "tags"], {
      bottomKeys: [],
      hiddenPatterns: [],
      pinnedKeys: [],
      recentKeys: [],
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
        recentKeys: [],
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
        recentKeys: [],
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
      bottomKeys: ["TQ_*", "alpha"],
      hiddenPatterns: ["TQ_hide"],
      pinnedKeys: ["TQ_keep"],
      recentKeys: ["alpha", "zeta", "TQ_keep"],
      sortMode: "recent",
      usage: [{ key: "alpha", count: 100 }],
    });

    expect(orderedKeys.map((item) => item.key)).toEqual(["TQ_keep", "zeta", "alpha"]);
  });
});

describe("explainPropertyKeyRules", () => {
  it("reports every first match and the effective hidden-pinned-bottom priority", () => {
    expect(explainPropertyKeyRules(" TQ_status ", {
      bottomKeys: ["TQ_*"],
      hiddenPatterns: ["tq_status", "TQ_*"],
      pinnedKeys: ["status", "TQ_*"],
    })).toEqual({
      bottomPattern: "TQ_*",
      hiddenPattern: "tq_status",
      key: "TQ_status",
      pinnedPattern: "TQ_*",
      placement: "hidden",
    });

    expect(explainPropertyKeyRules("project", {
      bottomKeys: ["project"],
      hiddenPatterns: [],
      pinnedKeys: ["pro*"],
    }).placement).toBe("pinned");
    expect(explainPropertyKeyRules("date", {
      bottomKeys: ["date"],
      hiddenPatterns: [],
      pinnedKeys: [],
    }).placement).toBe("bottom");
  });

  it("reports an empty or unmatched name as normal without a rule match", () => {
    for (const key of ["", "owner"]) {
      expect(explainPropertyKeyRules(key, {
        bottomKeys: ["date"],
        hiddenPatterns: ["TQ_*"],
        pinnedKeys: ["project"],
      })).toMatchObject({
        bottomPattern: null,
        hiddenPattern: null,
        pinnedPattern: null,
        placement: "normal",
      });
    }
  });
});
