interface ObsidianElementOptions {
  readonly attr?: Readonly<Record<string, string>>;
  readonly cls?: string | readonly string[];
  readonly text?: string;
}

export function installObsidianDomFactories(targetDocument: Document): void {
  const divPrototype = Object.getPrototypeOf(targetDocument.createElement("div")) as object;
  const nodePrototype = Object.getPrototypeOf(divPrototype) as object;

  Object.defineProperties(nodePrototype, {
    createDiv: {
      configurable: true,
      writable: true,
      value(this: Node, options?: ObsidianElementOptions | string): HTMLDivElement {
        return createChild(this, "div", options);
      },
    },
    createEl: {
      configurable: true,
      writable: true,
      value<K extends keyof HTMLElementTagNameMap>(
        this: Node,
        tag: K,
        options?: ObsidianElementOptions | string,
      ): HTMLElementTagNameMap[K] {
        return createChild(this, tag, options);
      },
    },
    createSpan: {
      configurable: true,
      writable: true,
      value(this: Node, options?: ObsidianElementOptions | string): HTMLSpanElement {
        return createChild(this, "span", options);
      },
    },
  });
}

function createChild<K extends keyof HTMLElementTagNameMap>(
  parent: Node,
  tag: K,
  options?: ObsidianElementOptions | string,
): HTMLElementTagNameMap[K] {
  const ownerDocument = parent.ownerDocument;
  if (ownerDocument == null) {
    throw new Error("Obsidian DOM helper requires an owner document.");
  }
  const element = ownerDocument.createElement(tag);
  if (typeof options === "string") {
    element.textContent = options;
  } else if (options != null) {
    if (options.text != null) element.textContent = options.text;
    if (typeof options.cls === "string") element.className = options.cls;
    else if (options.cls != null) element.classList.add(...options.cls);
    for (const [name, value] of Object.entries(options.attr ?? {})) {
      element.setAttribute(name, value);
    }
  }
  parent.appendChild(element);
  return element;
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  installObsidianDomFactories(document);
}
