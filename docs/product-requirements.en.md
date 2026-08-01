---
source_language: zh-CN
translation_of: product-requirements.zh-CN.md
translation_status: synced
---

# Property Order Product Requirements

This document defines the current Property Order product boundary. It mirrors the authoritative Chinese version.

## Product goal

Property Order enhances only two kinds of order in Obsidian Properties:

1. value order in top-level YAML list properties of the current note;
2. ordering and filtering of the native property-key suggestion menu.

The enhancement must remain local, reversible, and fail-safe. Unrecognized host DOM keeps native Obsidian behavior; frontmatter that cannot be parsed and validated safely is never written.

## Property-value order

- Support top-level flow and block lists rendered by Obsidian Properties as pills.
- Support same-property reorder and, when enabled, moves between supported properties in the same leaf and file.
- Obsidian's native Properties list type is authoritative: both a normal multi-value editor and a row carrying the native list icon plus a type-mismatch warning may participate. An empty value, `[]`, or one supported YAML scalar is a logical text list, and a scalar can be moved out as well as receive a moved value. A mixed array collapsed by the host into one field never guesses a source item; it may receive an append only when its readable, unambiguous display exactly matches current YAML. A successful same-property reorder normalizes every item in that property; a successful cross-property move normalizes every item in both source and target. Numbers, booleans, and list-item nulls become double-quoted strings of their original token text, while existing strings and retainable quote styles remain unchanged. Objects, nested structures, and multiline values are never coerced.
- Desktop mouse drag starts after a movement threshold; touch and pen input available to the desktop app start after long press.
- On mobile, a native value-menu action arms one pill for 15 seconds. The next touch or pen movement on that same pill starts drag after a small threshold, without another long press. Tapping elsewhere, Escape, timeout, unload, or invalidated DOM cancels the armed state.
- Writeback modes are `preserve`, `flow`, and `block`. The selected mode applies to every affected property for both same-property and cross-property operations. Every change uses the same original text as its coordinate base, and each successful drag uses one verified public editor transaction that creates one undo step. Save scheduling and Properties refresh occur only after the buffer exactly matches the plan. Only the one trailing click whose coordinates match the drag release is consumed; unrelated clicks in the same host turn remain native. If the public view reload still leaves stale rows, only an identity-guarded Properties synchronization adapter may ask the host to rebuild from fresh frontmatter before every affected value is verified. Failed automatic recovery presents an independent Refresh Properties action for each original pane; every click follows the current exact undo or redo state, and only a failed retry recommends reopening the note. The plugin never reopens a note automatically or uses native property setters, direct Vault writes, manual pill relocation, or automatic rollback to manufacture or restore a result. Unchanged text is failure, any partially or differently applied result is divergence, and a no-op, cancellation, or failure never formats opportunistically.
- After an exact commit, the same Markdown editor immediately owns platform undo/redo shortcuts. Host focus loss during Properties reconstruction or reconciliation is repaired only while the user has not deliberately moved focus to another control, pane, or window. Undo requires no intervening body click. A no-op, cancellation, rejection, conflict, or ineffective transaction never forces editor focus. During asynchronous reconciliation, an exact return to this transaction's pre-commit text is a valid immediate undo, not divergence or an out-of-sync condition, and the plugin never reapplies the undone content.
- File, leaf, source/target content, or DOM identity changes cancel the transaction without writing another file or overwriting newer content.
- Dragging over a property in the same pane that has positive native non-list evidence corroborated by scalar storage shows a rejected target without an insertion indicator. A localized Notice appears only when released on that target, not while merely passing over it; an unknown host row cancels silently rather than being mislabeled.
- Conflicts, invalid input, and unsupported structures produce a diagnostic and leave disk content unchanged.

## Property-key suggestions

- Support pinned, bottom, wildcard-hidden, name, recently used, and Markdown-note-count rules.
- Name order handles numbers, Latin text, Chinese text by pinyin, then other characters. Note count sorts descending and uses the same name comparator for ties. The count is the number of cached Markdown frontmatter documents containing the property, not a count of user interactions.
- Recently used is a strict MRU. Hidden rules filter first; pinned rules take priority in configured order; the remaining recorded property names follow newest confirmed use first; unrecorded names use name order; and bottom rules apply last. History entries absent from the current candidates do not participate in menu ordering.
- A property's exact string moves to the MRU front only after a property-name commit and Metadata Cache confirmation that the name was added to the target note. Hover, keyboard navigation, cancellation, failure, and unconfirmed edits do not count. History stores at most 100 names and no timestamps.
- MRU is stored through Obsidian local storage for the current Vault and device, separately from settings `data.json`, and is not synced. Read failure or malformed data fails open as empty history. Name and recent modes never traverse the Vault; note-count mode reads Markdown file caches lazily only when needed and reuses the invalidatable cache.
- Settings and the native menu share one ordering contract.
- Keyboard navigation follows final visible DOM order for arrows, Home/End, PageUp/PageDown, macOS/iOS Ctrl+P/N, and Enter.
- An all-hidden menu cannot submit a hidden item; keyboard interception stops when focus leaves the property-name editor.
- Unrecognized Properties menus or failed host-selection synchronization restore native order, visibility, and interaction.

## Settings

- Settings currently use schema 4, with sequential migration and normalization of invalid values.
- General, Value drag, and Key order remain three logical groups with immediate-application semantics: Obsidian 1.12.x uses custom tabs, while 1.13+ uses native declarative pages and settings search.
- Persistence failure keeps the in-memory state and presents a localized Notice, accessible unsaved status, and Retry action.
- Key order provides a **Clear recent property history** action. It cancels pending confirmations and deletes only the current Vault and device's MRU; it does not modify `data.json`, notes, or another Vault. If device-local deletion fails, the in-memory history remains cleared and the user is warned that saved history may return after restart.
- Key order provides a transient **Test property name rules** input. It shows the first matching hidden, pinned, and bottom rule together with the effective hidden > pinned > bottom result. The test value is never persisted, changes neither `data.json`, MRU, nor notes, and does not traverse the Vault.
- Cross-property drag is enabled by default and can be disabled independently; key-suggestion enhancement can also be disabled independently and fully restores host state.

## Explicit non-goals and limitations

- No nested lists, object lists, multiline flow sequences, source-mode drag, or cross-file moves.
- Forced block-to-flow conversion may discard item comments and blank lines that only block form can represent.
- Mobile reorder extends Obsidian's native Edit, Remove from list, and Copy menu instead of replacing it. If the shared host menu is unavailable, the plugin adds nothing and leaves native behavior unchanged.
- Property-value reorder supports pointer input only. It has no direct keyboard reorder command or screen-reader drag live region.
- The plugin does not perform a second non-undoable Vault write solely to restore a disk-specific newline convention after Obsidian saves an editor transaction.
- Key-suggestion enhancement depends on a recognizable public DOM shape; fail open is correct when host structure changes.
- Only notes exposed by Obsidian as Properties are in scope; real-UI writeback is not promised for CR-only documents that the host does not expose.
