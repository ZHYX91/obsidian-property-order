---
source_language: zh-CN
translation_of: testing-strategy.zh-CN.md
translation_status: synced
---

# Property Order Testing Strategy

This document mirrors the authoritative current automated gates, real-host matrix, release contract, and verification boundary for Property Order.

## Automated gate

Run `npm run check` before handoff. It performs, in order:

1. the official `eslint-plugin-obsidianmd` recommended rule set, with documented compatibility exceptions, against plugin entry and source files; all enabled warnings are treated as failures;
2. strict TypeScript checking;
3. the complete current Vitest suite;
4. the production bundle;
5. byte-level release-asset verification against source, manifest, and version mapping.

The lint gate uses current Obsidian API typings while `manifest.json` remains the compatibility contract. Native DOM creation is retained only where the target `ownerDocument` is required for popout support. Declarative setting definitions remain disabled until the complete custom three-tab UI can be represented without changing behavior for the declared pre-1.13 minimum.

Tests are organized under `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, `tests/app/`, and `tests/scripts/`. Stable contracts cover:

- flow/block/empty lists, BOM, LF/CRLF/CR, quoting, comments, blank lines, YAML core scalar types, and unsupported-structure fail closed;
- desktop mouse/touch/pen state, mobile native-menu extension and one-shot arming, drop geometry, no-op, cancellation, content conflict, pane/file/editor identity, unsaved editor text, and one editor transaction;
- Properties and suggestion DOM adapters, visible ordering, all-hidden behavior, keyboard navigation, focus departure, usage-cache invalidation without a Vault scan when no menu is open, and fail open;
- settings migration, immediate application, persistence failure, Retry, tab semantics, and narrow-layout CSS;
- release tags, three loose assets, the manual-install archive, and idempotent Release updates.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Real acceptance uses only an isolated Vault. Fixture commands are:

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --delay-ms 55
```

Scripts validate the Obsidian Vault, resolve real paths, and constrain writes. LF, CRLF, and CR fixtures verify the generator and pure rewrite contract byte-for-byte. Real-editor scenarios verify final YAML, preserved body text, and undo/redo on disk, while separately recording the host's newline serialization instead of attributing Obsidian's native CRLF/CR-to-LF save behavior to the plugin.

## Real-host release matrix

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;
- same-property forward/backward/first/last/no-op and cross-property enabled/disabled behavior;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- one `Ctrl+Z` undo and one redo for each successful drag, without overwriting unsaved body edits;
- pinned/hidden/bottom, name/usage, menu reuse, all-hidden, hover-to-keyboard, arrows/Home/End/PageUp/PageDown/Enter/Escape, and focus departure;
- immediate settings, three-tab keyboard semantics, light/dark themes, and narrow layout.

The Android emulator verifies:

- the native Edit, Remove from list, and Copy actions remain present alongside Reorder or Reorder or move;
- selecting the added action arms only that pill, the next same-pill touch drag can reorder or move it, and outside tap, Escape, timeout, backgrounding, or plugin disable cancels cleanly;
- touch suggestion selection, roughly 394px settings layout, rotation, and active-tab reveal;
- background/foreground recovery, plugin disable/re-enable, and absence of crash or ANR.

## Verification boundary

- Automated gates cover pure rules, injectable failures, and release contracts.
- Desktop acceptance uses an isolated Windows 11 / Obsidian 1.12.7 Vault and covers block- and flow-style writeback on disk, pinned/hidden/bottom suggestion ordering, keyboard selection and cancellation, and all three settings tabs.
- New CRLF fixtures must remain CRLF when merely opened. Both a Property Order editor transaction and an ordinary manual body edit may then serialize the note as LF under Obsidian 1.12.7; acceptance attributes that behavior to the host and verifies logical text plus one-step undo instead of adding a non-undoable second Vault write.
- Android acceptance uses an independent Android 15 / API 35 emulator Vault, verifies deployed production files by SHA-256, preserves Obsidian's Edit, Copy, and Remove from list actions beside Reorder or move, exercises same-property reorder and cross-property move on disk, and verifies cancellation plus background/foreground recovery without plugin error, crash, or ANR.
- Automated tests cover the 15-second timeout, Escape, unsupported-menu fail open, and cleanup paths that routine host acceptance does not inject.
- Physical-device input stacks, haptics, pens, system font scaling, and large-Vault behavior require separate physical Android evidence before they may be claimed.
- Keyboard property-value reorder and screen-reader drag announcements remain explicit product non-goals.
- The language contract proves that Auto uses Obsidian's configured interface language through the public `getLanguage()` API. The minimum supported Obsidian version is 1.12.7, and `versions.json` remains the compatibility contract for published versions.
- CR-only byte preservation is automated; Obsidian 1.12.7 exposes no matching Properties UI, so a nonexistent host path is not required.

## CI and Release

CI runs `npm ci` and `npm run check` on Node 20 and uploads top-level `dist/main.js`, `dist/manifest.json`, and `dist/styles.css`. The release workflow accepts only an exact `x.y.z` tag matching `manifest.json`, without a `v` prefix, reruns the complete gate, and publishes:

- `main.js`;
- `manifest.json`;
- `styles.css`;
- `property-order-<version>.zip`, containing only one `property-order/` directory with those files.

Before any version tag, the worktree is clean, the real-host matrix matches the current product scope, and CI is green. After publication, download all four assets and verify version, archive layout, and hashes.
