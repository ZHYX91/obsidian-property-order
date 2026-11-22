// @vitest-environment happy-dom

import { afterEach, expect, it, vi } from "vitest";

import { installRafHarness } from "./animation-frame";

afterEach(() => { vi.restoreAllMocks(); });

it("cancels later work during a frame and runs newly scheduled work on the next frame", () => {
  const frame = installRafHarness();
  const cancelled = vi.fn();
  const nextFrame = vi.fn();
  const first = vi.fn(() => {
    window.cancelAnimationFrame(later);
    window.requestAnimationFrame(nextFrame);
  });
  window.requestAnimationFrame(first);
  const later = window.requestAnimationFrame(cancelled);
  const last = vi.fn();
  window.requestAnimationFrame(last);

  frame.flush();
  expect(first).toHaveBeenCalledOnce();
  expect(cancelled).not.toHaveBeenCalled();
  expect(last.mock.calls).toEqual(first.mock.calls);
  expect(nextFrame).not.toHaveBeenCalled();
  expect(frame.pending()).toBe(1);

  frame.flush();
  expect(nextFrame).toHaveBeenCalledOnce();
  expect(frame.pending()).toBe(0);
});
