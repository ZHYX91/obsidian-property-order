---
source_language: zh-CN
translation_of: testing-strategy.zh-CN.md
translation_status: synced
---

# Property Order — Testing strategy

This document mirrors the authoritative current automated gates, real-host matrix, release contract, and verification boundary for Property Order.

## Automated gate

Run `npm run check` before delivery. It performs, in order:

1. the exact current Node.js/npm contract against `.node-version`, `engines.node`, and `packageManager`;
2. the official `eslint-plugin-obsidianmd` recommended rule set, with documented compatibility exceptions, against plugin entry and source files, including an enforced `src/core/` import boundary that rejects Obsidian runtime and upper-layer modules; environment-appropriate static rules also cover tests, Node scripts, and tool configuration, and all enabled warnings are treated as failures;
3. a deterministic UTF-8/LF format contract for source, documentation, and configuration, with no BOM, NUL, trailing whitespace, or missing final newline;
4. README navigation plus frontmatter, heading hierarchy, critical-token, table-shape, and relative-link contracts for every stable Chinese/English document pair;
5. strict TypeScript checking;
6. the complete current Vitest suite with V8 coverage;
7. the production bundle;
8. reproducible bundle verification plus static-asset, manifest, lockfile, and version-contract checks.

The lint gate uses current Obsidian API typings while `manifest.json` remains the compatibility contract. Native DOM creation is retained only where the target `ownerDocument` is required for popout support. Every supported Obsidian version uses the imperative four-tab settings UI. Automated contracts require declarative definitions to remain empty, preserve the custom rule editors, and avoid Vault enumeration while the settings surface is built.

Tests are organized under `tests/core/`, `tests/features/`, `tests/obsidian/`, `tests/shared/`, `tests/app/`, and `tests/scripts/`. Automated regression coverage is grouped by area:

- **Frontmatter and writeback:** flow, block, and empty lists; scalar source/target handling under a host text-list type; conversion of number, boolean, and null from their original tokens; duplicate preservation and duplicate-key rejection; BOM, LF/CRLF/CR, quoting, comments, blank lines, and safe rejection of unsupported structures.
- **Drag input and target resolution:** desktop mouse/touch/pen, the mobile native-menu arm, supported lists, type-mismatch lists, confirmed non-list targets, and unknown targets; no Notice while merely passing over a rejected target and one Notice on release; no-op, cancellation, conflicts, pane/file/editor/DOM identity, and unsaved editor text.
- **Commit, persistence, and recovery:** one atomic editor transaction, the exact `"set"` origin needed for 1.12.x, ownership changes before and after commit, partial/diverged outcomes, suppression of only the drag's trailing click, identity checks after `setViewData()`, `requestSave()` only after exact verification, and a separate persistence-scheduling failure result.
- **Properties reconciliation:** normal and type-mismatch list UI verification; guarded `metadataEditor.synchronize()` success, absence, exceptions, foreign ownership, and post-sync text changes; refresh-action invalidation; and independent recovery actions across panes. Recovery never uses native property setters, direct Vault writes, or manual host-pill mutation.
- **Undo and focus:** editor focus after an exact commit, guarded repair after host reconstruction loses focus, no focus reclaim after deliberate user transfer, no forced focus for no-op/rejection/conflict/ineffective transactions, and undo access even when persistence scheduling fails after the buffer was committed.
- **Property-name suggestions:** Properties/suggestion DOM adapters, pane-scoped geometry fallback, visibility through hidden ancestors and computed styles, keyboard navigation, all-hidden behavior, menu reuse, pinned/hidden/bottom precedence, property-type group order, display-only group labels, strict MRU, note-count ties, restoration after disable/unload, and native behavior on DOM mismatch.
- **Recent-use state:** click and keyboard/input commit intent, Metadata Cache confirmation, no record for hover/navigation/cancellation/failure, file and document identity, timeout/deletion/unload cleanup; exact case, promotion without duplicates, 100-entry cap, timestamp-free storage, malformed/read-failure fallback, write-failure session behavior, Vault/device isolation, and clearing. Name and recent modes never traverse the Vault just to sort.
- **Property-value suggestions:** one exact-key behavior, default fallback, cross-group moves, selection frequency versus note count, Custom pinned/normal/bottom sections, exact preset identity, preset removal without note mutation, native-popup injection, fallback popup when no native popup exists, final visible keyboard order, manual input under `none`, lifecycle cleanup, and legacy migration.
- **Settings:** schema migrations, invalid-value normalization, immediate application, persistence failure and Retry, three-way merge on external settings changes, cross-instance storage ordering, rejection of new saves after unload, preserved drag preferences, rule-card and chooser state, focus/scroll preservation, clear actions, and narrow-layout behavior.
- **Release tooling:** exact Node.js/npm and lockfile-root contracts, publication-job permission isolation, default-branch and tag identity, read-only Candidate Bundle transport and SHA-256, ZIP validation, exact-source checkout, no dependency installation or rebuild in the write-capable job, release serialization, Release version/notes preflight, four published asset bytes and provenance, HTTP retry classification, and idempotent publication.

`npm run check` runs the complete Vitest suite through `npm run test:coverage`. V8 coverage explicitly includes `main.ts` and `src/**/*.ts`, so runtime source that no test imports still appears at 0% in the inventory. The unified gate enforces minimum global coverage of 86% statements, 83% branches, 88% functions, and 86% lines through `vitest.config.mts`. The report exposes omitted files and guides targeted tests; passing these thresholds does not replace real-host evidence.

`npm run bench:usage` and `npm run bench:usage:large` are deterministic Metadata Cache microbenchmarks kept outside `npm run check`. They construct 10,000 and 50,000 cached notes and run 25 invalidation rescans through the real cached usage paths. Output includes p50, p95, max, cache-hit latency, scan count, and Metadata Cache read count.

The 10,000-note quick benchmark runs in CI and release verification with a 75 ms p95 ceiling; the optional 50,000-note benchmark uses 350 ms. Ordinary Vitest coverage also fixes the scan budget: each uncached snapshot may enumerate Markdown files once and read each note's Metadata Cache once, while cache hits must add no reads.

These numbers are regression tripwires for repeated scans or superlinear work, not product latency promises. They do not represent real Obsidian main-thread, mobile-device, or memory behavior. Performance evidence should record the operating system, CPU, Node.js, npm, and raw output; incremental indexing should be reconsidered only when real large-Vault evidence or repeated regressions clearly exceed the budget.

Injectable failure paths rely primarily on automated evidence: rejected settings persistence, host-DOM mismatch, selection-sync failure, Escape/blur, component removal, external conflict, and asynchronous reordering. Real hosts verify actual Obsidian DOM, input, visuals, and disk results without duplicating failures that cannot be injected reliably.

## Isolated Vault

Use a disposable Vault with the exact packaged candidate. The repository provides `acceptance/fixtures/Property Order.md`, `Key Suggestions.md`, `Key Type Vocabulary.md`, and `acceptance/product-scenarios.json`; verify their candidate-bound hashes, install the three candidate assets, and enable only Property Order. An ordinary or production Vault is never a valid target.

The repository does not provide a CLI that installs fixtures, resets a Vault, or injects conflicts, which reduces the risk of touching a real Vault by mistake. When a write-conflict scenario is needed, the acceptance controller operates only on an explicitly selected disposable fixture: it records the starting identity, begins the product action, performs the specified external edit, and records the before/after bytes plus the visible rejection.

Automated unit tests remain the main evidence for race boundaries; real-host testing confirms Obsidian's actual DOM, interaction, persistence, undo/redo, and safe refusal behavior.

## Optional host regression

Select the relevant scenarios for the change. Missing, skipped, or failed host checks do not block explicitly authorized publication.

Desktop Obsidian verifies:

- enable, disable, reload, and full restart;

- same-property forward, backward, first, last, and no-op behavior, plus cross-property moves with the feature enabled and disabled;
- `[]`, empty values, and supported scalars when Obsidian clearly presents them as lists; type-mismatch fields participate only when source or target values map unambiguously to the current YAML, while stale, unreadable, or ambiguous sources are rejected;
- successful operations under `preserve`, `flow`, and `block`; no-op never reformats, and a host-confirmed non-list target never accepts the move;
- multiple leaves, cross-file refusal, real content conflict, and `preserve`/`flow`/`block` writeback;
- a non-list target shows a warning outline and `not-allowed` cursor without an insertion line in both themes, leaving it shows no Notice, and releasing on it shows exactly one Notice without writeback;

- a list-type-mismatch row has no persistent grip covering its warning, and the warning icon itself does not advertise a drag cursor; after a same-property drag, normal Properties immediately shows the committed order and can start another drag;
- when automatic reconstruction is deliberately blocked, Refresh Properties affects only the captured pane. Recovery Notices in different panes remain independent, disappear on success, and recommend reopening only after refresh failure. The action follows the valid undo/redo state at click time and creates no second transaction, save request, or YAML change;

- one immediate `Ctrl+Z` undo and one redo after every successful drag, without first clicking the note body; all affected properties restore together and Properties, editor, and disk agree;
- repeat undo/redo after delayed persistence has settled, and verify that the first history shortcut already changed visible Properties before sending the next one. Another drag immediately after undo must work, and deliberate focus on another control, pane, or window must not be reclaimed;
- wait at least three seconds after writeback before checking disk YAML and SHA-256 so host-delayed persistence is not mistaken for failure;
- the wiki-link contract fixture records `data-href`, `.internal-link` placement, `.multi-select-pill-content`, raw `textContent` code points, and drag eligibility for exact aliases, edge whitespace, and NFC/NFD targets and aliases before any alias normalization rule changes;

- property-name suggestions with pinned/hidden/bottom, name/recent/note count, menu reuse, all-hidden behavior, hover-to-keyboard transition, arrows/Home/End/PageUp/PageDown/Enter/Escape, and focus departure;
- with type grouping enabled, both minimum and current desktop hosts verify Text, List, Number, Checkbox, Date, Date & time, Tags, and Automatic / unspecified; `key_automatic` must land in the unspecified group; headings are display-only navigation skips; sorting stays within groups; disable/unload restores native suggestions exactly;
- recent-use acceptance separately covers mouse click, Enter, and typed successful commits. MRU advances only after Metadata Cache confirmation; hover, navigation, cancellation, and failure do not record; unrecorded items use name order; usage equals the number of Markdown notes containing the property;
- recent history retains current-Vault/device order through reload and full restart while another Vault does not inherit it; clearing immediately restores name fallback and changes neither `data.json` nor notes. Immediate settings also cover the four-tab surface on the minimum and current supported hosts, light/dark themes, and narrow layout.

- Value suggestions acceptance covers exact-key moves between mutually exclusive groups, manual and discovered-key addition, default fallback, Selection frequency versus Note count, and Custom pinned/normal/bottom sections;
- include at least one preset absent from every fixture note, and verify native-popup injection, the fallback popup when no native popup exists, mouse/Enter/Tab selection, Metadata Cache-confirmed frequency, Escape/focus/disable/reload cleanup, and explicit legacy-migration confirmation. The `none` case must still allow manual typing and must not let unmodified Enter/Tab commit a suppressed candidate.

The Android emulator verifies:

- the native Edit, Remove from list, and Copy actions remain present alongside Reorder or Reorder or move;
- selecting the added action arms only that pill, the next same-pill touch drag can reorder or move it, and outside tap, Escape, timeout, backgrounding, or plugin disable cancels cleanly;
- a non-list target shows rejection feedback, releasing on it shows one Notice without writeback, and leaving it clears all feedback;
- the wiki-link contract fixture captures the same raw target, text, structure, and drag evidence as desktop before platform-specific normalization is inferred;
- touch suggestion selection and its post-commit recent update, type-grouped key candidates whose visual labels are never touch targets, native restoration after disabling enhancement, recent-history clearing, roughly 394px settings layout, rotation, and active-tab reveal;
- background/foreground recovery, plugin disable/re-enable, and absence of crash or ANR.

## Verification boundary

- Automated gates cover pure rules, injectable failures, and release contracts.
- Every candidate-build acceptance record separates commit/version identity, SHA-256 values for the three deployed artifacts and install archive, automated-gate results, per-host/device acceptance evidence, and still-missing visual, input, or platform evidence. No layer is inferred from another.

- Desktop acceptance uses isolated Windows 11 Vaults with Obsidian 1.12.7 and the current supported 1.13.x release;
- both hosts verify same- and cross-property one-step undo/redo, another drag immediately after undo, no focus reclaim after deliberate user transfer, editor/visible-Properties agreement after one host turn, disk-YAML agreement after at least three seconds, scalar type-mismatch drag behavior, non-list rejection, `preserve`/`flow`/`block` output, and the wiki-link host contract;
- both hosts also verify strict-MRU confirmation, restart persistence, per-Vault isolation, the timestamp-free 100-entry boundary and clearing, property-type grouped key suggestions, exact native restoration after disable/unload, the four top tabs, custom rule editors, conditional controls, language rerendering, persistence, and Retry.
- New CRLF fixtures must remain CRLF when merely opened. Both a Property Order editor transaction and an ordinary manual body edit may then serialize the note as LF under Obsidian 1.12.7; acceptance attributes that behavior to the host and verifies logical text plus one-step undo instead of adding a non-undoable second Vault write.
- Android acceptance uses an independent Android 15 / API 35 emulator Vault, verifies deployed production files by SHA-256, preserves Obsidian's Edit, Copy, and Remove from list actions beside Reorder or move, exercises same-property reorder and cross-property move on disk, verifies recent update and clearing after a touch property-name commit, and checks cancellation plus background/foreground recovery without plugin error, crash, or ANR.
- This desktop-plus-emulator matrix defines full host-regression coverage; it is not a publication gate. Android physical devices and iOS are out of scope.
- Automated tests cover the 15-second drag timeout, recent-confirmation timeout, local-storage read/write failure, Escape, unsupported-menu fail open, RTL wrapped targeting, bounded edge scrolling, drag-status cleanup, and cleanup paths that routine host acceptance does not inject.
- Desktop host acceptance for a Value suggestions `none` rule verifies that manual typing remains available and unmodified Enter/Tab does not commit a suppressed native candidate.
- Physical-device input stacks, haptics, pens, and vendor-specific behavior are not acceptance claims made by this project.
- Keyboard property-value reorder remains an explicit product non-goal. Automated DOM coverage verifies polite drag-status creation and cleanup; real assistive-technology announcement quality is claimed only when host acceptance records it.
- The language contract proves that Auto uses Obsidian's configured interface language through the public `getLanguage()` API. The minimum supported Obsidian version is 1.12.7, and `versions.json` remains the compatibility contract for published versions.
- CR-only byte preservation is automated; Obsidian 1.12.7 exposes no matching Properties UI, so a nonexistent host path is not required.

## CI and Release

CI and the release workflow both use Node.js 24.19.0 from `.node-version` and require npm 11.17.0 through `packageManager`. They verify the exact runtime before `npm ci`, then run `npm run check`.

Its release-asset gate independently reproduces the bundle and requires production `main.js` to remain at or below 320,000 B; this is a project regression budget, not an Obsidian platform limit. CI uploads top-level `dist/main.js`, `dist/manifest.json`, and `dist/styles.css`.

The release workflow accepts only an exact `x.y.z` version matching `manifest.json`, without a `v` prefix, reruns the complete gate, and publishes:

- `main.js`;
- `manifest.json`;
- `styles.css`;
- `property-order-<version>.zip`, containing only one `property-order/` directory with those files.

The install archive fixes entry order, timestamps, permissions, and irrelevant metadata so identical inputs produce identical bytes. Tests execute the same exactly locked release-core ZIP and candidate logic used by the repository.

They cover required and optional styles, missing/extra/non-regular entries, tampered bytes, wrong checksums, path escapes, and a historical same-version tag. Ordinary `npm run check` uses non-tag-aware validation; only `npm run release:check` requires a clean commit and the absent-or-exact tag gate.

The repository-local release-core 3.1.1 runtime and thin adapter own one deterministic Candidate Bundle and a generated standalone workflow. An authorized stable version tag push or manual publish dispatch on that tag uses the same pipeline; manual verify mode remains read-only.

CI installs locked dependencies, runs release:check once, source-verifies the Bundle, and pins its artifact ID/digest. The write-capable publication job checks out that exact tagged source without persisted credentials and runs its locked repository release adapter, without installing dependencies or rebuilding.

The tagged release tooling is trusted executable code; Candidate Bundle verification does not isolate the publisher from malicious changes to that tooling. Publication verifies the exact event, source, tag, transported bytes, and SLSA build provenance, then verifies draft downloads before immutable publication and hosted downloads afterward.

Product acceptance is optional and reported separately. An independent clone needs no external orchestration.

After publication, GitHub is queried again for an immutable stable Release. Exact four-asset inventory, metadata digests, downloaded bytes, ZIP internal/external equivalence, remote tag, and per-asset provenance must all match. A same-tag no-op is accepted only on complete identity; every conflict requires a higher version. Tag rulesets and immutable Releases remain maintainer-recorded prerequisites outside the workflow, and automated gates do not change administrator settings.

The Actions artifact step output accepts only a raw 64-character lowercase hexadecimal SHA-256. The REST record may expose the same value raw or with the canonical `sha256:` prefix. Downloaded bytes are rehashed against the pinned output; a wrong prefix, length, or byte stream fails closed.

Workflow contract tests compare the complete YAML with the locked generator and verify tag/manual triggers, the single mode input, read-only verification, publication permissions, pinned Actions, artifact transport, build provenance, and hosted download verification.
