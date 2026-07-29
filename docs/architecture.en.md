---
source_language: zh-CN
translation_of: architecture.zh-CN.md
translation_status: synced
---

# Property Order Architecture

This document mirrors the authoritative current Chinese architecture. If the implementation, tests, or this translation conflict with `architecture.zh-CN.md`, the Chinese document defines the intended boundaries and contracts.

## Goals and Non-goals

The plugin enhances two kinds of order in Obsidian Properties: values in top-level YAML list properties and native property-key suggestions. It provides cross-platform same-property drag, same-note cross-property moves, three YAML writeback modes, and native key-suggestion ordering.

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
   - `editor-transaction.ts`: host compatibility, exact verification, public Properties reload, and persistence for public editor transactions.
   - `metadata.ts`: candidate-key and usage-count conversion from top-level frontmatter through public Vault enumeration and per-file Metadata Cache APIs. The settings UI and suggestion controller share one invalidatable cache. During drag targeting, cached storage shape can only corroborate positive native type evidence; it never defines a property type by itself.
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
- `text-list.ts`: conversion of non-string host text-list tokens into strings from their original spelling while retaining item position and attachable comments.
- `rewrite.ts`: same-property reorder, cross-property move, and output-format selection.
- `diagnostics.ts` and `types.ts`: diagnosable results and shared models.

The pure rewrite replaces only the affected source/target property slices; it never stringifies the whole YAML document. Body text and unaffected properties remain textually unchanged. In `preserve` mode, affected lists also retain every representable quote, comment, blank line, item style, and the input newline convention. Runtime drag writeback commits that minimal logical change through Obsidian's editor so unsaved text and undo history remain authoritative. Obsidian 1.12.7 serializes an edited CRLF/CR note as LF even for an ordinary manual edit; Property Order deliberately does not add a second Vault write to fight that host behavior.

Scalar parsing mirrors the YAML core-schema types exposed by Obsidian: null, boolean, number (including infinity and NaN), and string remain distinct, and Metadata/writeback conflict snapshots compare both kind and canonical value. The generic pure YAML API preserves these types by default. Runtime drag has already confirmed an Obsidian native multi-value text editor, so `text-list.ts` converts non-string items in every affected property into strings during a successful operation. Conversion uses original token spelling: `0xFF` becomes `"0xFF"`, not `"255"`, and an empty block item becomes `""`; existing string tokens retain their spelling under `preserve`.

| Current format | `preserve` | `flow` | `block` |
| --- | --- | --- | --- |
| flow | Keep flow and original scalar spelling | Flow with safely normalized scalars | Block with safely normalized scalars |
| block | Keep block style, item style, comments, and blank lines | Flow; block-only item comments/blank lines may be discarded | Block; safely normalize while retaining attachable comments |
| empty flow | `[]` | `[]` | Empty block head |
| empty block | Empty block head | `[]` | Empty block head |
| scalar | Minimal inline flow conversion; explicit null is empty | Flow | Block |

Missing properties, unsupported values, index conflicts, and content conflicts return diagnostics without partial writes. Single/double quotes and scalars containing commas or `#` must parse safely. A property-head inline comment must retain valid whitespace when converted to flow form.

## Property-value Drag Transaction

`core/interaction/pointer-drag.ts` is the pure state machine. It converts mouse/touch/pen press, movement, long-press timing, release, and interruption into actions such as `start`, `cancel`, and `finish`, without DOM access. `value-drag-controller.ts` only orchestrates actions and resource lifetimes:

1. Capture the source property, source index, exact pill nodes, file path, and the leaf's public `MarkdownView.editor` from the initiating pill, Properties container, and pane. Editor text is the sole content and conflict base. Visible pill order and YAML must agree before the source can be used.
2. Let `drop-targeting.ts` resolve one explicit state in the same pane: supported list, supported type-mismatch list, confirmed non-list, or unknown. Normal lists use Obsidian's native multi-value container. Obsidian 1.12.7 renders scalar or mixed storage as one type-mismatch field, so that fallback is accepted only when both the native list icon and warning are present; private `types.json` is never read. A scalar mismatch field can be the sole source value or a target. A mixed array field cannot identify a source index and therefore fails closed; it can receive an append only when its readable, unambiguous comma-separated display exactly matches current YAML. A non-list Notice requires positive native non-list evidence corroborated by scalar storage; unknown rows cancel silently.
3. Let `drag-dom.ts` own the preview, indicator, rejected target, and cursor class, but never move, remove, or copy host property pills. Every cancellation path must fully clean them up. Passing over a rejected target emits no Notice; the controller reports it only on release.
4. After pointer release and native-input blur, revalidate leaf, file, editor, property keys, editor kinds, exact source/target nodes, visible values, and current YAML before planning. Same-property reorder produces one exact property change; cross-property move produces two non-overlapping exact property changes. Every change uses the same original editor text as its coordinate base and is committed atomically by one public `editor.transaction()` call. `editor-transaction.ts` isolates the exact origin `"set"` as an Obsidian 1.12.x hidden-frontmatter-filter compatibility detail; feature code must neither duplicate that string nor rely on a private transaction API. After one host turn, editor text must equal the complete planned result byte-for-byte. Unchanged text is a safe write failure; any third state is reported as divergence and is never followed by an automatic rollback transaction. Explicit property-level null is empty, while objects, duplicate property keys, and complex structures still fail closed.

The editor remains the only content and conflict base, so unsaved body edits are preserved; one successful same-property or cross-property drag creates exactly one undo step. On pointer release, the controller suppresses the one trailing click produced by that drag and blurs native source/target inputs so Obsidian's focus protection cannot skip component reconstruction. Only after the editor buffer exactly matches the plan may `editor-transaction.ts` call public `MarkdownView.setViewData(committedContent, false)` to rebuild Properties from that same content, verify that no second text change occurred, and then call public `MarkdownView.requestSave()` to schedule persistence. Identity of the original leaf, file, view, and editor must be revalidated both after the host turn and after reconstruction. Once writeback returns an exact commit, the controller calls public `editor.focus()` before its first Properties wait so CodeMirror owns platform undo/redo. After reconstruction and reconciliation, it performs one guarded repair only when focus remains on `body`, the focus owner captured before drag start, a disconnected old node, or an affected Properties row and no post-commit pointer, focus-navigation, or window-intent generation has advanced. Deliberate user focus invalidates that repair; paths without an exact commit never invoke it. Pre-commit drag/DOM ownership and post-commit document identity are deliberately separate: window blur or plugin unload may clean up drag UI, but must not suppress persistence for an exact commit that still belongs to the original document. A `requestSave()` exception is a distinct persistence-scheduling failure: editor content remains committed and receives undo focus, while the user is told to save manually instead of receiving a false divergence warning. Native property setters, direct Vault writes, and manual pill relocation are not writeback or recovery mechanisms.

The controller then proves every affected Properties row against the current valid transaction state. A buffer equal to committed content continues post-commit reconciliation; an exact return to this transaction's original content is a valid immediate undo, and another exact committed state can be redo. Both states reconcile only from the current buffer, report no divergence, and never replay the transaction; only a third content state is divergence. If the public view reload still leaves stale UI, `metadata-editor-refresh.ts` extracts frontmatter again from the same editor buffer, creates a fresh property object through public `parseYaml`, and invokes its isolated `metadataEditor.synchronize()` capability only while file, view, editor, document, pane, host owner, host-container ownership, content, and focus guards for affected list rows still resolvable from the current DOM all hold. The adapter may only ask the host to rebuild UI and verifies unchanged editor text before and after the call; the controller must verify the buffer again after the host turn before reconciling normal multi-value editors or supported type-mismatch editors. Missing capability, exceptions, or failed verification produce one persistent Notice and Refresh Properties action per original pane. Every click reselects whichever exact original or committed buffer state is current, retries public `setViewData()` for that state, and uses the same guarded adapter only if needed; a valid undo/redo during the attempt restarts reconciliation from the new current state instead of reporting divergence. Success, failure, or closure in one pane never clears another pane's valid action, and layout changes prune only panes that have disconnected. Success dismisses the matching Notice, and only a failed retry recommends reopening the note. The plugin never closes or reopens a leaf automatically. Ineffective writes, active leaf/file/editor change, disappearing or reused DOM, `pointercancel`, Escape, window blur, no-op drop, or content conflict must cancel safely.

On mobile, `PropertyValueOrderController` listens for Obsidian's native property-value `contextmenu` event and uses public `Menu.forEvent` to append one action without suppressing or replacing the host menu. Selecting it arms only that pill for 15 seconds. Its next touch/pen press uses the pure state machine's `startOnMove` path, starts after the mouse-sized movement threshold, and consumes the arm once. Other taps, Escape, timeout, unload, DOM invalidation, and transaction cleanup cancel the state. During the armed press only, a second native context menu and default touch movement are suppressed. If the shared menu cannot be obtained, the helper fails open without changing host behavior.

In the desktop app, touch handling retains the direct two-phase path for touch-capable Windows devices: pills use `touch-action: manipulation`, and a temporary capture, non-passive `touchmove` listener suppresses the browser default only after dragging begins. A capture `contextmenu` listener prevents that active desktop touch drag from opening the native value menu; ordinary mouse context menus remain available.

The floating preview locks the source pill's rendered dimensions, stays on one clipped line, and is positioned against its own document's visual viewport (falling back to that window's layout viewport). Oversized previews are reduced and every position is clamped inside the viewport margin, including narrow desktop views and secondary windows.

Both multi-window controllers use each document as a resource owner. The plugin registers an idempotent controller disposer in its runtime rollback stack before first initialization, and each controller registers the document owner before attaching its first observer or event listener. Partial initialization, window close, and plugin unload release resources in reverse order while isolating individual cleanup failures so the remaining documents are still restored.

## Fail-open Property-key Suggestions

All Obsidian Properties and suggestion-menu selectors live under `src/obsidian/`. While suggestion ordering is enabled, `key-suggestion-controller.ts` collects changes through one MutationObserver per document and coalesces enhancement into one animation frame. Desktop initialization scans the current document to support a menu that was already open before the plugin was enabled. Android startup skips that eager whole-document scan and observes menus as they are mounted, avoiding main-thread contention while the WebView incrementally constructs the workspace. The observer is disconnected while the feature is disabled; re-enabling starts observation and explicitly scans the current document. Reordering is allowed only after the adapter confirms Properties context, a supported menu container, and a common parent for suggestion items.

Enhancement reuses the original nodes and records their native order and visibility. Its keyboard bridge runs only while the property-key editor associated with an enhanced menu still owns focus. It follows visible DOM order for ArrowUp/Down, Home/End, PageUp/PageDown, and macOS/iOS Ctrl+P/N. The bridge directly maintains the native `is-selected` class on visible DOM items; it dispatches no synthetic mousemove and reads or writes no private Obsidian arrays. Enter directly activates the selected visible DOM item and is blocked when every candidate is hidden.

Disabling the setting, reusing the menu, closing its window, or unloading the plugin restores native state and removes observers, keyboard listeners, and active-menu references. If native selection cannot be synchronized, the controller restores that menu immediately. An unrecognized menu, incompatible structure, or unreadable candidate text is left unchanged, preserving native input, selection, and dismissal as the fail-open result.

## Settings and Live Updates

`src/shared/settings.ts` currently uses schema version 3. Loading migrates legacy keys sequentially, then normalizes unknown or invalid values. Default arrays and every normalized result use isolated references. Key-suggestion sorting accepts only `name` and `usage`: `name` groups numbers, Latin names, Chinese names by pinyin, then other characters; `usage` sorts counts descending and uses the same name comparator for ties. The removed `alphabetical` value has no alias or migration path and falls back to the default `name` mode as invalid input. The plugin persists the migrated result.

The settings UI and the actual Properties suggestion menu must both call the comparator in `src/core/suggestions/property-names.ts`. Pinned, bottom, and hidden lists share one concrete property-name suggest component. That component owns only filtering, exclusion of configured values, and selection callbacks; it neither duplicates ordering nor grows into a generic framework unrelated to this feature.

Property-key usage counts are held in one lazy cache shared by the settings UI and suggestion controller. Metadata Cache `changed`, `deleted`, and `resolved` events invalidate it. Connected enhanced menus are refreshed directly without scanning the entire document; with no open menu, no animation frame or Vault traversal is scheduled. Markdown file caches are traversed again only when a visible usage-sorted menu or the settings UI requests the data.

Obsidian 1.12.x retains the custom General, Value drag, and Key order tabs, with `tablist`/`tab`/`tabpanel`, a localized tab-list label, `aria-selected`, roving `tabindex`, Left/Right, Home/End, and focus retention after rerender. Tabs stay on one horizontally scrollable row at narrow widths; the active tab is revealed after initial layout and viewport resize, and vertical overflow is hidden. Tab height is 34px for desktop fine pointers and 44px for coarse pointers. Obsidian 1.13+ uses three native declarative setting pages so every simple control participates in settings search. Those controls override the default binding to use `propertyOrderSettings`; the three property-rule editors retain their custom textarea, property-name suggester, debounce, and cleanup through declarative `render` definitions. Definition construction never traverses the Vault: available property names remain lazy until the rule editors are actually rendered. At widths up to 480px, each property-rule textarea and existing-property input stacks vertically and fills the control area on either path.

If settings persistence fails, the UI retains the current in-memory snapshot, shows a localized Notice and an unsaved banner with `role="alert"`, and offers Retry. A retry preserves whether the failed batch requires key-suggestion refresh; successful persistence clears the unsaved state.

Controllers do not retain stale settings that affect subsequent interactions: value drag reads current settings on the next pointer event; key-order changes immediately re-enhance or restore the menu without a plugin reload.

## Verification and Release Boundary

- Automated regression coverage: `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, and `tests/app/`.
- Product boundary: [`product-requirements.en.md`](product-requirements.en.md).
- UX contract: [`ux-spec.en.md`](ux-spec.en.md).
- Automated gates, real-host matrix, and verification boundary: [`testing-strategy.en.md`](testing-strategy.en.md).
- Before release, `npm run check` must pass; it runs the official Obsidian ESLint gate, README and stable bilingual-document contracts, `npm run typecheck`, `npm test`, `npm run build`, and `npm run check:release` in sequence.
- Automatic plugin language follows Obsidian's configured interface language through `getLanguage()`; an explicit plugin language always takes precedence. The minimum supported Obsidian version is 1.12.7, while `versions.json` remains the compatibility contract for every published version.
- Production builds place `main.js`, `manifest.json`, and `styles.css` directly at the top level of `dist/`, so source-build review and the local release check use the same standard paths. CI performs a locked install and the complete gate on Node 20, then uploads those three files. A separate release workflow accepts only an exact `x.y.z` tag matching `manifest.json`, without a `v` prefix; after the gate passes, it publishes the three loose files and uses a deterministic archiver with fixed entry order, timestamps, permissions, and metadata to assemble `property-order-<version>.zip`. The archive contains exactly those three files under one `property-order/` directory. All four final assets receive build provenance attestations. The repository separately requires an active tag ruleset matching release-version tags, restricting both updates and deletions without a bypass for the release actor; the workflow neither changes that rule nor tries to infer it from arbitrary inherited conditions. Before querying a Release and on both sides of draft creation and publication, the workflow resolves the remote lightweight or annotated tag to its commit and requires it to remain equal to the push event's `GITHUB_SHA`; a missing, ambiguous, or moved tag fails closed. The workflow also uses a dedicated read-only Administration token to confirm that repository-level Release immutability is enabled, and never changes that setting. Only an explicit REST `404` means that the tagged Release is absent. Any other query failure stops publication. An existing same-tag Release must already report `immutable: true`, and its remote asset-name set must be unique and exactly equal the three loose files plus the current-version ZIP; only then do matching hashes for all four assets make the run a no-op. An older mutable Release or any missing, different, duplicate, or extra asset requires a version increase. A new Release is assembled as a draft with all four assets, published once, and then required to report `immutable: true`.

DOM-interaction and visual release gates require the real-host evidence defined by the testing strategy. Capabilities explicitly listed as product non-goals are not treated as unfinished release items.
