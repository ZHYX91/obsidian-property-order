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
- Desktop mouse drag starts after a movement threshold; touch and pen input available to the desktop app start after long press.
- On mobile, a native value-menu action arms one pill for 15 seconds. The next touch or pen movement on that same pill starts drag after a small threshold, without another long press. Tapping elsewhere, Escape, timeout, unload, or invalidated DOM cancels the armed state.
- Writeback modes are `preserve`, `flow`, and `block`. Preserve mode retains the current form and all retainable scalar spelling, comments, blank lines, and input newlines in the pure rewrite; forced conversion normalizes only affected properties. Runtime writeback remains an Obsidian editor transaction, so the host may serialize an edited CRLF/CR note as LF.
- File, leaf, source/target content, or DOM identity changes cancel the transaction without writing another file or overwriting newer content.
- Dragging over a confirmed non-list property in the same pane shows a rejected target without an insertion indicator. A localized Notice appears only when released on that target, not while merely passing over it.
- Conflicts, invalid input, and unsupported structures produce a diagnostic and leave disk content unchanged.

## Property-key suggestions

- Support pinned, bottom, wildcard-hidden, name, and usage-count rules.
- Name order handles numbers, Latin text, Chinese text by pinyin, then other characters; usage ties use the same comparator.
- Settings and the native menu share one ordering contract.
- Keyboard navigation follows final visible DOM order for arrows, Home/End, PageUp/PageDown, macOS/iOS Ctrl+P/N, and Enter.
- An all-hidden menu cannot submit a hidden item; keyboard interception stops when focus leaves the property-name editor.
- Unrecognized Properties menus or failed host-selection synchronization restore native order, visibility, and interaction.

## Settings

- Settings use a versioned schema with sequential migration and normalization of invalid values.
- General, Value drag, and Key order tabs retain immediate-application semantics.
- Persistence failure keeps the in-memory state and presents a localized Notice, accessible unsaved status, and Retry action.
- Cross-property drag is enabled by default and can be disabled independently; key-suggestion enhancement can also be disabled independently and fully restores host state.

## Explicit non-goals and limitations

- No nested lists, object lists, multiline flow sequences, source-mode drag, or cross-file moves.
- Forced block-to-flow conversion may discard item comments and blank lines that only block form can represent.
- Mobile reorder extends Obsidian's native Edit, Remove from list, and Copy menu instead of replacing it. If the shared host menu is unavailable, the plugin adds nothing and leaves native behavior unchanged.
- Property-value reorder supports pointer input only. It has no direct keyboard reorder command or screen-reader drag live region.
- The plugin does not perform a second non-undoable Vault write solely to restore a disk-specific newline convention after Obsidian saves an editor transaction.
- Key-suggestion enhancement depends on a recognizable public DOM shape; fail open is correct when host structure changes.
- Only notes exposed by Obsidian as Properties are in scope; real-UI writeback is not promised for CR-only documents that the host does not expose.
