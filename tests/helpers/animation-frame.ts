import { vi } from "vitest";

export function installRafHarness(targetWindow: Window = window) {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  vi.spyOn(targetWindow, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(targetWindow, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    flush() {
      const timestamp = targetWindow.performance.now();
      // Snapshot the handles: requests made during this paint wait until the next.
      for (const id of Array.from(callbacks.keys())) {
        const callback = callbacks.get(id);
        if (callback === undefined) continue;
        callbacks.delete(id);
        callback(timestamp);
      }
    },
    pending: () => callbacks.size,
  };
}
