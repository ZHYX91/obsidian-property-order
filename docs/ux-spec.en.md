---
source_language: zh-CN
translation_of: ux-spec.zh-CN.md
translation_status: synced
---

# Property Order UX Specification

This document mirrors the authoritative current interaction and presentation contract for Property Order.

## Property-value drag

- Clicking a pill does not start drag. Desktop mouse starts after movement threshold; desktop touch and pen start after long press.
- On mobile, long-press keeps Obsidian's native value menu and adds **Reorder** or **Reorder or move**. Selecting it visibly arms that pill; the next touch/pen movement on the same pill starts drag without another long press.
- Mobile arming is one-shot and expires after 15 seconds. Tapping elsewhere, Escape, timeout, unload, or invalidated DOM cancels it. Only an armed press suppresses default touch movement and a duplicate native menu.
- The preview retains source-pill dimensions and single-line ellipsis, then scales and clamps within its owner document's visual viewport with a visible margin.
- The drop indicator clearly represents the insertion slot. Same-property no-op, invalid cross-property, and cross-file targets never write.
- Finish, cancellation, conflict, pointer cancellation, Escape, blur, file change, and component removal clean previews, indicators, cursor classes, timers, and temporary listeners.
- Content conflicts show a localized message and retain the newest file without automatic overwrite or retry.

## Property-key suggestions

- Enhancement reuses native menu nodes rather than rendering a look-alike replacement.
- Pinned items come first, normal items remain in the middle, bottom items come last, and hidden items do not occupy visible navigation order.
- Keyboard selection follows final visible order. Enter activates only the current visible item; an all-hidden menu submits nothing.
- After mouse hover, the next keyboard action re-establishes one selection in keyboard order.
- Escape, focus departure, menu closure, disabled enhancement, and plugin unload preserve or restore native close and input behavior.
- DOM mismatch, unreadable text, or failed host-selection synchronization leaves no partial hiding or reordering behind.

## Settings UI

- General, Value drag, and Key order use `tablist`, `tab`, `tabpanel`, `aria-selected`, and roving `tabindex`.
- Left/Right and Home/End switch tabs. Rerender, rotation, and viewport resize keep the active tab visible with sensible focus.
- Tab height is 34px for fine pointers and 44px for coarse pointers. Narrow layouts keep one horizontally scrollable row without vertical clipping.
- At widths up to 480px, rule textareas and existing-property inputs stack and fill the card.
- Persistence failure presents a Notice and `role="alert"` unsaved state. Successful Retry clears the state and performs any required suggestion refresh.

## Accessibility and accepted boundary

- Settings controls, tabs, and error states have accessible names and semantics.
- Key suggestions support keyboard navigation while retaining native host selection behavior.
- Property-value reorder currently requires pointer input. Missing direct keyboard reorder and drag live-region feedback are published limitations, not claimed capabilities.
- The Android release matrix covers native-menu preservation, the armed one-shot drag, property-name suggestions, rotation, narrow layout, and lifecycle. Physical-device haptics, pen differences, and vendor input stacks remain outside automated evidence.
