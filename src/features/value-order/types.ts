import type { PropertyContainerContext } from "../../obsidian/properties-dom";

export interface DropTarget {
  context: PropertyContainerContext;
  mode: "reorder" | "move";
  slot: number | "append";
  kind: "drop" | "noop";
}

export interface InvalidDropTarget {
  kind: "invalid";
  propertyElement: HTMLElement;
  propertyKey: string;
  reason: "non-list";
}

export type DropPointResolution =
  | { context: PropertyContainerContext; kind: "supported-list" }
  | { context: PropertyContainerContext; kind: "supported-list-mismatch" }
  | InvalidDropTarget
  | { kind: "unknown"; propertyElement: HTMLElement; propertyKey?: string }
  | { kind: "none" };
