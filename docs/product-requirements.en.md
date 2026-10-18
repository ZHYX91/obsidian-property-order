---
source_language: zh-CN
translation_of: product-requirements.zh-CN.md
translation_status: synced
---

# Property Order — Product requirements

This document defines the current Property Order product boundary. It mirrors the authoritative Chinese version.

## Product goal

Property Order improves ordering in three parts of Obsidian Properties:

1. value order in top-level YAML list properties of the current note;
2. ordering and filtering of the native property-key suggestion menu;
3. ordering and filtering of native property-value suggestions with per-property rules.

The plugin changes only content involved in the current action, and successful changes remain undoable. If Obsidian's UI cannot be recognized safely, native behavior is left alone. Frontmatter that cannot be parsed and validated safely is never written.

## Property-value order

- Support top-level flow and block lists rendered by Obsidian Properties as pills.
- Support same-property reorder and, when enabled, moves between supported properties in the same leaf and file.

- Whether a property can participate in value dragging is determined by how Obsidian Properties presents its type. A normal multi-value editor can participate, and a type-mismatch row can also participate when Obsidian still exposes clear native list evidence.
- An empty value, `[]`, or one supported scalar can be treated as a logical text list: a scalar may be moved out or receive a moved value. If Obsidian collapses a mixed array into one field, the plugin never guesses a source item; it may only append when the displayed value maps unambiguously to the current YAML.
- Successful operations convert affected non-string values to text while preserving their original YAML spelling. Numbers, booleans, and list-item nulls become quoted strings based on their original tokens. Objects, nested structures, and multiline values are never coerced.
- Desktop mouse drag starts after a movement threshold; touch and pen input available to the desktop app start after long press.
- On mobile, a native value-menu action arms one pill for 15 seconds. The next touch or pen movement on that same pill starts drag after a small threshold, without another long press. Tapping elsewhere, Escape, timeout, unload, or invalidated DOM cancels the armed state.
- Drop geometry follows the container's inline direction, including wrapped rows in RTL layouts. Dragging near a scrollable Properties edge advances the applicable scroll container by a bounded step. A polite live region announces drag start and target-state changes, and reduced-motion preference disables preview and indicator transitions.

- Writeback mode can be `preserve`, `flow`, or `block`. Same-property reorders and cross-property moves follow the same rules, and each successful drag creates one undo step.
- The plugin schedules persistence and refreshes Properties only after the editor content exactly matches the planned result. If the content changes before commit, the operation is cancelled. If the content was already committed but persistence scheduling later fails, the committed content remains and the user is told to save manually.
- After a successful write, visible Properties must reconcile with the current editor state and support immediate undo and redo. If automatic refresh fails, the plugin offers a Refresh Properties action and recommends reopening the note only after that retry also fails.
- The plugin never manufactures success by reopening a note automatically, writing directly through the Vault, using native property setters, manually relocating pills, or adding an automatic rollback transaction. No-op, cancellation, conflict, and failure paths never reformat unrelated content.

- After an exact commit, platform undo and redo work immediately without first clicking the note body. No-op, cancellation, rejection, conflict, or an ineffective transaction never forces editor focus.
- If Properties reconstruction or reconciliation causes the editor to lose focus, the plugin may restore it only while the user has not deliberately focused another control, pane, or window.
- If the user immediately undoes a drag while Properties is refreshing, the editor returns to the exact text from before the drag. The plugin must accept that undo without reporting a content conflict or reapplying the undone change.
- File, leaf, source/target content, or DOM identity changes cancel the transaction without writing another file or overwriting newer content.
- Dragging over a property in the same pane that has positive native non-list evidence corroborated by scalar storage shows a rejected target without an insertion indicator. A localized Notice appears only when released on that target, not while merely passing over it; an unknown host row cancels silently rather than being mislabeled.
- Conflicts, invalid input, and unsupported structures produce a diagnostic and leave disk content unchanged.

## Property-key suggestions

- Support pinned, bottom, wildcard-hidden, name, recently used, and Markdown-note-count rules, plus optional grouping of the normal section by Obsidian property type.
- When type grouping is enabled, normal candidates appear in this order: Text, List, Number, Checkbox, Date, Date & time, Tags, and Automatic / unspecified.
- Name, Recently used, or Note count sorting applies only inside each group. Hidden filtering still runs first; pinned candidates stay before the groups, and bottom candidates stay after them.
- Group labels are display-only decorations on native candidates, not additional selectable items.
- Name order handles numbers, Latin text, Chinese text by pinyin, then other characters. Note count sorts descending and uses the same name comparator for ties. The count is the number of cached Markdown frontmatter documents containing the property, not a count of user interactions.
- Recently used is a strict MRU. Hidden rules filter first; pinned rules take priority in configured order; the remaining recorded property names follow newest confirmed use first; unrecorded names use name order; and bottom rules apply last. History entries absent from the current candidates do not participate in menu ordering.
- A property's exact string moves to the MRU front only after a property-name commit and Metadata Cache confirmation that the name was added to the target note. Hover, keyboard navigation, cancellation, failure, and unconfirmed edits do not count. History stores at most 100 names and no timestamps.

- Recent-use history is stored in Obsidian local storage for the current Vault and device, separately from `data.json`, and is not synced. If the history cannot be read or is malformed, the plugin behaves as if no history exists and leaves native suggestions usable. Name and recent modes do not traverse the Vault for ordering; note-count mode reads cached metadata only when needed.
- Settings and the native menu share one ordering contract.
- Unmodified Up/Down, Home/End, and PageUp/PageDown follow the final visible candidate order; macOS/iOS also supports Ctrl+P/N. Enter submits the current visible candidate. Other modified navigation stays with the property input, so Shift+Home still selects text.
- An all-hidden menu cannot submit a hidden item; keyboard interception stops when focus leaves the property-name editor.
- Unrecognized Properties menus or failed host-selection synchronization restore native order, visibility, and interaction.

## Property-value suggestions

- Disabled by default and independent from property-name suggestions.
- Every exact property key has one effective behavior. Unassigned keys use the global default, which can be `native`, `name`, confirmed selection `frequency`, Markdown `note-count`, or `none`. An exact key may instead use `custom`; one key cannot be active in multiple behavior groups.
- Settings can add a key either by typing it or by choosing from the union of keys discovered in cached top-level frontmatter and keys already known to the plugin. A key already assigned to another group remains visible with its current group; moving it requires confirmation and atomically removes the old assignment.
- Property order in these settings arranges property chips in rule cards and the Custom property list by property name or by most recently added to the rules. It affects only these settings, leaving note-property order and value-suggestion order unchanged.
- Selection frequency belongs to the current Vault and device, separately from `data.json`. Successful selections are counted only while the property, or its Custom normal section, uses Selection frequency; a candidate activation must be followed by Metadata Cache confirmation in the target property. Hover, navigation, cancellation, failure, synchronization, and unrelated metadata changes do not count. Clearing counts never edits notes or configured candidates.
- Note count means the number of cached Markdown notes containing the exact value for the property, counted once per note. It is distinct from selection frequency and is loaded lazily through Metadata Cache.
- `custom` uses three sections: pinned, normal, and bottom. Pinned and bottom values are ordered explicitly. The normal section combines native/cached candidates with retained preset values and can use native, name, selection-frequency, or note-count ordering.
- A value explicitly configured in pinned, normal, or bottom becomes preset vocabulary for that property. It remains a selectable candidate even when no note currently contains it. Moving a configured value back to normal removes its fixed placement but keeps it preset; removing the preset affects only plugin configuration and never deletes note data.
- When Obsidian exposes a recognizable native property-value popup, custom preset values are integrated into that popup while native nodes retain host commit behavior. When no native popup exists, custom behavior may render a plugin-owned fallback popup anchored to the active property-value editor. A preset selection still commits through the native property editor input path rather than writing frontmatter directly.
- `none` suppresses candidates while preserving manual input. Disabling enhancement or unloading restores native popup state and removes plugin-owned fallback popups.
- Settings schema 6 migrates lossless schema-5 exact non-recent behavior overrides. Legacy recent, wildcard, pinned, bottom, or hidden rules that would change meaning under the new model remain preserved and marked for explicit migration; until confirmed, the legacy runtime remains authoritative.

## Settings

- Settings currently use schema 7, with sequential migration and normalization of invalid values. Schema 6 to 7 adds opt-in property-type grouping for key suggestions and leaves it disabled by default. The grouped value-suggestion model enforces at most one active behavior per exact property key; legacy rules that cannot be translated without changing semantics remain marked for explicit migration.
- Every supported Obsidian version shows the same four settings tabs: General, Value order, Key suggestions, and Value suggestions. Changes take effect immediately. The plugin keeps its own settings surface so layout and behavior remain consistent across host versions.
- The interface and complete README are available in 12 languages: English, Simplified Chinese, Traditional Chinese, German, French, Spanish, Portuguese, Russian, Japanese, Korean, Vietnamese, and Arabic. Follow Obsidian uses the host interface language; an explicit plugin language overrides it. Engineering documents retain paired Simplified Chinese and English versions.
- Value suggestions presents the five default-capable behaviors and a Custom group configured by exact property name. Ordinary groups use removable property chips; Custom places property selection beside the pinned, normal, and bottom candidate editor. Selection-frequency counts provide an independent clear action.
- If settings cannot be saved, the current in-memory settings remain active and the UI shows a localized Notice, an accessible unsaved state, and Retry. Users can keep editing rules while a slow save is pending; an earlier save completing or failing must not clear a later draft or move its caret.
- Before each save, and when Obsidian reports an external settings change, a three-way merge preserves external changes to settings the current UI did not edit and keeps unknown future-schema fields. Current UI edits win only for the settings they changed.
- Storage operations remain ordered when the plugin instance is replaced, and an unloaded instance cannot start a new save.
- Key suggestions provides a **Clear recent property history** action. It cancels pending confirmations and deletes only the current Vault and device's MRU; it does not modify `data.json`, notes, or another Vault. If device-local deletion fails, the in-memory history remains cleared and the user is warned that saved history may return after restart.
- Key suggestions provides a transient **Test property name rules** input. It shows the first matching hidden, pinned, and bottom rule together with the effective hidden > pinned > bottom result. The test value is never persisted, changes neither `data.json`, MRU, nor notes, and does not traverse the Vault.
- Cross-property drag is enabled by default and can be disabled independently; disabling the parent value-drag feature preserves this preference for re-enablement. Key-suggestion enhancement can also be disabled independently and fully restores host state.

## Explicit non-goals and limitations

- No nested lists, object lists, multiline flow sequences, source-mode drag, or cross-file moves.
- Forced block-to-flow conversion may discard item comments and blank lines that only block form can represent.
- Mobile reorder extends Obsidian's native Edit, Remove from list, and Copy menu instead of replacing it. If the shared host menu is unavailable, the plugin adds nothing and leaves native behavior unchanged.
- Property-value reorder supports pointer input only and has no direct keyboard reorder command. Drag-status announcements describe pointer-drag state but do not provide a keyboard reorder interaction.
- The plugin does not perform a second non-undoable Vault write solely to restore a disk-specific newline convention after Obsidian saves an editor transaction.
- Key-suggestion enhancement depends on recognizable Obsidian DOM structure. If the host changes in a way the plugin cannot identify safely, the enhancement stops and native suggestion behavior is preserved.
- Only notes exposed by Obsidian as Properties are in scope; real-UI writeback is not promised for CR-only documents that the host does not expose.
