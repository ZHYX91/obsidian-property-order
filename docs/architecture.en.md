# Property Order Architecture

This document mirrors the authoritative Chinese architecture for Property Order 0.1.0. If the implementation, tests, or this translation conflict with `architecture.zh-CN.md`, the Chinese document defines the intended boundaries and contracts.

## Goals and Non-goals

The plugin enhances two kinds of order in Obsidian Properties: values in top-level YAML list properties and native property-key suggestions. Version 0.1.0 provides desktop same-property drag, same-note cross-property moves, three YAML writeback modes, and cross-platform native key-suggestion ordering. The mobile app leaves property-value gestures to Obsidian.

Nested lists, object lists, multiline flow sequences, source-mode dragging, and cross-file moves remain out of scope and fail closed. The refactor isolates parsing, interaction, DOM, and Vault boundaries; it is not a product expansion or a ground-up rewrite.

## Layers and Dependency Direction

Dependencies point inward toward the pure core:

1. `src/core/`: pure TypeScript rules with no Obsidian imports or browser DOM access.
   - `frontmatter/`: frontmatter bounds, top-level flow/block list parsing, diagnostics, and localized rewrites.
   - `suggestions/`: hide, deduplicate, pin, bottom-place, and sort suggestion keys; its property-name comparator is the single ordering implementation shared by settings and native menus.
   - `interaction/`: pointer-drag state transitions and document identity guards.
2. `src/features/`: feature orchestration.
   - `value-order/`: combines state-machine actions, drop geometry, DOM presentation, pane context, and writeback into a drag transaction.
   - `key-order/`: observes suggestion menus, applies pure ordering rules, and bridges keyboard selection to the visible suggestion order.
3. `src/obsidian/`: the Obsidian and DOM adapter boundary.
   - `properties-dom.ts`: Properties containers, pills, and property-name detection.
   - `native-suggest-dom.ts`: native property-key suggestion recognition.
   - `pane-context.ts`: workspace leaf and file resolution.
   - `metadata.ts`: candidate-key and usage-count conversion from top-level frontmatter through public Vault enumeration and per-file Metadata Cache APIs. The settings UI and suggestion controller share one invalidatable cache. The module also takes a synchronous snapshot of supported top-level list values when drag activation begins.
4. `src/app/`: plugin lifecycle, settings persistence, and settings UI; existing property names are presented and filtered through Obsidian's public `AbstractInputSuggest` API.
5. `src/shared/`: versioned settings, shared types, and i18n.

The project does not add abstraction folders merely to increase file count. `writeback.ts`, `pane-context.ts`, and the two DOM adapters already provide testable Vault, pane, and Properties-surface boundaries. Future port interfaces must preserve the same dependency direction.

## Localized Frontmatter Rewrite Contract

`src/core/frontmatter/index.ts` keeps the stable public API while responsibilities are split across:

- `bounds.ts`: BOM, frontmatter delimiter bounds, and LF/CRLF/CR detection.
- `property-line.ts`: top-level property-head scanning, including safely decoded quoted keys and keys containing colons.
- `flow-list.ts`: bracket-list scanning and safe item separation.
- `block-list.ts`: bullet items, comments, blank lines, and item-style recognition.
- `scalar.ts`: scalar extraction, safe quoting, and inline-comment separation.
- `rewrite.ts`: same-property reorder, cross-property move, and output-format selection.
- `diagnostics.ts` and `types.ts`: diagnosable results and shared models.

Writeback replaces only the affected source/target property slices; it never stringifies the whole YAML document. Body text and unaffected properties remain byte-for-byte unchanged. In `preserve` mode, affected lists also retain every representable quote, comment, blank line, item style, and original newline convention.

Scalar parsing mirrors the YAML core-schema types exposed by Obsidian: null, boolean, number (including infinity and NaN), and string remain distinct. `preserve` keeps the original token spelling, while forced `flow` or `block` output normalizes spelling without turning a typed scalar into a string or an ambiguous string into another YAML type. Metadata/writeback conflict snapshots compare both scalar kind and canonical value.

| Current format | `preserve` | `flow` | `block` |
| --- | --- | --- | --- |
| flow | Keep flow and original scalar spelling | Flow with safely normalized scalars | Block with safely normalized scalars |
| block | Keep block style, item style, comments, and blank lines | Flow; block-only item comments/blank lines may be discarded | Block; safely normalize while retaining attachable comments |
| empty flow | `[]` | `[]` | Empty block head |
| empty block | Empty block head | `[]` | Empty block head |

Missing properties, unsupported values, index conflicts, and content conflicts return diagnostics without partial writes. Single/double quotes and scalars containing commas or `#` must parse safely. A property-head inline comment must retain valid whitespace when converted to flow form.

## Property-value Drag Transaction

`core/interaction/pointer-drag.ts` is the pure state machine. It converts mouse/touch/pen press, movement, long-press timing, release, and interruption into actions such as `start`, `cancel`, and `finish`, without DOM access. `value-drag-controller.ts` only orchestrates actions and resource lifetimes:

1. Capture the source property, source index, and file path from the initiating pill, Properties container, and pane. At the same time, synchronously capture supported top-level list values from the public Metadata Cache so a late asynchronous read cannot mistake an external edit for drag-start state.
2. Let `drop-targeting.ts` resolve a target container and insertion slot in the same pane; cross-property permission is read from current settings for each event.
3. Let `drag-dom.ts` own the preview, indicator, cursor class, and optimistic DOM. Every cancellation path must fully clean them up.
4. In `writeback.ts`, read the latest content inside `vault.process`, then validate the source/target values captured at drag start. Invoke the pure frontmatter rewrite only if both identity and content guards pass.

An asynchronous read at drag start is only a supplemental conflict snapshot. It cannot replace the synchronous Metadata Cache snapshot captured at activation and is never the final write base. An active leaf/file change, disappearing source DOM, `pointercancel`, Escape, window blur, no-op drop, or content conflict must cancel safely without writing stale state to the current file or another file.

`PropertyValueOrderController` does not register any document listeners in the mobile app, and the plugin does not apply its draggable-pill body class there. Obsidian therefore retains its native property-value long-press menu. In the desktop app, touch handling has two phases for touch-capable Windows devices: pills retain `touch-action: manipulation`, and a temporary capture, non-passive `touchmove` listener suppresses the browser default only after dragging begins. A capture `contextmenu` listener prevents that desktop touch interaction from opening the native value menu; ordinary mouse context menus remain available.

The floating preview locks the source pill's rendered dimensions, stays on one clipped line, and is positioned against its own document's visual viewport (falling back to that window's layout viewport). Oversized previews are reduced and every position is clamped inside the viewport margin, including narrow desktop views and secondary windows.

## Fail-open Property-key Suggestions

All Obsidian Properties and suggestion-menu selectors live under `src/obsidian/`. While suggestion ordering is enabled, `key-suggestion-controller.ts` collects changes through one MutationObserver per document and coalesces enhancement into one animation frame. Desktop initialization scans the current document to support a menu that was already open before the plugin was enabled. Android startup skips that eager whole-document scan and observes menus as they are mounted, avoiding main-thread contention while the WebView incrementally constructs the workspace. The observer is disconnected while the feature is disabled; re-enabling starts observation and explicitly scans the current document. Reordering is allowed only after the adapter confirms Properties context, a supported menu container, and a common parent for suggestion items.

Enhancement reuses the original nodes and records their native order and visibility. Its keyboard bridge runs only while the property-key editor associated with an enhanced menu still owns focus. It follows visible DOM order for ArrowUp/Down, Home/End, PageUp/PageDown, and macOS/iOS Ctrl+P/N. The bridge directly maintains the native `is-selected` class on visible DOM items; it dispatches no synthetic mousemove and reads or writes no private Obsidian arrays. Enter directly activates the selected visible DOM item and is blocked when every candidate is hidden.

Disabling the setting, reusing the menu, closing its window, or unloading the plugin restores native state and removes observers, keyboard listeners, and active-menu references. If native selection cannot be synchronized, the controller restores that menu immediately. An unrecognized menu, incompatible structure, or unreadable candidate text is left unchanged, preserving native input, selection, and dismissal as the fail-open result.

## Settings and Live Updates

`src/shared/settings.ts` currently uses schema version 3. Loading migrates legacy keys sequentially, then normalizes unknown or invalid values. Default arrays and every normalized result use isolated references. Key-suggestion sorting accepts only `name` and `usage`: `name` groups numbers, Latin names, Chinese names by pinyin, then other characters; `usage` sorts counts descending and uses the same name comparator for ties. The removed `alphabetical` value has no alias or migration path and falls back to the default `name` mode as invalid input. The plugin persists the migrated result.

The settings UI and the actual Properties suggestion menu must both call the comparator in `src/core/suggestions/property-names.ts`. Pinned, bottom, and hidden lists share one concrete property-name suggest component. That component owns only filtering, exclusion of configured values, and selection callbacks; it neither duplicates ordering nor grows into a generic framework unrelated to this feature.

Property-key usage counts are held in one lazy cache shared by the settings UI and suggestion controller. Metadata Cache `changed`, `deleted`, and `resolved` events invalidate it; Markdown file caches are traversed again only when usage ordering actually requests the data.

The settings UI retains General, Value drag, and Key order tabs, with `tablist`/`tab`/`tabpanel`, a localized tab-list label, `aria-selected`, roving `tabindex`, Left/Right, Home/End, and focus retention after rerender. Tabs stay on one horizontally scrollable row at narrow widths; the active tab is revealed after initial layout and viewport resize, and vertical overflow is hidden. Tab height is 34px for desktop fine pointers and 44px for coarse pointers. At widths up to 480px, each property-rule textarea and existing-property input stacks vertically and fills the control area.

If settings persistence fails, the UI retains the current in-memory snapshot, shows a localized Notice and an unsaved banner with `role="alert"`, and offers Retry. A retry preserves whether the failed batch requires key-suggestion refresh; successful persistence clears the unsaved state.

Controllers do not retain stale settings that affect subsequent interactions: value drag reads current settings on the next pointer event; key-order changes immediately re-enhance or restore the menu without a plugin reload.

## Verification and Release Boundary

- Automated regression coverage: `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, and `tests/app/`.
- Product boundary: [`product-requirements.en.md`](product-requirements.en.md).
- UX contract: [`ux-spec.en.md`](ux-spec.en.md).
- Automated gates, real-host matrix, and current evidence boundary: [`testing-strategy.en.md`](testing-strategy.en.md).
- Before release, `npm run check` must pass; it runs `npm run typecheck`, `npm test`, `npm run build`, and `npm run check:release` in sequence.
- CI performs a locked install and the complete gate on Node 20, then uploads `dist/property-order/`. A separate release workflow accepts only an exact `x.y.z` tag matching `manifest.json`, without a `v` prefix; after the gate passes, it publishes the loose `main.js`, `manifest.json`, and `styles.css` assets required by Obsidian plus `property-order-<version>.zip`. The archive contains exactly those three files under one `property-order/` directory. Re-running an existing tag replaces its assets instead of creating a duplicate Release.

DOM-interaction and visual release gates require the real-host evidence defined by the testing strategy. Capabilities explicitly listed as product non-goals are not treated as unfinished release items.
