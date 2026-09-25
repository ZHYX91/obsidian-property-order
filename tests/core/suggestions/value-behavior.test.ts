import { describe, expect, it } from "vitest";

import {
  getPropertyValueBehavior,
  groupPropertyValueBehaviors,
  mergePropertyValueKeyCandidates,
  movePropertyValueBehavior,
  removePropertyValueBehavior,
} from "../../../src/core/suggestions/value-behavior";

describe("value behavior groups", () => {
  it("moves one exact key between mutually exclusive behaviors", () => {
    const initial = [
      { behavior: "name" as const, propertyKey: "Status" },
      { behavior: "native" as const, propertyKey: "priority" },
    ];

    const moved = movePropertyValueBehavior(initial, "status", "none");

    expect(moved).toMatchObject({
      changed: true,
      fromBehavior: "name",
      propertyKey: "status",
      toBehavior: "none",
    });
    expect(moved.nextAssignments).toEqual([
      { behavior: "native", propertyKey: "priority" },
      { behavior: "none", propertyKey: "status" },
    ]);
    expect(getPropertyValueBehavior(moved.nextAssignments, " STATUS ")).toBe("none");
  });

  it("removes a key assignment so it follows the default again", () => {
    expect(
      removePropertyValueBehavior(
        [
          { behavior: "frequency", propertyKey: "status" },
          { behavior: "none", propertyKey: "id" },
        ],
        "STATUS",
      ),
    ).toEqual([{ behavior: "none", propertyKey: "id" }]);
  });

  it("sorts chips by name or by most recently joined target class", () => {
    const assignments = [
      { behavior: "name" as const, propertyKey: "gamma" },
      { behavior: "name" as const, propertyKey: "alpha" },
      { behavior: "name" as const, propertyKey: "beta" },
      { behavior: "none" as const, propertyKey: "id" },
    ];

    expect(
      groupPropertyValueBehaviors(assignments, "name")
        .find((group) => group.behavior === "name")?.propertyKeys,
    ).toEqual(["alpha", "beta", "gamma"]);
    expect(
      groupPropertyValueBehaviors(assignments, "recent")
        .find((group) => group.behavior === "name")?.propertyKeys,
    ).toEqual(["beta", "alpha", "gamma"]);
  });

  it("merges Vault and configured key candidates without hiding keys in other classes", () => {
    expect(
      mergePropertyValueKeyCandidates(
        ["status", "priority", "项目"],
        [
          { behavior: "none", propertyKey: "STATUS" },
          { behavior: "custom", propertyKey: "future_key" },
        ],
        ["priority", "manual_only"],
      ),
    ).toEqual(["future_key", "manual_only", "priority", "status", "项目"]);
  });
});
