# Property Order Testing Strategy

This document mirrors the authoritative current automated gates, real-host matrix, release contract, and evidence boundary for Property Order 0.1.0.

## Automated gate

Run `npm run check` before handoff. It performs, in order:

1. strict TypeScript checking;
2. the complete current Vitest suite;
3. the production bundle;
4. byte-level release-asset verification against source, manifest, and version mapping.

Tests are organized under `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, `tests/app/`, and `tests/scripts/`. Stable contracts cover:

- flow/block/empty lists, BOM, LF/CRLF/CR, quoting, comments, blank lines, YAML core scalar types, and unsupported-structure fail closed;
- desktop mouse/touch/pen state, mobile runtime disablement, drop geometry, no-op, cancellation, content conflict, pane/file identity, and stale-async rejection;
- Properties and suggestion DOM adapters, visible ordering, all-hidden behavior, keyboard navigation, focus departure, and fail open;
- settings migration, immediate application, persistence failure, Retry, tab semantics, and narrow-layout CSS;
- release tags, three loose assets, the manual-install archive, and idempotent Release updates.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Real acceptance uses only an isolated Vault. Fixture commands are:

```powershell
npm run acceptance:fixtures -- --vault <isolated-vault> --force
npm run acceptance:conflict -- --vault <isolated-vault> --file <fixture> --delay-ms 55
```

Scripts validate the Obsidian Vault, resolve real paths, and constrain writes. Each writeback scenario starts from known fixtures and verifies final YAML and newline bytes on disk.

## Real-host release matrix

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;
- same-property forward/backward/first/last/no-op and cross-property enabled/disabled behavior;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- pinned/hidden/bottom, name/usage, menu reuse, all-hidden, hover-to-keyboard, arrows/Home/End/PageUp/PageDown/Enter/Escape, and focus departure;
- immediate settings, three-tab keyboard semantics, light/dark themes, and narrow layout.

The Android emulator verifies:

- property-value gestures remain native, including the Edit, Remove from list, and Copy long-press menu, with no drag preview or writeback;
- touch suggestion selection, roughly 394px settings layout, rotation, and active-tab reveal;
- background/foreground recovery, plugin disable/re-enable, and absence of crash or ANR.

## Current evidence boundary

- Automated gates cover pure rules, injectable failures, and release contracts.
- The current desktop artifact was exercised in an isolated Windows 11 / Obsidian 1.12.7 Vault. Evidence includes block- and flow-style same-property writeback verified on disk, pinned/hidden/bottom suggestion ordering, keyboard selection and cancellation, and all three settings tabs.
- The current mobile artifact was exercised in an independent Android 15 / API 35 emulator Vault. With the plugin enabled, startup completes without an eager whole-document suggestion scan; newly mounted suggestion menus are still observed and sorted, the narrow settings UI works in portrait and landscape, and the run produced no plugin error, crash, or ANR.
- The final mobile artifact preserves Obsidian's native Edit, Copy, and Remove from list menu. A stationary long press and a long-press movement produced no plugin preview, indicator, drag cursor, or writeback; the fixture SHA-256 remained unchanged.
- Mobile property-value drag is an explicit non-goal for 0.1.0 rather than an unverified release item.
- No physical Android evidence exists, so vendor input stacks, real haptics, physical pen, system font scaling, and large-Vault performance are not claimed.
- Mobile property-value drag, keyboard property-value reorder, and screen-reader drag announcements are product non-goals, not 0.1.0 release debt.
- CR-only byte preservation is automated; Obsidian 1.12.7 exposes no matching Properties UI, so a nonexistent host path is not required.

## CI and Release

CI runs `npm ci` and `npm run check` on Node 20 and uploads `dist/property-order/`. The release workflow accepts only an exact `x.y.z` tag matching `manifest.json`, without a `v` prefix, reruns the complete gate, and publishes:

- `main.js`;
- `manifest.json`;
- `styles.css`;
- `property-order-<version>.zip`, containing only one `property-order/` directory with those files.

Before the first version tag, the worktree is clean, the real-host matrix matches the current product scope, and CI is green. After publication, download all four assets and verify version, archive layout, and hashes.
