# Property Order

[English](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-CN.md)

Property Order enhances Obsidian Properties with safe list-value reordering plus configurable native property-name and property-value suggestions.

## Demo

Move a value between supported top-level YAML list properties on desktop:

![Move a value between properties](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-cross-property-drag.gif)

Cross-property drag is enabled by default and can be disabled in the Value order settings.

## Features

- Drag to reorder values inside a top-level YAML list property.
- Follow logical insertion order in RTL and wrapped layouts, edge-scroll supported Properties regions, and announce pointer-drag state through a polite live status.
- Move values between supported properties in the same note, with an option to disable it.
- Treat empty or scalar YAML storage as a text list when Obsidian's native Properties UI assigns the list type, allowing safe moves in or out and normalizing every affected non-string item from its original token text.
- Preserve the current list format by default, or write every affected property as bracket or bullet lists. Same-property reorders and cross-property moves each commit through one verified editor transaction.
- Pin, move to the bottom, or hide native property-name suggestions.
- Sort property-name suggestions by mixed-language name, strict recent-use order, or the number of Markdown notes containing each property.
- Optionally manage property-value suggestions with one behavior per exact property key: name order, confirmed selection frequency, Markdown note count, native order, no suggestions, or custom candidates.
- Custom candidates use pinned, normal, and bottom sections. Explicit preset values remain available even when no note currently exposes them, while normal candidates can still use native, name, frequency, or note-count ordering.
- Advance property-name recent history and property-value selection counts only after Metadata Cache confirms the corresponding commit; hover, keyboard navigation, cancellation, and unconfirmed edits do not count.
- Keep keyboard navigation aligned with the final visible suggestion order.
- Fail closed for unsupported YAML and fail open when Obsidian's suggestion DOM is not recognized.

## Requirements and compatibility

- Obsidian 1.12.7 or later.
- Desktop supports direct dragging. Mobile uses an explicit action in Obsidian's native long-press menu before dragging.
- Property Order works only with top-level YAML properties that Obsidian identifies as text lists for value dragging. Value-suggestion enhancement normally reorders Obsidian candidates; custom behavior may additionally provide explicit preset candidates through the same property editor. Detailed boundaries are listed below.

## Installation

### Manual installation

Download `property-order-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-property-order/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive contains the `property-order/` directory with `main.js`, `manifest.json`, and `styles.css`. Reload Obsidian, then enable Property Order under Community plugins.

### Upgrade

Back up and preserve `Vault/.obsidian/plugins/property-order/data.json` when it exists. Replace only `main.js`, `manifest.json`, and `styles.css`; delete `data.json` only when you explicitly want to reset all plugin preferences.

## Usage

1. Enable Property Order under **Settings → Community plugins**.
2. Open a note with top-level YAML list properties in Obsidian Properties.
3. On desktop, drag a value directly. On mobile, long-press a value, choose **Reorder** (or **Reorder or move**), then drag that value.
4. Configure Key suggestions for property-name candidates and, if desired, enable Value suggestions to order Obsidian's existing property-value candidates with global defaults and per-property rules.

## Settings

Every supported Obsidian version uses the same accessible General, Value order, Key suggestions, and Value suggestions tabs. The active tab already names the current section, so content begins directly with its first setting instead of repeating that title.

- **General** controls the interface language and optional diagnostic notices. **Follow Obsidian** uses Obsidian's interface language.
- **Value order** controls list writeback format, cross-property moves, and related drag behavior. Temporarily disabling value drag preserves the separate cross-property preference for the next time value drag is enabled.
- **Key suggestions** configures pinned, bottom, hidden, name-sorted, recently used, and note-count-sorted native property-name suggestions. Recent order is strict MRU: pinned rules remain first, confirmed recent names follow in newest-first order, names absent from history fall back to name order, and bottom rules remain last. Note count means the number of cached Markdown notes containing the property, not interaction frequency.
- **Value suggestions** is opt-in. Unassigned properties follow one default behavior: native order, name order, confirmed selection frequency, Markdown note count, or no suggestions. Exact keys can be moved into one of six mutually exclusive groups: Name, Selection frequency, Note count, Native, No suggestions, or Custom candidates. Custom candidates expose pinned, normal, and bottom sections; pinned and bottom values may be typed explicitly, so a configured preset can remain selectable even when it has never appeared in the Vault.
- Property groups are shown as removable chips and can be ordered in settings by property name or most recently added. Adding a property accepts either a typed key or a Vault/configured-key suggestion. A key already in another group remains visible in the chooser and can be moved after confirmation.
- Recent property-name history contains at most 100 exact names and stays device-local. Property-value selection frequency is also device-local and increments only after a confirmed candidate commit. Both are separate from `data.json` and are not synced. Note-count ordering scans cached frontmatter lazily only when needed and reuses invalidatable caches.

## Limitations

- Mobile reorder is deliberately armed from Obsidian's native long-press menu, so Edit, Remove from list, and Copy remain available. The armed action applies to one value and expires automatically.
- Only top-level YAML properties that Obsidian identifies as text lists are supported for value dragging. Normal lists use native pills; guarded empty or scalar mismatch rows may be sources or targets, while an aligned, unambiguous mixed mismatch row may only receive an appended value.
- Object lists, nested lists, multiline flow sequences, source-mode line dragging, and cross-file moves are not supported.
- Custom preset candidates are limited to the Properties value editor. When no native value popup exists, Property Order can render a plugin-owned fallback popup for configured custom candidates; if the property editor cannot be identified safely, it fails open and leaves manual input unchanged.
- Converting bullet lists to bracket lists may discard item comments and blank lines that bracket syntax cannot represent.
- Direct keyboard value reordering is not provided. Pointer dragging provides polite screen-reader status announcements for drag start and target changes.

## Privacy and security

Property Order reads and updates the current note through Obsidian's editor and Vault APIs. It does not require an account, upload note content, or call a remote service. Unsupported YAML is rejected before writeback, and supported drag changes are committed through one verified editor transaction. When note-count ordering is selected for property-name or property-value suggestions, the plugin enumerates Markdown files and reads cached frontmatter metadata to calculate counts; it does not read every note body. Property-name MRU and confirmed property-value selection counts are stored only in Obsidian's per-Vault local storage on the current device, separately from `data.json`, and can be cleared from settings.

## Development

Use Node.js 24.19.0 and npm 11.17.0. Install the exact dependency graph from the frozen lockfile,
then run the complete repository gate:

```bash
npm ci
npm run check
```

### Documentation

- [Product requirements](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/product-requirements.en.md)
- [UX specification](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/ux-spec.en.md)
- [Architecture](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/architecture.en.md)
- [Testing strategy](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/testing-strategy.en.md)
- [Changelog](https://github.com/ZHYX91/obsidian-property-order/blob/main/CHANGELOG.md)
- [Contributing guide](https://github.com/ZHYX91/obsidian-property-order/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/ZHYX91/obsidian-property-order/blob/main/SECURITY.md)

## Support

- Use [General](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/general) for workflow ideas and general feedback.
- Use [Q&A](https://github.com/ZHYX91/obsidian-property-order/discussions/categories/q-a) for usage and configuration questions.
- Use the structured [GitHub issue forms](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) for reproducible bugs and concrete feature requests.
- Report vulnerabilities privately through the repository's [security policy](https://github.com/ZHYX91/obsidian-property-order/security/policy).

Remove private Vault paths, note content, YAML values, and credentials before posting publicly.

## License

[MIT](https://github.com/ZHYX91/obsidian-property-order/blob/main/LICENSE) © ZhengYX
