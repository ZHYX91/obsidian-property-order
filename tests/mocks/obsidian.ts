export class Plugin {
  app: unknown;

  constructor() {
    this.app = undefined;
  }

  addSettingTab(_settingTab: unknown): void {}

  loadData(): Promise<unknown> {
    return Promise.resolve(null);
  }

  registerDomEvent(): void {}

  registerEvent<T>(eventRef: T): T {
    return eventRef;
  }

  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
}

export class PluginSettingTab {
  app: unknown;
  containerEl: HTMLElement;

  constructor(app: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
  }

  display(): void {}

  hide(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
}

export class AbstractInputSuggest<T> {
  constructor(_app: unknown, _inputEl: HTMLInputElement) {}

  close(): void {}

  onSelect(_callback: (value: T) => void): void {}
}

export class MarkdownView {}

export const moment = {
  locale: (): string => "en",
};

export const Platform = {
  isIosApp: false,
  isMacOS: false,
  isMobileApp: false,
};

export class Notice {
  static readonly messages: string[] = [];

  constructor(message: string) {
    Notice.messages.push(message);
  }
}
