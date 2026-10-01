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

  getControlValue(_key: string): unknown {
    return undefined;
  }

  getSettingDefinitions(): unknown[] {
    return [];
  }

  hide(): void {}

  refreshDomState(): void {}

  setControlValue(_key: string, _value: unknown): void {}

  update(): void {}
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

export class Scope {
  handler: ((event: KeyboardEvent) => boolean | void) | null = null;
  constructor(_parent?: Scope) {}
  register(_modifiers: unknown, _key: unknown, handler: (event: KeyboardEvent) => boolean | void) {
    this.handler = handler;
    return {};
  }
}

export function getLanguage(): string {
  return "en";
}

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

export function normalizePath(path: string): string {
  return path
    .replace(/\\\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//, "");
}
