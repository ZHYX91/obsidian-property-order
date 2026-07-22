import { describe, expect, it } from "vitest";

import {
  createIdleDragInteractionState,
  transitionDragInteraction,
  type DragInteractionEvent,
  type DragInteractionState,
} from "../../src/core/interaction/pointer-drag";

function transition(state: DragInteractionState, event: DragInteractionEvent) {
  return transitionDragInteraction(state, event);
}

describe("transitionDragInteraction", () => {
  it("starts mouse drag only after reaching the movement threshold", () => {
    const pressed = transition(createIdleDragInteractionState(), {
      type: "press",
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    const belowThreshold = transition(pressed.state, {
      type: "move",
      pointerId: 1,
      clientX: 13,
      clientY: 13,
    });
    const started = transition(belowThreshold.state, {
      type: "move",
      pointerId: 1,
      clientX: 16,
      clientY: 10,
    });

    expect(belowThreshold.state.phase).toBe("pressing");
    expect(belowThreshold.actions).toEqual([]);
    expect(started.state).toEqual({ phase: "dragging", pointerId: 1 });
    expect(started.actions).toEqual([
      { type: "start-drag", pointerId: 1, clientX: 16, clientY: 10 },
    ]);
  });

  it.each(["touch", "pen"] as const)("starts %s drag on long press", (pointerType) => {
    const pressed = transition(createIdleDragInteractionState(), {
      type: "press",
      pointerId: 2,
      pointerType,
      button: 0,
      clientX: 20,
      clientY: 30,
    });
    const started = transition(pressed.state, { type: "long-press", pointerId: 2 });

    expect(pressed.actions).toEqual([{ type: "schedule-long-press", pointerId: 2 }]);
    expect(started.state).toEqual({ phase: "dragging", pointerId: 2 });
    expect(started.actions).toEqual([
      { type: "start-drag", pointerId: 2, clientX: 20, clientY: 30 },
    ]);
  });

  it.each(["touch", "pen"] as const)("cancels %s press after moving before long press", (pointerType) => {
    const pressed = transition(createIdleDragInteractionState(), {
      type: "press",
      pointerId: 3,
      pointerType,
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    const cancelled = transition(pressed.state, {
      type: "move",
      pointerId: 3,
      clientX: 10,
      clientY: 0,
    });

    expect(cancelled.state.phase).toBe("idle");
    expect(cancelled.actions).toEqual([{ type: "clear-press" }]);
  });

  it("ignores unsupported pointer types, secondary buttons, and other pointer ids", () => {
    const idle = createIdleDragInteractionState();
    expect(
      transition(idle, {
        type: "press",
        pointerId: 1,
        pointerType: "trackpad",
        button: 0,
        clientX: 0,
        clientY: 0,
      }).state,
    ).toBe(idle);
    expect(
      transition(idle, {
        type: "press",
        pointerId: 1,
        pointerType: "mouse",
        button: 1,
        clientX: 0,
        clientY: 0,
      }).state,
    ).toBe(idle);

    const dragging: DragInteractionState = { phase: "dragging", pointerId: 4 };
    expect(
      transition(dragging, { type: "move", pointerId: 5, clientX: 1, clientY: 1 }),
    ).toEqual({ state: dragging, actions: [] });
  });

  it("finishes only the active pointer and waits for completion", () => {
    const dragging: DragInteractionState = { phase: "dragging", pointerId: 7 };
    const ignored = transition(dragging, { type: "release", pointerId: 8 });
    const finishing = transition(dragging, { type: "release", pointerId: 7 });
    const completed = transition(finishing.state, { type: "finish-complete", pointerId: 7 });

    expect(ignored).toEqual({ state: dragging, actions: [] });
    expect(finishing).toEqual({
      state: { phase: "finishing", pointerId: 7 },
      actions: [{ type: "finish-drag" }],
    });
    expect(completed.state.phase).toBe("idle");
  });

  it.each(["cancel", "abort"] as const)("cleans up an active drag on %s", (type) => {
    const dragging: DragInteractionState = { phase: "dragging", pointerId: 9 };
    const result =
      type === "cancel"
        ? transition(dragging, { type, pointerId: 9 })
        : transition(dragging, { type });

    expect(result.state.phase).toBe("idle");
    expect(result.actions).toEqual([{ type: "cancel-drag" }]);
  });

  it("clears a press on release, pointercancel, Escape-equivalent abort, or blur-equivalent abort", () => {
    const pressing: DragInteractionState = {
      phase: "pressing",
      pointerId: 10,
      pointerType: "touch",
      startX: 0,
      startY: 0,
    };

    expect(transition(pressing, { type: "release", pointerId: 10 }).actions).toEqual([
      { type: "clear-press" },
    ]);
    expect(transition(pressing, { type: "cancel", pointerId: 10 }).actions).toEqual([
      { type: "clear-press" },
    ]);
    expect(transition(pressing, { type: "abort" }).actions).toEqual([
      { type: "clear-press" },
    ]);
  });
});
