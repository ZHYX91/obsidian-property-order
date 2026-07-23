# Property Order

Property Order enhances Obsidian Properties with safe list-value reordering and configurable native property-name suggestions.

## Demo

Move a value between compatible list properties on desktop:

![Move a value between properties](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-cross-property-drag.gif)

Configure native property-name suggestion ordering:

![Property-name suggestion settings](https://raw.githubusercontent.com/ZHYX91/obsidian-property-order/main/docs/assets/property-order-settings.png)

## Features

- Drag to reorder values inside a top-level YAML list property on desktop.
- Optionally move values between supported properties in the same note.
- Preserve the current list format by default, or write affected lists as bracket or bullet lists.
- Pin, move to the bottom, or hide native property-name suggestions.
- Sort suggestions by mixed-language name or property usage count.
- Keep keyboard navigation aligned with the final visible suggestion order.
- Fail closed for unsupported YAML and fail open when Obsidian's suggestion DOM is not recognized.

## Getting started

1. Enable Property Order under **Settings → Community plugins**.
2. Open a note with top-level YAML list properties in Obsidian Properties.
3. Drag a value to reorder it, or enable cross-property drag in the plugin settings.
4. Configure pinned, bottom, and hidden property-name rules as needed.

## Limitations

- Value dragging is desktop-only. On mobile, Obsidian keeps its native long-press menu; property-name suggestion ordering remains available.
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

See the [developer documentation](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/architecture.en.md) for architecture and testing details. Bugs and feature requests are welcome in [GitHub Issues](https://github.com/ZHYX91/obsidian-property-order/issues).

## 中文

查看[简体中文说明](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.zh-CN.md)。
