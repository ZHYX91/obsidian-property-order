# Changelog

All notable changes to Property Order are documented in this file. Release versions and dates
follow the repository's Git tags; entries summarize the corresponding commit history.

## [Unreleased]

### Added

- Add optional Obsidian property-type grouping for native property-name suggestions while keeping
  existing name, recent-use, or note-count sorting inside each group and preserving pinned,
  hidden, and bottom rule precedence.

### Changed

- Gate the 10,000-note suggestion-usage microbenchmark in CI with broad p95 regression budgets,
  deterministic one-read-per-note scan assertions, and richer cached frontmatter fixtures.

## [0.8.2] - 2026-10-01

### Fixed

- Keep custom property-value suggestion popups inside the visible window, opening above the
  editor when needed and following scrolling, resizing, and visual viewport changes.

### Changed

- Update development dependencies and pin patched transitive dependencies.
- Align contribution and testing documentation with enforced coverage thresholds and the
  release publisher's actual trust boundary.
- Measure high-cardinality property-value vocabulary and cache invalidation rescans alongside
  the property-name usage benchmark.

## [0.8.1] - 2026-09-27

### Fixed

- Kept Value suggestions controls bound to the current settings snapshot after each save, so
  consecutive default-behavior edits and changes after rule-card saves persist correctly.
- Preserved exact native property-value candidate identity, including meaningful leading and
  trailing whitespace, through ordering, node mapping, keyboard navigation and activation,
  candidate commit, and confirmed selection tracking without changing property-name normalization.
- Refreshed plugin-owned custom fallback candidates after metadata changes even when the current
  query has no matches, while preserving an exact selected value only within the same
  editor/property/query context, safely selecting a remaining candidate when needed, and keeping
  Escape or focus-loss closures inactive until a new input/focus session starts. Scope-owned
  Escape now closes that session before the native forwarded Escape can be consumed, while
  internal focus transfers within one value editor preserve the session and exact selection.

## [0.8.0] - 2026-09-27

### Added

- Added device-local confirmed selection-frequency ordering for property-value candidates.
- Added six mutually exclusive per-property value-suggestion behaviors: name, selection frequency,
  note count, native order, no suggestions, and custom candidates.
- Added a grouped Value suggestions UI with searchable/manual key addition, property chips,
  name/recently-added settings display order, confirmed cross-group moves, and a three-section
  custom candidate editor.
- Added custom preset vocabulary with pinned, normal, and bottom sections. Explicit preset values
  remain selectable even when no note currently contains them, including through a guarded
  plugin-owned fallback popup when no native value popup exists.

### Changed

- Organize value-suggestion rules into on-demand cards with behavior selectors, property chips,
  inline add controls, and an embedded custom editor. Local updates retain scroll and focus.
- Migrated value-suggestion settings to schema 6 with loss-aware legacy handling. Exact rules that
  can be translated without changing meaning are migrated; ambiguous legacy recent, wildcard,
  pinned, bottom, or hidden rules remain preserved until explicit migration confirmation.
- Custom preset selection continues through the active Obsidian property-value editor instead of
  writing frontmatter directly; selection frequency advances only after Metadata Cache confirms
  the commit.

### Fixed

- Stop preset clicks from reaching native popup delegates and committing a second value.
- Bound property-value keyboard handling to the active Obsidian scope and support contenteditable
  list inputs so preset commits cannot activate a different native suggestion.
- Removed custom fallback popups when their property editor is detached and report failures to persist selection-count clearing.

- Preserved Unicode edge characters when validating property pills, converting quoted scalars to
  flow lists, tracking recent values, and reading cached property-value vocabulary.
- Tightened property-value confirmation to exact values and refreshed reused suggestion popups
  when property focus changes.
- Kept drag auto-scroll inside the active pane geometry and removed deferred cursor-cleanup frames.
- Prevented plugin-generated preset commit key events from re-entering the suggestion keyboard
  bridge.

## [0.7.0] - 2026-09-25

### Added

- Added per-property `none` behavior for native property-value suggestions while retaining manual
  value input.
- Added RTL-aware drag targeting and wrapped-row indicators, bounded edge auto-scroll, reduced-motion
  drag presentation, and polite drag-status announcements.

### Changed

- Bounded suggestion wildcard matching and confirmed recent-value tracking so wildcard work stays
  limited and recent history advances only after Metadata Cache confirms the selected value.
- Limited property-value suggestion refreshes to related popup mutations and active usage-sorted
  popups instead of rescanning for unrelated DOM or metadata changes.

### Fixed

- Preserved YAML-significant spaces and tabs without stripping unrelated Unicode whitespace during
  supported frontmatter rewrites.
- Cleared candidate selection state when a per-property rule suppresses value suggestions and
  strengthened drag presentation cleanup on cancellation.

## [0.6.0] - 2026-09-12

### Added

- Added opt-in ordering and filtering for Obsidian's native property-value suggestions, including
  native, name, confirmed-recent-use, and note-count modes plus per-property pinned, bottom, hidden,
  and sort-override rules.

### Changed

- Renamed the visible Value drag and property-name suggestion tabs to Value order and Key
  suggestions, and added a separate Value suggestions tab to distinguish the three ordering scopes.

### Fixed

- Preserved native value suggestion order and keyboard selection across refreshes,
  refreshed note-count ordering after metadata changes, and kept context menus untouched.
- Shared native menu snapshots between key and value suggestions and restored nested popups once.
- Updated release-core to 3.0.2 for bounded GitHub read retries and verified draft resumption.

## [0.5.3] - 2026-09-05

### Fixed

- Kept touch events inside an explicitly armed value reorder gesture so mobile host navigation
  cannot take over the drag, while preserving ordinary scrolling and native value menus.

### Changed

- Migrated release handoff to the single Candidate Bundle v3 contract backed by release-core 2.0,
  with source-candidate and transport-candidate verification kept as separate claims.
- Replaced repository-specific Vault setup and acceptance commands with declarative fixtures and
  scenario declarations consumed by the shared materializer on desktop and Android emulators.
- Aligned CI bootstrap ordering with the repository-owned Node and npm runtime contract.

## [0.5.2] - 2026-08-28

### Added

- Added current Community Directory desktop screenshots and refreshed the settings image.

### Changed

- Clarified the privacy disclosure for Markdown note-count ordering and aligned public
  documentation with the current settings, release, and acceptance contracts.
- Defined the desktop-plus-Android-emulator matrix as the shared mobile release gate while keeping
  physical Android as optional enhanced evidence.
- Reduced routine dependency-update noise and strengthened version checks for untagged release
  candidates.

## [0.5.1] - 2026-08-25

### Fixed

- Treated only column-zero `---` or `...` lines as frontmatter boundaries, so indented YAML
  content cannot truncate duplicate-key validation or frontmatter reordering.
- Distinguished unchanged ownership aborts from exact editor changes whose persistence could not
  be scheduled.
- Preserved the cross-property drag preference while the parent value-drag feature is disabled.
- Excluded suggestions hidden by ancestors or computed display and visibility styles from keyboard
  navigation.
- Merged concurrent external settings changes before saving instead of overwriting unrelated keys.
- Reloaded externally changed settings and serialized storage access across plugin replacement.
- Scoped geometry fallback lookup to the originating pane.
- Restored tabbed settings navigation and made the active page clearly distinguishable across
  supported Obsidian settings surfaces.

### Changed

- Clarified that the automatic interface language follows Obsidian.
- Limited character-data observation to active property-name suggestion menus.
- Aligned release tooling, runtime pins, formatting checks, and bilingual release documentation.

## [0.5.0] - 2026-08-03

### Added

- Added read-only release preflight checks and release-rule diagnostics.
- Added exact GitHub artifact provenance checks and a production bundle-size budget.

### Fixed

- Aligned rendered wiki-link pills by host link target.
- Hardened release source identity, candidate handoff, Release-state parsing, and hosted-asset
  verification.

## [0.4.1] - 2026-07-31

### Fixed

- Published immutable Releases directly instead of relying on a mutable draft transition.

## [0.4.0] - 2026-07-31

### Added

- Added recent-use and note-count ordering for property-name suggestions.

## [0.3.1] - 2026-07-31

### Added

- Added declarative settings compatibility and guarded cross-property drag behavior.

### Fixed

- Made property-value drag commits atomic and synchronized delayed undo behavior.
- Hardened writeback verification, plugin lifecycle cleanup, and release safety.

## [0.3.0] - 2026-07-26

### Added

- Enabled cross-property drag by default.

### Changed

- Centralized suggestion visibility and expanded repository quality gates.

## [0.2.1] - 2026-07-26

### Changed

- Aligned DOM creation with Obsidian APIs and refreshed current documentation.

## [0.2.0] - 2026-07-26

### Added

- Added menu-armed mobile value drag.

### Fixed

- Preserved editor state during property drag.

### Changed

- Added the Obsidian lint gate and standardized release artifacts.

## [0.1.1] - 2026-07-23

### Fixed

- Addressed Obsidian community review findings.

## [0.1.0] - 2026-07-23

### Added

- Established the initial Property Order release baseline.

[Unreleased]: https://github.com/ZHYX91/obsidian-property-order/compare/0.8.2...HEAD
[0.8.2]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.8.2
[0.8.1]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.8.1
[0.8.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.8.0
[0.7.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.7.0
[0.6.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.6.0
[0.5.3]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.5.3
[0.5.2]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.5.2
[0.5.1]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.5.1
[0.5.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.5.0
[0.4.1]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.4.1
[0.4.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.4.0
[0.3.1]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.3.1
[0.3.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.3.0
[0.2.1]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.2.1
[0.2.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.2.0
[0.1.1]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.1.1
[0.1.0]: https://github.com/ZHYX91/obsidian-property-order/releases/tag/0.1.0
