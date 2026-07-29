// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import {
  resolveDropPoint,
  resolveDropTarget,
  isSamePaneContainer,
} from "../../../src/features/value-order/drop-targeting";
import type {
  PropertyContainerContext,
  PropertyPillContext,
} from "../../../src/obsidian/properties-dom";

function rect(left: number, right: number, top = 0, bottom = 20): DOMRect {
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function elementWithRect(value: DOMRect): HTMLElement {
  return { getBoundingClientRect: () => value } as unknown as HTMLElement;
}

function createSourceContext(): PropertyPillContext {
  const pills = [
    elementWithRect(rect(0, 10)),
    elementWithRect(rect(20, 30)),
    elementWithRect(rect(40, 50)),
  ];
  return {
    container: elementWithRect(rect(0, 60)),
    editorKind: "multi-select",
    pill: pills[1],
    pills,
    propertyElement: {} as HTMLElement,
    propertyKey: "tags",
    sourceIndex: 1,
  };
}

describe("resolveDropTarget", () => {
  it("returns noop for either slot adjacent to the source item", () => {
    const source = createSourceContext();

    expect(resolveDropTarget(source, source, 15, 10)).toMatchObject({
      kind: "noop",
      mode: "reorder",
      slot: 1,
    });
    expect(resolveDropTarget(source, source, 35, 10)).toMatchObject({
      kind: "noop",
      mode: "reorder",
      slot: 2,
    });
  });

  it("creates a cross-property insertion target for an empty list", () => {
    const source = createSourceContext();
    const target: PropertyContainerContext = {
      container: elementWithRect(rect(0, 60)),
      editorKind: "multi-select",
      pills: [],
      propertyElement: {} as HTMLElement,
      propertyKey: "related",
    };

    expect(resolveDropTarget(source, target, 10, 10)).toMatchObject({
      kind: "drop",
      mode: "move",
      slot: 0,
    });
  });

  it("represents an opaque mismatch target as an explicit append", () => {
    const source = createSourceContext();
    const target: PropertyContainerContext = {
      container: elementWithRect(rect(0, 60)),
      editorKind: "list-type-mismatch",
      pills: [],
      propertyElement: {} as HTMLElement,
      propertyKey: "related",
    };

    expect(resolveDropTarget(source, target, 10, 10)).toMatchObject({
      kind: "drop",
      mode: "move",
      slot: "append",
    });
  });

  it("uses the pointed visual row instead of the last pill's x boundary", () => {
    const pills = [
      elementWithRect(rect(0, 100, 0, 20)),
      elementWithRect(rect(120, 220, 0, 20)),
      elementWithRect(rect(0, 100, 30, 50)),
    ];
    const source: PropertyPillContext = {
      container: elementWithRect(rect(0, 240, 0, 50)),
      editorKind: "multi-select",
      pill: pills[0],
      pills,
      propertyElement: {} as HTMLElement,
      propertyKey: "tags",
      sourceIndex: 0,
    };

    expect(resolveDropTarget(source, source, 230, 10)).toMatchObject({
      kind: "drop",
      slot: 2,
    });
  });

  it("inserts before the pointed lower row instead of the whole list", () => {
    const pills = [
      elementWithRect(rect(0, 100, 0, 20)),
      elementWithRect(rect(120, 220, 0, 20)),
      elementWithRect(rect(20, 120, 30, 50)),
    ];
    const source: PropertyPillContext = {
      container: elementWithRect(rect(0, 240, 0, 50)),
      editorKind: "multi-select",
      pill: pills[0],
      pills,
      propertyElement: {} as HTMLElement,
      propertyKey: "tags",
      sourceIndex: 0,
    };

    expect(resolveDropTarget(source, source, -10, 40)).toMatchObject({
      kind: "drop",
      slot: 2,
    });
  });

  it("uses the source geometry when it is the only pill on its visual row", () => {
    const pills = [
      elementWithRect(rect(0, 100, 0, 20)),
      elementWithRect(rect(20, 120, 30, 50)),
      elementWithRect(rect(0, 100, 60, 80)),
    ];
    const source: PropertyPillContext = {
      container: elementWithRect(rect(0, 140, 0, 80)),
      editorKind: "multi-select",
      pill: pills[1],
      pills,
      propertyElement: {} as HTMLElement,
      propertyKey: "tags",
      sourceIndex: 1,
    };

    expect(resolveDropTarget(source, source, 30, 40)).toMatchObject({
      kind: "noop",
      slot: 1,
    });
    expect(resolveDropTarget(source, source, 110, 40)).toMatchObject({
      kind: "noop",
      slot: 2,
    });
  });
});

describe("resolveDropPoint", () => {
  it("does not inspect or accept another container while cross-property drag is disabled", () => {
    const source = createSourceContext();
    expect(resolveDropPoint(source, 100, 100, false, null, null)).toEqual({ kind: "none" });
  });

  it("keeps same-property targeting available while cross-property drag is disabled", () => {
    const source = createSourceContext();
    expect(resolveDropPoint(source, 10, 10, false, null, null)).toEqual({
      context: source,
      kind: "supported-list",
    });
  });

  it("accepts cross-property containers only inside the source pane", () => {
    const candidate = {} as HTMLElement;
    const sourcePane = {
      contains: (element: Node) => element === candidate,
    } as unknown as HTMLElement;
    const otherPane = {
      contains: () => false,
    } as unknown as HTMLElement;

    expect(isSamePaneContainer(candidate, sourcePane)).toBe(true);
    expect(isSamePaneContainer(candidate, otherPane)).toBe(false);
    expect(isSamePaneContainer(candidate, null)).toBe(true);
  });
});

describe("resolveDropPoint classification", () => {
  it("requires native non-list evidence corroborated by scalar storage", () => {
    const source = createSourceContext();
    const propertyElement = document.createElement("div");
    propertyElement.className = "metadata-property";
    propertyElement.dataset.propertyKey = "status";
    const icon = document.createElement("div");
    icon.className = "metadata-property-icon";
    icon.dataset.icon = "text";
    propertyElement.appendChild(icon);
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    metadata.appendChild(propertyElement);
    const pane = document.createElement("div");
    pane.appendChild(metadata);
    document.body.appendChild(pane);
    source.container = {
      ...source.container,
      ownerDocument: {
        elementFromPoint: () => propertyElement,
        querySelectorAll: () => [],
      },
    } as unknown as HTMLElement;

    expect(
      resolveDropPoint(
        source,
        100,
        100,
        true,
        pane,
        new Map([
          ["status", "scalar"],
        ]),
      ),
    ).toEqual({
      kind: "invalid",
      propertyElement,
      propertyKey: "status",
      reason: "non-list",
    });
  });

  it("treats scalar storage without native type evidence as unknown", () => {
    const source = createSourceContext();
    const propertyElement = document.createElement("div");
    propertyElement.className = "metadata-property";
    propertyElement.dataset.propertyKey = "status";
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    metadata.appendChild(propertyElement);
    document.body.appendChild(metadata);
    source.container = {
      ...source.container,
      ownerDocument: {
        elementFromPoint: () => propertyElement,
        querySelectorAll: () => [],
      },
    } as unknown as HTMLElement;

    expect(
      resolveDropPoint(
        source,
        100,
        100,
        true,
        null,
        new Map([["status", "scalar"]]),
      ),
    ).toMatchObject({ kind: "unknown", propertyKey: "status" });
  });

  it("does not mislabel list properties or disabled cross-property drag", () => {
    const source = createSourceContext();
    const propertyElement = document.createElement("div");
    propertyElement.className = "metadata-property";
    propertyElement.dataset.propertyKey = "related";
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    metadata.appendChild(propertyElement);
    document.body.appendChild(metadata);
    source.container = {
      ...source.container,
      ownerDocument: {
        elementFromPoint: () => propertyElement,
        querySelectorAll: () => [],
      },
    } as unknown as HTMLElement;

    expect(
      resolveDropPoint(
        source,
        100,
        100,
        true,
        null,
        new Map([
          ["related", "array"],
        ]),
      ),
    ).toMatchObject({ kind: "unknown", propertyKey: "related" });
    expect(
      resolveDropPoint(
        source,
        100,
        100,
        false,
        null,
        new Map([
          ["related", "scalar"],
        ]),
      ),
    ).toEqual({ kind: "none" });
  });

  it("does not call a list-typed row non-list when its editor DOM is unknown", () => {
    const source = createSourceContext();
    const propertyElement = document.createElement("div");
    propertyElement.className = "metadata-property";
    propertyElement.dataset.propertyKey = "related";
    const icon = document.createElement("div");
    icon.className = "metadata-property-icon";
    icon.dataset.icon = "list";
    propertyElement.appendChild(icon);
    const metadata = document.createElement("div");
    metadata.className = "metadata-container";
    metadata.appendChild(propertyElement);
    document.body.appendChild(metadata);
    source.container = {
      ...source.container,
      ownerDocument: {
        elementFromPoint: () => propertyElement,
        querySelectorAll: () => [],
      },
    } as unknown as HTMLElement;

    expect(
      resolveDropPoint(
        source,
        100,
        100,
        true,
        null,
        new Map([["related", "scalar"]]),
      ),
    ).toMatchObject({
      kind: "unknown",
      propertyElement,
      propertyKey: "related",
    });
  });
});
