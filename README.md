# Property Order

[English](https://github.com/ZHYX91/obsidian-property-order/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-CN.md)

Property Order enhances Obsidian Properties with safe list-value reordering and configurable native property-name suggestions.

## Demo

Move a value between compatible list properties on desktop:

![Move a value between properties](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-cross-property-drag.gif)

Cross-property drag is enabled by default and can be disabled in the Value drag settings.

Configure native property-name suggestion ordering:

![Property-name suggestion settings](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-settings.png)

## Features

- Drag to reorder values inside a top-level YAML list property.
- Move values between supported properties in the same note, with an option to disable it.
- Preserve the current list format by default, or write affected lists as bracket or bullet lists.
- Pin, move to the bottom, or hide native property-name suggestions.
- Sort suggestions by mixed-language name or property usage count.
- Keep keyboard navigation aligned with the final visible suggestion order.
- Fail closed for unsupported YAML and fail open when Obsidian's suggestion DOM is not recognized.

## Getting started

1. Enable Property Order under **Settings → Community plugins**.
2. Open a note with top-level YAML list properties in Obsidian Properties.
3. On desktop, drag a value directly. On mobile, long-press a value, choose **Reorder** (or **Reorder or move**), then drag that value.
4. Configure pinned, bottom, and hidden property-name rules as needed.

## Limitations

- Mobile reorder is deliberately armed from Obsidian's native long-press menu, so Edit, Remove from list, and Copy remain available. The armed action applies to one value and expires automatically.
- Only top-level YAML lists rendered as Obsidian property pills are supported.
- Object lists, nested lists, multiline flow sequences, source-mode line dragging, and cross-file moves are not supported.
- Converting bullet lists to bracket lists may discard item comments and blank lines that bracket syntax cannot represent.
- Direct keyboard value reordering and screen-reader drag announcements are not currently provided.

## Manual installation

Download `property-order-<version>.zip` from the [latest release](https://github.com/ZHYX91/obsidian-property-order/releases/latest) and extract it into `Vault/.obsidian/plugins/`. The archive already contains the `property-order/` directory and its three plugin files. Reload Obsidian, then enable Property Order under Community plugins.

## Development

```bash
npm install
npm run check
```

See the [developer documentation](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/architecture.en.md) for architecture and testing details.

Questions and general feedback are welcome in [GitHub Discussions](https://github.com/ZHYX91/obsidian-property-order/discussions). Please use the structured [GitHub issue forms](https://github.com/ZHYX91/obsidian-property-order/issues/new/choose) for reproducible bugs and concrete feature requests. Report vulnerabilities privately through the repository's [security policy](https://github.com/ZHYX91/obsidian-property-order/security/policy). Remove private Vault paths, note content, YAML values, and credentials before posting publicly.
