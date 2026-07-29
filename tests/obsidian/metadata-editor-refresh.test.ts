// @vitest-environment happy-dom

import { parseYaml, type Editor, type MarkdownView, type TFile } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  parseYaml: vi.fn(),
}));

import { reconcileMetadataEditorProperties } from "../../src/obsidian/metadata-editor-refresh";

describe("native Metadata editor refresh", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.mocked(parseYaml).mockReset();
  });

  it("blurs the affected row and reconciles it from a fresh frontmatter parse", () => {
    const fixture = createFixture();
    const input = document.createElement("div");
    input.className = "multi-select-input";
    input.contentEditable = "true";
    input.tabIndex = 0;
    fixture.container.appendChild(input);
    input.focus();
    const freshProperties = { flow: ["beta", "alpha"] };
    vi.mocked(parseYaml).mockReturnValue(freshProperties);

    expect(fixture.reconcile()).toBe("reconciled");
    expect(parseYaml).toHaveBeenCalledWith("flow: [beta, alpha]\n");
    expect(fixture.synchronize).toHaveBeenCalledWith(freshProperties);
    expect(document.activeElement).not.toBe(input);
    expect(fixture.visibleValues()).toEqual(["beta", "alpha"]);
    expect(fixture.getContent()).toBe(fixture.expectedContent);
  });

  it("does nothing when the native Properties row is already aligned", () => {
    const fixture = createFixture(["beta", "alpha"]);

    expect(fixture.reconcile()).toBe("already-aligned");
    expect(parseYaml).not.toHaveBeenCalled();
    expect(fixture.synchronize).not.toHaveBeenCalled();
  });

  it("fails closed when the owning editor or file identity is stale", () => {
    const fixture = createFixture();
    vi.mocked(parseYaml).mockReturnValue({ flow: ["beta", "alpha"] });
    fixture.setContent("---\nflow: [external]\n---\n");

    expect(fixture.reconcile()).toBe("stale");
    expect(fixture.synchronize).not.toHaveBeenCalled();
  });

  it("fails closed when the host does not expose the guarded synchronization capability", () => {
    const fixture = createFixture();
    vi.mocked(parseYaml).mockReturnValue({ flow: ["beta", "alpha"] });
    delete (fixture.view as MarkdownView & { metadataEditor?: unknown }).metadataEditor;

    expect(fixture.reconcile()).toBe("unsupported");
    expect(fixture.visibleValues()).toEqual(["alpha", "beta"]);
  });

  it("fails closed when the private editor belongs to another view", () => {
    const fixture = createFixture();
    vi.mocked(parseYaml).mockReturnValue({ flow: ["beta", "alpha"] });
    const metadataEditor = (
      fixture.view as MarkdownView & {
        metadataEditor: { owner: { getFile: () => TFile | null } };
      }
    ).metadataEditor;
    metadataEditor.owner = { getFile: () => fixture.view.file };

    expect(fixture.reconcile()).toBe("unsupported");
    expect(fixture.synchronize).not.toHaveBeenCalled();
  });

  it("fails closed when the private editor container is outside the pane", () => {
    const fixture = createFixture();
    vi.mocked(parseYaml).mockReturnValue({ flow: ["beta", "alpha"] });
    const metadataEditor = (
      fixture.view as MarkdownView & {
        metadataEditor: { containerEl: HTMLElement };
      }
    ).metadataEditor;
    document.body.appendChild(metadataEditor.containerEl);

    expect(fixture.reconcile()).toBe("unsupported");
    expect(fixture.synchronize).not.toHaveBeenCalled();
  });

  it("contains failures while inspecting the private host capability", () => {
    const fixture = createFixture();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const metadataEditor = (
      fixture.view as MarkdownView & {
        metadataEditor: { owner: { getFile: () => TFile | null } };
      }
    ).metadataEditor;
    metadataEditor.owner.getFile = () => {
      throw new Error("owner unavailable");
    };

    expect(fixture.reconcile()).toBe("failed");
    expect(fixture.synchronize).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it("reports failure when synchronization leaves the affected row stale", () => {
    const fixture = createFixture();
    vi.mocked(parseYaml).mockReturnValue({ flow: ["beta", "alpha"] });
    fixture.synchronize.mockImplementation(() => undefined);

    expect(fixture.reconcile()).toBe("failed");
    expect(fixture.getContent()).toBe(fixture.expectedContent);
    expect(fixture.visibleValues()).toEqual(["alpha", "beta"]);
  });

  it("detects editor divergence caused by an unsafe host synchronization", () => {
    const fixture = createFixture();
    vi.mocked(parseYaml).mockReturnValue({ flow: ["beta", "alpha"] });
    fixture.synchronize.mockImplementation(() => {
      fixture.setContent("---\nflow: [external]\n---\n");
    });

    expect(fixture.reconcile()).toBe("stale");
  });

  it("contains parse failures without invoking the host", () => {
    const fixture = createFixture();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(parseYaml).mockImplementation(() => {
      throw new Error("invalid YAML");
    });

    expect(fixture.reconcile()).toBe("failed");
    expect(fixture.synchronize).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});

interface RefreshFixture {
  container: HTMLElement;
  expectedContent: string;
  getContent(): string;
  reconcile(): ReturnType<typeof reconcileMetadataEditorProperties>;
  setContent(content: string): void;
  synchronize: ReturnType<typeof vi.fn>;
  view: MarkdownView;
  visibleValues(): string[];
}

function createFixture(initialValues: readonly string[] = ["alpha", "beta"]): RefreshFixture {
  const expectedContent = "---\nflow: [beta, alpha]\n---\n";
  let content = expectedContent;
  const file = { path: "Source.md" } as TFile;
  const pane = document.createElement("div");
  const metadata = document.createElement("div");
  const property = document.createElement("div");
  const container = document.createElement("div");
  pane.className = "workspace-leaf";
  metadata.className = "metadata-container";
  property.className = "metadata-property";
  property.dataset.propertyKey = "flow";
  container.className = "multi-select-container";
  renderValues(container, initialValues);
  property.appendChild(container);
  metadata.appendChild(property);
  pane.appendChild(metadata);
  document.body.appendChild(pane);

  const editor = { getValue: () => content } as Editor;
  const synchronize = vi.fn((properties: Record<string, unknown>) => {
    const values = properties.flow;

    if (Array.isArray(values) && values.every((value) => typeof value === "string")) {
      renderValues(container, values);
    }
  });
  const view = {
    containerEl: pane,
    editor,
    file,
    getFile: () => file,
  } as unknown as MarkdownView & {
    getFile: () => TFile;
    metadataEditor: {
      containerEl: HTMLElement;
      owner: MarkdownView;
      synchronize: typeof synchronize;
    };
  };
  view.metadataEditor = {
      containerEl: metadata,
      owner: view,
      synchronize,
  };
  const visibleValues = (): string[] =>
    Array.from(container.querySelectorAll<HTMLElement>(".multi-select-pill")).map(
      (pill) => pill.textContent ?? "",
    );

  return {
    container,
    expectedContent,
    getContent: () => content,
    reconcile: () =>
      reconcileMetadataEditorProperties({
        document,
        editor,
        expectedContent,
        file,
        isAligned: () => visibleValues().join("\u0000") === "beta\u0000alpha",
        paneContainer: pane,
        propertyKeys: ["flow"],
        view,
      }),
    setContent: (nextContent) => {
      content = nextContent;
    },
    synchronize,
    view,
    visibleValues,
  };
}

function renderValues(container: HTMLElement, values: readonly string[]): void {
  container.querySelectorAll(".multi-select-pill").forEach((pill) => pill.remove());

  for (const value of values) {
    const pill = document.createElement("div");
    pill.className = "multi-select-pill";
    pill.textContent = value;
    container.insertBefore(pill, container.querySelector(".multi-select-input"));
  }
}
