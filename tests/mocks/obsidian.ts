export class Plugin {
  app: unknown;

  constructor() {
    this.app = undefined;
  }

  addSettingTab(_settingTab: unknown): void {}

  addCommand(_command: unknown): void {}

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
  readonly settingEl: HTMLDivElement;
  readonly controlEl: HTMLDivElement;
  readonly descEl: HTMLDivElement;

  constructor(containerEl: HTMLElement) {
    this.settingEl = containerEl.ownerDocument.createElement("div");
    this.settingEl.className = "setting-item";
    this.descEl = containerEl.ownerDocument.createElement("div");
    this.controlEl = containerEl.ownerDocument.createElement("div");
    this.controlEl.className = "setting-item-control";
    Reflect.set(this.controlEl, "createEl", function (
      this: HTMLElement,
      tag: string,
      options: { attr?: Record<string, string>; cls?: string; text?: string } = {},
    ) {
      const element = this.ownerDocument.createElement(tag);
      if (options.cls != null) element.className = options.cls;
      if (options.text != null) element.textContent = options.text;
      for (const [key, value] of Object.entries(options.attr ?? {})) element.setAttribute(key, value);
      this.appendChild(element);
      return element;
    });
    this.settingEl.append(this.descEl, this.controlEl);
    containerEl.appendChild(this.settingEl);
  }
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

export class Modal {
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  constructor(_app: unknown) {
    this.contentEl = document.createElement("div");
    this.titleEl = document.createElement("h2");
  }
  setTitle(title: string): void { this.titleEl.textContent = title; }
  open(): void { document.body.append(this.titleEl, this.contentEl); this.onOpen(); }
  close(): void { this.onClose(); this.contentEl.remove(); this.titleEl.remove(); }
  onOpen(): void {}
  onClose(): void {}
}
