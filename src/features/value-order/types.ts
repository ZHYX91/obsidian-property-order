import type { PropertyContainerContext } from "../../obsidian/properties-dom";

export interface DropTarget {
  context: PropertyContainerContext;
  mode: "reorder" | "move";
  slot: number;
  kind: "drop" | "noop";
}
