# Property Order Product Requirements

This document defines the current Property Order 0.1.1 product boundary. It mirrors the authoritative Chinese version.

## Product goal

Property Order enhances only two kinds of order in Obsidian Properties:

1. value order in top-level YAML list properties of the current note;
2. ordering and filtering of the native property-key suggestion menu.

The enhancement must remain local, reversible, and fail-safe. Unrecognized host DOM keeps native Obsidian behavior; frontmatter that cannot be parsed and validated safely is never written.

## Property-value order

- Support top-level flow and block lists rendered by Obsidian Properties as pills.
- Support same-property reorder and, when enabled, moves between supported properties in the same leaf and file.
- Property-value drag runs only in the desktop app. Mouse starts after a movement threshold; touch and pen input available to the desktop app start after long press.
- Writeback modes are `preserve`, `flow`, and `block`. Preserve mode retains the current form and all retainable scalar spelling, comments, blank lines, and newlines; forced conversion normalizes only affected properties.
- File, leaf, source/target content, or DOM identity changes cancel the transaction without writing another file or overwriting newer content.
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
- Cross-property drag is disabled by default; key-suggestion enhancement can be disabled independently and fully restores host state.

## Explicit non-goals and limitations

- No nested lists, object lists, multiline flow sequences, source-mode drag, or cross-file moves.
- Forced block-to-flow conversion may discard item comments and blank lines that only block form can represent.
- Property-value reorder is disabled in the mobile app so Obsidian's native Edit, Remove from list, and Copy long-press menu remains available. Property-key suggestion ordering remains supported on mobile.
- Desktop property-value reorder supports pointer input only. Version 0.1.1 has no direct keyboard reorder command or screen-reader drag live region.
- Key-suggestion enhancement depends on a recognizable public DOM shape; fail open is correct when host structure changes.
- Only notes exposed by Obsidian as Properties are in scope; real-UI writeback is not promised for CR-only documents that the host does not expose.
