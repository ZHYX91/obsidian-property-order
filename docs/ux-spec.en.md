---
source_language: zh-CN
translation_of: ux-spec.zh-CN.md
translation_status: synced
---

# Property Order — UX specification

This document mirrors the authoritative current interaction and presentation contract for Property Order.

## Property-value drag

- Clicking a pill does not start drag. Desktop mouse starts after movement threshold; desktop touch and pen start after long press.
- On mobile, long-press keeps Obsidian's native value menu and adds **Reorder** or **Reorder or move**. Selecting it visibly arms that pill; the next touch/pen movement on the same pill starts drag without another long press.
- Mobile arming is one-shot and expires after 15 seconds. Tapping elsewhere, Escape, timeout, unload, or invalidated DOM cancels it. Only an armed press suppresses default touch movement and a duplicate native menu.
- The preview retains source-pill dimensions and single-line ellipsis, then scales and clamps within its owner document's visual viewport with a visible margin.
- Scrollable hit ancestors and the originating pane scroll only while the pointer is inside their bounded edge region; each animation-frame step is capped so drag scrolling remains controlled.
- The drop indicator clearly represents the logical insertion slot, including wrapped rows and RTL inline direction. Same-property no-op, invalid cross-property, and cross-file targets never write.
- Drag start and target-state changes are announced through a polite live status. Reduced-motion preference disables preview and indicator transitions without changing geometry or cleanup.
- While the pointer is over a confirmed non-list property in the same pane, the drop indicator stays hidden and the row uses a warning outline with a `not-allowed` cursor. Releasing there shows one localized “target is not a list property” Notice; passing over and leaving shows none.
- A native list-type-mismatch field remains draggable from its value editor after threshold, but the plugin adds no persistent grip and never displaces or covers the host warning icon; the warning icon itself keeps its native cursor and is not a drag origin. Only fine pointers with hover use `grab` / `grabbing` while the input is unfocused; focused editing and coarse pointers keep native presentation.
- After a successful write, Properties is reconciled automatically with the current exact undo/redo state, including an undo or redo performed after the drag's initial reconciliation and delayed save window have finished. One shortcut must update both the editor buffer and visible Properties before another history shortcut is needed. Failed automatic recovery leaves a persistent Notice with a Refresh Properties button. Each click rereads the current valid state and refreshes only the captured pane UI without another value write or save request; only a failed retry recommends reopening the note, and the plugin never closes or reopens it automatically.
- After a successful drag, platform undo/redo shortcuts work without first clicking the note body. The plugin restores host-lost focus to the original Markdown editor only while the user has not deliberately focused another control, pane, or window. A no-op, cancellation, rejection, conflict, or ineffective write never forces a focus change.
- Finish, cancellation, conflict, pointer cancellation, Escape, blur, file change, and component removal clean previews, indicators, live-status nodes, cursor classes, timers, and temporary listeners.
- Content conflicts show a localized message and retain the newest file without automatic overwrite or retry.

## Property-key suggestions

- Enhancement reuses native menu nodes rather than rendering a look-alike replacement.
- Pinned items come first, normal items remain in the middle, bottom items come last, and hidden items do not occupy visible navigation order.
- **Recently used** applies strict MRU inside the normal section: confirmed names follow newest first and candidates absent from history use name order. Pinned, bottom, and hidden rule priority remains unchanged. History names no longer present in the menu are neither shown nor allocated a position.
- Recent order changes only after a property-name commit succeeds and Metadata Cache confirms that the name was added to the current note. Hover, keyboard navigation, cancellation, failure, and unconfirmed input never mutate MRU, so visual selection before menu closure is not itself a use.
- **Note count** sorts descending by the number of cached Markdown notes containing the property and falls back to name order for ties. It is not a click or selection count. Name and recent modes never traverse the Vault for ordering.
- Keyboard selection follows final visible order. Enter activates only the current visible item; an all-hidden menu submits nothing.
- After mouse hover, the next keyboard action re-establishes one selection in keyboard order.
- Escape, focus departure, menu closure, disabled enhancement, and plugin unload preserve or restore native close and input behavior.
- DOM mismatch, unreadable text, or failed host-selection synchronization leaves no partial hiding or reordering behind.

## Property-value suggestions

- Value suggestions remains independently opt-in. Unassigned properties follow one default among Native, Name, Selection frequency, Note count, and No suggestions.
- Exact property keys can be placed in one of six mutually exclusive groups: Name, Selection frequency, Note count, Native, No suggestions, or Custom candidates. Removing a key from a group makes it follow the default again.
- Each ordinary group renders configured keys as compact removable chips. One page-level display preference orders chips inside each group by property name or by most recently added to that group; it never changes YAML order or candidate order.
- The Add property control accepts direct typing and autocomplete from both Vault-discovered and already configured keys. A key already in the target group is marked unavailable for duplicate addition. A key in another group remains visible with its current group and, when selected, shows a confirmation before it moves.
- Custom candidates uses a property list at the left and the selected property's candidate editor at the right. Narrow layouts stack these regions instead of forcing a two-column viewport.
- The custom candidate editor keeps Pinned, Normal, and Bottom sections visible together. Values can be dragged between sections; keyboard-accessible buttons provide equivalent move and up/down actions. Pinned and Bottom also accept literal manually entered candidate values.
- A manually configured value is preset vocabulary. Moving it back to Normal removes fixed placement but keeps the preset; Remove preset removes only plugin configuration. Existing note values are never deleted.
- Normal candidates can use Native, Name, Selection frequency, or Note count ordering. Pinned and Bottom retain explicit order and are not re-sorted by the normal-section mode.
- A custom preset absent from Obsidian's native popup is still shown. When a native popup exists, plugin-owned preset items join that popup; when it does not, a plugin-owned fallback popup is anchored to the active property-value editor. Both paths filter against the current query and use the final visible keyboard order.
- Selecting a plugin-owned preset writes through the focused native property-value editor input path. It never writes frontmatter directly. The selection frequency counter advances only after Metadata Cache confirms the value was actually committed.
- No suggestions hides candidates but does not disable typing. Escape, focus departure, feature disable, window close, or plugin unload removes plugin-owned popup state and restores native state.
- Schema-5 rules that cannot be migrated without changing meaning remain read-only and active until the user explicitly confirms the grouped-model migration.

## Settings UI

- General, Value order, Key suggestions, and Value suggestions remain the same four logical settings groups across host versions. Control values, conditional visibility, immediate application, persistence failure, and Retry semantics do not vary by renderer.
- Obsidian 1.12.x uses the custom four-tab UI with `tablist`, `tab`, `tabpanel`, `aria-selected`, and roving `tabindex`. Left/Right and Home/End switch tabs; rerender, rotation, and viewport resize keep the active tab visible with sensible focus.
- On 1.12.x, tab minimum height is 34px for fine pointers and 44px for coarse pointers. The active tab combines an accent underline with a semibold label, and stable space separates the baseline from the content panel. Narrow layouts keep one horizontally scrollable row without vertical clipping.
- Every supported Obsidian version uses the same four imperative top tabs. Declarative settings remain disabled because they bypass this layout. Key-rule editors and the grouped value-suggestion controls retain suggestion, persistence, confirmation, and cleanup lifecycles; moving a key between value groups never creates a transient duplicate assignment.
- Key suggestions provides **Clear recent property history** in both render paths. It cancels pending confirmations, removes only the current Vault and device's in-memory timestamp-free MRU of at most 100 entries, and immediately refreshes open enhanced menus; it changes neither `data.json` nor notes. Success shows confirmation. A local-storage deletion failure shows that history is cleared for this session but may return after restart.
- Key suggestions provides a non-persisted rule-test field in both render paths. After a property name is entered, its result region lists the first matching hidden, pinned, and bottom rules, states the effective hidden > pinned > bottom priority, and announces updates with `aria-live="polite"`; clearing the input restores the prompt. Existing results refresh immediately after a rule edit, and testing never scans the Vault.
- At widths up to 480px, key-rule textareas and rule-test inputs fill their control area, value-group add controls stack vertically, and the Custom candidates key list/editor stack into one column while preserving the selected key.
- Persistence failure presents a Notice and `role="alert"` unsaved state. Successful Retry clears the state and performs any required suggestion refresh.

## Accessibility and accepted boundary

- Settings controls, tabs, and error states have accessible names and semantics.
- Key suggestions support keyboard navigation while retaining native host selection behavior.
- Property-value reorder currently requires pointer input. Missing direct keyboard reorder and drag live-region feedback are published limitations, not claimed capabilities.
- The Android release matrix covers native-menu preservation, the armed one-shot drag, property-name suggestions, rotation, narrow layout, and lifecycle. Physical-device haptics, pen differences, and vendor input stacks remain outside automated evidence.
