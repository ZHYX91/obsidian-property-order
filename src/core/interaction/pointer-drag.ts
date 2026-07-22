export const MOUSE_DRAG_START_THRESHOLD_PX = 5;
export const TOUCH_CANCEL_THRESHOLD_PX = 10;
export const TOUCH_LONG_PRESS_MS = 300;

export type SupportedPointerType = "mouse" | "touch" | "pen";

export type DragInteractionState =
  | { phase: "idle" }
  | {
      phase: "pressing";
      pointerId: number;
      pointerType: SupportedPointerType;
      startX: number;
      startY: number;
    }
  | { phase: "dragging"; pointerId: number }
  | { phase: "finishing"; pointerId: number };

export type DragInteractionEvent =
  | {
      type: "press";
      pointerId: number;
      pointerType: string;
      button: number;
      clientX: number;
      clientY: number;
    }
  | { type: "move"; pointerId: number; clientX: number; clientY: number }
  | { type: "long-press"; pointerId: number }
  | { type: "release"; pointerId: number }
  | { type: "cancel"; pointerId: number }
  | { type: "abort" }
  | { type: "finish-complete"; pointerId: number };

export type DragInteractionAction =
  | { type: "schedule-long-press"; pointerId: number }
  | { type: "clear-press" }
  | { type: "start-drag"; pointerId: number; clientX: number; clientY: number }
  | { type: "update-drag"; clientX: number; clientY: number }
  | { type: "finish-drag" }
  | { type: "cancel-drag" };

export interface DragInteractionTransition {
  state: DragInteractionState;
  actions: DragInteractionAction[];
}

export function createIdleDragInteractionState(): DragInteractionState {
  return { phase: "idle" };
}

export function transitionDragInteraction(
  state: DragInteractionState,
  event: DragInteractionEvent,
): DragInteractionTransition {
  if (event.type === "press") {
    if (state.phase !== "idle" || event.button !== 0 || !isSupportedPointerType(event.pointerType)) {
      return unchanged(state);
    }

    const nextState: DragInteractionState = {
      phase: "pressing",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
    };
    return {
      state: nextState,
      actions:
        event.pointerType === "mouse"
          ? []
          : [{ type: "schedule-long-press", pointerId: event.pointerId }],
    };
  }

  if (event.type === "move") {
    if (state.phase === "dragging" && event.pointerId === state.pointerId) {
      return {
        state,
        actions: [{ type: "update-drag", clientX: event.clientX, clientY: event.clientY }],
      };
    }

    if (state.phase !== "pressing" || event.pointerId !== state.pointerId) {
      return unchanged(state);
    }

    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);

    if (state.pointerType === "mouse" && distance >= MOUSE_DRAG_START_THRESHOLD_PX) {
      return {
        state: { phase: "dragging", pointerId: state.pointerId },
        actions: [
          {
            type: "start-drag",
            pointerId: state.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
          },
        ],
      };
    }

    if (state.pointerType !== "mouse" && distance >= TOUCH_CANCEL_THRESHOLD_PX) {
      return { state: createIdleDragInteractionState(), actions: [{ type: "clear-press" }] };
    }

    return unchanged(state);
  }

  if (event.type === "long-press") {
    if (
      state.phase !== "pressing" ||
      state.pointerType === "mouse" ||
      event.pointerId !== state.pointerId
    ) {
      return unchanged(state);
    }

    return {
      state: { phase: "dragging", pointerId: state.pointerId },
      actions: [
        {
          type: "start-drag",
          pointerId: state.pointerId,
          clientX: state.startX,
          clientY: state.startY,
        },
      ],
    };
  }

  if (event.type === "release") {
    if (state.phase === "pressing" && event.pointerId === state.pointerId) {
      return { state: createIdleDragInteractionState(), actions: [{ type: "clear-press" }] };
    }

    if (state.phase === "dragging" && event.pointerId === state.pointerId) {
      return {
        state: { phase: "finishing", pointerId: state.pointerId },
        actions: [{ type: "finish-drag" }],
      };
    }

    return unchanged(state);
  }

  if (event.type === "cancel") {
    if (state.phase === "pressing" && event.pointerId === state.pointerId) {
      return { state: createIdleDragInteractionState(), actions: [{ type: "clear-press" }] };
    }

    if (state.phase === "dragging" && event.pointerId === state.pointerId) {
      return { state: createIdleDragInteractionState(), actions: [{ type: "cancel-drag" }] };
    }

    return unchanged(state);
  }

  if (event.type === "abort") {
    if (state.phase === "pressing") {
      return { state: createIdleDragInteractionState(), actions: [{ type: "clear-press" }] };
    }

    if (state.phase === "dragging") {
      return { state: createIdleDragInteractionState(), actions: [{ type: "cancel-drag" }] };
    }

    return unchanged(state);
  }

  if (
    event.type === "finish-complete" &&
    state.phase === "finishing" &&
    event.pointerId === state.pointerId
  ) {
    return { state: createIdleDragInteractionState(), actions: [] };
  }

  return unchanged(state);
}

function isSupportedPointerType(pointerType: string): pointerType is SupportedPointerType {
  return pointerType === "mouse" || pointerType === "touch" || pointerType === "pen";
}

function unchanged(state: DragInteractionState): DragInteractionTransition {
  return { state, actions: [] };
}
