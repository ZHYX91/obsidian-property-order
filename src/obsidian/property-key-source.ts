import { parseYaml, type Editor, type Plugin } from "obsidian";
import { normalizePropertyKeyIdentity } from "../core/suggestions/property-names";
import { resolvePaneFileContext } from "./pane-context";

interface KeyIndex {
  header: string;
  authoredKeys: Map<string, string | null>;
}

interface DocumentSource {
  plugin: Plugin;
  indexes: WeakMap<Editor, KeyIndex>;
}

const sources = new WeakMap<Document, DocumentSource>();

export function bindPropertyKeySource(doc: Document, plugin: Plugin): void {
  if (sources.get(doc)?.plugin !== plugin) {
    sources.set(doc, { plugin, indexes: new WeakMap() });
  }
}

export function releasePropertyKeySource(doc: Document, plugin: Plugin): void {
  if (sources.get(doc)?.plugin === plugin) sources.delete(doc);
}

// Obsidian can trim Unicode edge spaces in a row's data attribute. Only accept
// that lossy projection when this pane's live YAML identifies one exact key.
export function confirmsAuthoredPropertyKey(row: HTMLElement, authored: string, host: string): boolean {
  const projection = authored.trim().toLocaleLowerCase();
  if (projection !== normalizePropertyKeyIdentity(host)) return false;
  const source = sources.get(row.ownerDocument);
  if (!source) return false;

  try {
    const pane = resolvePaneFileContext(source.plugin, row);
    if (!pane) return false;
    const header = readHeader(pane.editor);
    if (header == null) return false;
    let index = source.indexes.get(pane.editor);
    if (index?.header !== header) {
      const yaml: unknown = parseYaml(header);
      if (yaml == null || typeof yaml !== "object" || Array.isArray(yaml)) return false;
      const authoredKeys = new Map<string, string | null>();
      for (const key of Object.keys(yaml)) {
        const alias = key.trim().toLocaleLowerCase();
        authoredKeys.set(alias, authoredKeys.has(alias) ? null : key);
      }
      index = { header, authoredKeys };
      source.indexes.set(pane.editor, index);
    }
    return index.authoredKeys.get(projection) === authored;
  } catch {
    // The editor can close or its frontmatter can be incomplete during a redraw.
    return false;
  }
}

function readHeader(editor: Editor): string | null {
  if (!/^\uFEFF?---[ \t]*$/u.test(editor.getLine(0))) return null;
  const lines: string[] = [];
  const count = editor.lineCount();
  for (let i = 1; i < count; i++) {
    const line = editor.getLine(i);
    if (/^(?:---|\.\.\.)[ \t]*$/u.test(line)) return lines.join("\n");
    lines.push(line);
  }
  return null;
}
