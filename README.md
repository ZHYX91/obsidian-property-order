# Property Order

[English](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-CN.md)

Property Order enhances Obsidian Properties with safe list-value reordering and configurable native property-name suggestions.

## Demo

Move a value between supported top-level YAML list properties on desktop:

![Move a value between properties](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-cross-property-drag.gif)

Cross-property drag is enabled by default and can be disabled in the Value drag settings.

## Features

- Drag to reorder values inside a top-level YAML list property.
- Move values between supported properties in the same note, with an option to disable it.
- Treat empty or scalar YAML storage as a text list when Obsidian's native Properties UI assigns the list type, allowing safe moves in or out and normalizing every affected non-string item from its original token text.
- Preserve the current list format by default, or write every affected property as bracket or bullet lists. Same-property reorders and cross-property moves each commit through one verified editor transaction.
- Pin, move to the bottom, or hide native property-name suggestions.
- Sort suggestions by mixed-language name, strict recent-use order, or the number of Markdown notes containing each property.
- Advance recent history only after Metadata Cache confirms that the property-name commit succeeded; hover, keyboard navigation, cancellation, and unconfirmed edits do not count.
- Keep keyboard navigation aligned with the final visible suggestion order.
- Fail closed for unsupported YAML and fail open when Obsidian's suggestion DOM is not recognized.

## Requirements and compatibility

- Obsidian 1.12.7 or later.
- Desktop supports direct dragging. Mobile uses an explicit action in Obsidian's native long-press menu before dragging.
- Property Order works only with top-level YAML properties that Obsidian identifies as text lists; detailed boundaries are listed below.

## Installation

### Manual installation

Download `property-order-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-property-order/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive contains the `property-order/` directory with `main.js`, `manifest.json`, and `styles.css`. Reload Obsidian, then enable Property Order under Community plugins.

### Upgrade

Back up and preserve `Vault/.obsidian/plugins/property-order/data.json` when it exists. Replace only `main.js`, `manifest.json`, and `styles.css`; delete `data.json` only when you explicitly want to reset all plugin preferences.

## Usage

1. Enable Property Order under **Settings → Community plugins**.
2. Open a note with top-level YAML list properties in Obsidian Properties.
3. On desktop, drag a value directly. On mobile, long-press a value, choose **Reorder** (or **Reorder or move**), then drag that value.
4. Configure pinned, bottom, and hidden property-name rules, choose Name, Recently used, or Note count, and clear device-local recent history when needed.

## Settings

Every supported Obsidian version uses the same accessible General, Value drag, and Key order tabs.
The active tab already names the current section, so content begins directly with its first setting
instead of repeating that title.

- **General** controls the interface language and optional diagnostic notices. **Follow Obsidian** uses Obsidian's interface language.
- **Value drag** controls list writeback format, cross-property moves, and related drag behavior. Temporarily disabling value drag preserves the separate cross-property preference for the next time value drag is enabled.
- **Key order** configures pinned, bottom, hidden, name-sorted, recently used, and note-count-sorted native property-name suggestions. Recent order is strict MRU: pinned rules remain first, confirmed recent names follow in newest-first order, names absent from history fall back to name order, and bottom rules remain last. Note count means the number of cached Markdown notes containing the property, not interaction frequency.
- Recent history contains at most 100 exact property names in order and no timestamps. It is stored through Obsidian local storage for the current Vault on the current device; it is separate from `data.json` and is not synced. **Clear recent property history** removes it.
- Name and Recently used sorting do not traverse the Vault. Note count scans cached frontmatter lazily only when that mode needs data and reuses the invalidatable cache. Opening a property-rule editor may also load cached property names lazily for its autocomplete, independently of the selected sort mode.

## Limitations

- Mobile reorder is deliberately armed from Obsidian's native long-press menu, so Edit, Remove from list, and Copy remain available. The armed action applies to one value and expires automatically.
- Only top-level YAML properties that Obsidian identifies as text lists are supported. Normal lists use native pills; guarded empty or scalar mismatch rows may be sources or targets, while an aligned, unambiguous mixed mismatch row may only receive an appended value.
- Object lists, nested lists, multiline flow sequences, source-mode line dragging, and cross-file moves are not supported.
- Converting bullet lists to bracket lists may discard item comments and blank lines that bracket syntax cannot represent.
- Direct keyboard value reordering and screen-reader drag announcements are not currently provided.

## Privacy and security

Property Order reads and updates the current note through Obsidian's editor and Vault APIs. It does not require an account, upload note content, or call a remote service. Unsupported YAML is rejected before writeback, and supported changes are committed through one verified editor transaction. When Markdown note-count ordering is selected for property-name suggestions, the plugin enumerates Markdown files and reads cached frontmatter metadata to calculate counts; it does not read every note body. While property-name suggestion enhancement is enabled, the plugin keeps only an ordered, timestamp-free list of up to 100 confirmed property names in Obsidian's per-Vault, device-local storage so recent order is ready when selected; the settings page provides a clear action.

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
- [Release procedure](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/release.en.md)
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
