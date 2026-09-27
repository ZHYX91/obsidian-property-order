import { describe, expect, it } from "vitest";

import {
  createEmptyPropertyValueCustomOrder,
  getPropertyValueCustomOrder,
  moveCustomCandidate,
  removeCustomPreset,
  reorderCustomCandidate,
  setCustomMiddleSortMode,
  upsertPropertyValueCustomOrder,
} from "../../../src/core/suggestions/custom-value-order";

describe("custom value order operations", () => {
  it("moves one exact value between pinned, middle, and bottom sections", () => {
    const initial = {
      bottomValues: ["archived"],
      middleSortMode: "native" as const,
      middleValues: ["manual"],
      pinnedValues: ["draft"],
      propertyKey: "status",
    };

    const pinned = moveCustomCandidate(initial, "manual", "pinned");
    expect(pinned).toMatchObject({
      pinnedValues: ["draft", "manual"],
      middleValues: [],
      bottomValues: ["archived"],
    });

    const bottom = moveCustomCandidate(pinned, "manual", "bottom");
    expect(bottom).toMatchObject({
      pinnedValues: ["draft"],
      middleValues: [],
      bottomValues: ["archived", "manual"],
    });

    const middle = moveCustomCandidate(bottom, "manual", "middle");
    expect(middle).toMatchObject({
      pinnedValues: ["draft"],
      middleValues: ["manual"],
      bottomValues: ["archived"],
    });
  });

  it("removes only plugin preset configuration without touching another value", () => {
    const order = {
      bottomValues: ["archived"],
      middleSortMode: "native" as const,
      middleValues: ["manual"],
      pinnedValues: ["draft"],
      propertyKey: "status",
    };

    expect(removeCustomPreset(order, "manual")).toEqual({
      ...order,
      middleValues: [],
    });
  });

  it("reorders pinned and bottom values but not middle sort semantics", () => {
    const order = {
      bottomValues: ["x", "y"],
      middleSortMode: "name" as const,
      middleValues: ["m"],
      pinnedValues: ["a", "b", "c"],
      propertyKey: "status",
    };

    expect(reorderCustomCandidate(order, "pinned", "b", -1).pinnedValues).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(reorderCustomCandidate(order, "bottom", "x", 1).bottomValues).toEqual([
      "y",
      "x",
    ]);
    expect(setCustomMiddleSortMode(order, "frequency").middleSortMode).toBe("frequency");
  });

  it("keeps custom config when behavior membership changes elsewhere", () => {
    const empty = createEmptyPropertyValueCustomOrder(" status ");
    const configured = moveCustomCandidate(empty, "future", "pinned");
    const orders = upsertPropertyValueCustomOrder([], configured);

    expect(getPropertyValueCustomOrder(orders, "STATUS")).toEqual({
      bottomValues: [],
      middleSortMode: "native",
      middleValues: [],
      pinnedValues: ["future"],
      propertyKey: "status",
    });
  });

  it("preserves exact preset strings", () => {
    const nbsp = "\u00a0";
    const order = createEmptyPropertyValueCustomOrder("status");
    const configured = moveCustomCandidate(order, ` edge${nbsp}`, "bottom");

    expect(configured.bottomValues).toEqual([` edge${nbsp}`]);
  });
});
