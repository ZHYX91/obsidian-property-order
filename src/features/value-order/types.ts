import type { PropertyContainerContext } from "../../obsidian/properties-dom";

export interface DropTarget {
  context: PropertyContainerContext;
  mode: "reorder" | "move";
  slot: number;
  kind: "drop" | "noop";
}

export interface InvalidDropTarget {
  kind: "invalid";
  propertyElement: HTMLElement;
  propertyKey: string;
  reason: "non-list";
}
