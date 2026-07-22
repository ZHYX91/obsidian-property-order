// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createDebouncedCommit } from "../../src/app/settings-tab";

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebouncedCommit", () => {
  it("coalesces repeated schedules and commits the latest state once", () => {
    vi.useFakeTimers();
    let currentValue = "first";
    const committedValues: string[] = [];
    const pendingCommit = createDebouncedCommit(
      () => committedValues.push(currentValue),
      () => window,
    );

    pendingCommit.schedule();
    currentValue = "latest";
    pendingCommit.schedule();
    vi.advanceTimersByTime(199);
    expect(committedValues).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(committedValues).toEqual(["latest"]);
  });

  it("flushes immediately when a tab rerenders or closes", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const pendingCommit = createDebouncedCommit(commit, () => window);

    pendingCommit.schedule();
    pendingCommit.flush();
    vi.runAllTimers();

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("cancels stale textarea work before a suggestion commits its combined value", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const pendingCommit = createDebouncedCommit(commit, () => window);

    pendingCommit.schedule();
    pendingCommit.cancel();
    vi.runAllTimers();

    expect(commit).not.toHaveBeenCalled();
  });
});
