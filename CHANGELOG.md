# Changelog

All notable changes to Property Order are documented in this file. Release versions and dates
follow the repository's Git tags; entries summarize the corresponding commit history.

## [Unreleased]

## [0.5.3] - 2026-09-01

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

[Unreleased]: https://github.com/ZHYX91/obsidian-property-order/compare/0.5.3...HEAD
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
