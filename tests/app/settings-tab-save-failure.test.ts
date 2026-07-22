// @vitest-environment happy-dom

import { Notice } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PropertyOrderSettingTab } from "../../src/app/settings-tab";
import { createDefaultSettings } from "../../src/shared/settings";

interface TestableSettingTab {
  persistSettings(refreshKeySuggestions?: boolean): Promise<boolean>;
}

const MockNotice = Notice as typeof Notice & { messages: string[] };

describe("PropertyOrderSettingTab save failures", () => {
  beforeEach(() => {
    MockNotice.messages.length = 0;
  });

  it("shows an unsaved state and retries the complete settings snapshot", async () => {
    const saveSettings = vi
      .fn<(refreshKeySuggestions?: boolean) => Promise<void>>()
      .mockRejectedValueOnce(new Error("disk unavailable"))
      .mockResolvedValueOnce();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const plugin = {
      propertyOrderSettings: createDefaultSettings(),
      saveSettings,
    };
    const settingTab = new PropertyOrderSettingTab(
      {} as never,
      plugin as never,
    ) as unknown as TestableSettingTab & { containerEl: HTMLElement };

    await expect(settingTab.persistSettings(true)).resolves.toBe(false);
    expect(MockNotice.messages).toEqual([
      "Property Order: failed to save settings. Try again.",
    ]);
    const statusEl = settingTab.containerEl.querySelector<HTMLElement>(
      ".property-order-settings-save-status",
    );
    expect(statusEl?.hidden).toBe(false);
    expect(statusEl?.getAttribute("role")).toBe("alert");
    expect(statusEl?.textContent).toContain("Settings could not be saved");

    statusEl?.querySelector<HTMLButtonElement>("button")?.click();
    await vi.waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(statusEl?.hidden).toBe(true));
    expect(saveSettings).toHaveBeenNthCalledWith(1, true);
    expect(saveSettings).toHaveBeenNthCalledWith(2, true);
  });
});
