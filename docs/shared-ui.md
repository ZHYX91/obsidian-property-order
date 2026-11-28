---
source_language: zh-CN
translation_of: shared-ui.zh-CN.md
translation_status: synced
---

# Shared Obsidian plugin interface

This specification is for maintainers of Number Suite, Property Order, Folder Nodes, Link Integrity, Chrono Notes, Structural Tables and DocWen Assistant. Each plugin's UX specification defines its domain operations. This shared specification defines the interactions users can rely on across plugins and how to verify them.

## Settings tabs and appearance

On Obsidian 1.13 and later, global settings search can open a plugin by name. Individual settings are indexed from `getSettingDefinitions()`. A nonempty list also makes Obsidian render the page and skip `display()`. Keep definitions empty or absent while the plugin renders its own top tabs. [Obsidian migration guide](https://docs.obsidian.md/plugins/guides/migrate-declarative-settings)

- Keep top-level tabs on one line. Use a 2px theme-accent underline and semibold text for selection. Use Obsidian theme variables for ordinary labels, hover, borders, group spacing and card radii. Use the theme colors for normal text, warnings and actions according to their meaning.
- Compare the labels' natural span with the whole row. Each arrow takes up space only while content remains in that direction. Paging scrolls the labels and preserves the active panel. When a focused arrow reaches an end, move focus to the remaining arrow, or to the selected tab when everything fits. Integer scroll offsets and fractional label bounds can differ by 1 CSS px.
- Each group has one tab stop. Left and Right follow the interface direction. Home and End reach the ends. Up and Down retain native page scrolling. Accessible names and the tab, `tablist` and `tabpanel` relationships follow the displayed state. Reopening settings reveals the active label. Activating the selected tab again keeps its mounted panel, drafts and scroll position. Passive refresh preserves external focus.
- Desktop settings tabs have a minimum height of 34 CSS px. On coarse pointers, tabs and paging controls measure at least 44 CSS px in both dimensions, including short translations and strips where all tabs fit. Inline glyphs, tables and dense data cells follow their domain layout. The focus frame remains visible at scroll edges. Shape, lines or text also identify selection, focus and errors.

## Panels, dialogs and feedback

- Wrap or change columns based on the available settings panel or sidebar width, including a narrow pane in a wide desktop window. Dialogs mounted on the document body use their own content width. Long property names, paths and translations leave room for inputs, actions and candidate text.
- Provide discoverable touch or keyboard access to primary actions offered through drag, hover or long press. Preserve valid drafts, selection and the current control across redraws. Adding a repeated row focuses the new row. Deletion focuses a neighboring row or the add button. Closing a dialog returns focus to its opener while focus belongs to that flow.
- Keep the existing control when an ordinary setting changes. When a language or dependent option requires a redraw, restore focus by the setting's stable identity and preserve the scroll position. Preserve the user's new focus if they already left.
- Distinguish loading, empty, stale, successful and failed results where applicable. Keep error details and retry actions keyboard-accessible. If the file, note or selection changes during an asynchronous operation, keep feedback bound to the originating target. Previews for writes and their execution use the same target and corresponding version.
- Allow error details and retry actions to occupy separate lines in narrow panels or with large text. After expanding a long error path, the status remains legible and Retry stays within the panel.
- Preserve domain interactions. Number Suite distinguishes calculated and source numbers. Property Order supports keyboard value reordering. Folder Nodes retains direct graph manipulation. Link Integrity diagnostics belong to their source. Chrono Notes distinguishes the selected date from focus. Structural Tables previews the actual table operation. DocWen Assistant identifies the targets of connection, proofreading and export feedback.

## Regression acceptance

| Scenario | Observable passing result |
| --- | --- |
| Narrow panel or dialog in a wide desktop window | Keep the window size fixed, narrow the component and widen it again. Inputs, labels and actions remain usable without unintended horizontal scrolling. |
| All tabs fit, partial clipping and scroll limits | Measure actual layout. At each end the appropriate arrow disappears and releases its space. The active panel stays the same. Widening removes both arrows. |
| Fine and coarse pointers, LTR and RTL | Exercise long and short translations. Measure the hit rectangles. Use keyboard events to check focus, selection, paging and reopening. |
| Themes and accessibility display modes | Check active and focused states in light, dark and forced colors. Inspect the painted result where clipping or paint order matters. |
| Editing, refreshing and failure | Check input, focus, target and retry results through partial edits, row additions and removals, target changes and failed saves or reads. |
| Change values and language by keyboard | Change a switch, then a language or dependent dropdown, and verify the focused setting and scroll position. In a narrow pane with a long translation and large text, expand error details and verify that Retry stays visible and usable. |
| A setting or dialog in another Obsidian window | Resolve focus and label references in the document that owns the control. In the accessibility tree, a button with visible text includes that wording in its name after a redraw or language change. Explanations and disabled reasons remain available. |
| Delete a focused row at a page boundary | Continue from an enabled action on the logical neighbor, including when the last page disappears. If the section empties, focus its add or editing control when available. Preserve focus elsewhere if the user already left. |
| Dismiss feedback while a write is pending | Dismissing a notification closes that notification. Test any separately offered cancellation before and after the write commits. During a pending write, repeated activation must not submit twice. After failure, make clear whether it is safe to retry or the result already exists. |

Use a real browser for geometry, scrolling and painting. Use each plugin's disposable Vault procedure for host interaction and writes. Record browser touch emulation, Obsidian desktop and physical mobile results separately.
