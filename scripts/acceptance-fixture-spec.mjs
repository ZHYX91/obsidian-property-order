const NEWLINE_FIXTURES = [
  { label: "LF", newline: "\n" },
  { label: "CRLF", newline: "\r\n" },
  { label: "CR", newline: "\r" },
];

export const REQUIRED_ACCEPTANCE_PROPERTY_TYPES = Object.freeze({
  po_block: "multitext",
  po_duplicates: "multitext",
  po_empty: "multitext",
  po_flow: "multitext",
  po_mismatch_boolean: "multitext",
  po_mismatch_empty: "multitext",
  po_mismatch_null: "multitext",
  po_mismatch_number: "multitext",
  po_mismatch_string: "multitext",
  po_mixed_source: "multitext",
  po_mixed_target: "multitext",
  po_non_list: "text",
  po_preserve_target: "multitext",
  po_scalar_source: "multitext",
  po_source: "multitext",
  po_target: "multitext",
});

export const ACCEPTANCE_FIXTURES = Object.freeze([
  ...NEWLINE_FIXTURES.map(({ label, newline }) => ({
    fileName: `Property Order ${label}.md`,
    content: renderNewlineFixture(label, newline),
  })),
  {
    fileName: "Property Order Drag Core.md",
    content: [
      "---",
      "po_source: [alpha, beta]",
      "po_target: [gamma]",
      "po_empty: []",
      "po_non_list: plain text",
      "po_unrelated: unchanged",
      "---",
      "",
      "# Property Order drag core",
      "",
      "Acceptance body marker.",
      "",
    ].join("\n"),
  },
  {
    fileName: "Property Order Drag Mismatch.md",
    content: [
      "---",
      "po_target: [destination]",
      "po_mismatch_empty:",
      "po_mismatch_string: existing",
      "po_mismatch_number: 123",
      "po_mismatch_boolean: TRUE",
      "po_mismatch_null: null",
      "po_mixed_target: [TRUE, gamma]",
      "po_scalar_source: 0xFF",
      "po_mixed_source: [alpha, 123]",
      "---",
      "",
      "# Property Order mismatch storage",
      "",
      "Use the native list type for every po_mismatch, po_mixed, and po_scalar property.",
      "",
    ].join("\n"),
  },
  {
    fileName: "Property Order Drag Preservation.md",
    content: [
      "---",
      "po_flow: [alpha, 123, 'quoted value', alpha] # flow comment",
      "po_block: # block comment",
      "  # attached to beta",
      "  - beta # inline comment",
      "  - TRUE",
      "",
      "  - 'quoted value'",
      "po_preserve_target: [gamma] # target comment",
      'po_duplicates: [same, same, "1", 1]',
      "po_unrelated: keep exactly",
      "---",
      "",
      "# Property Order representation preservation",
      "",
      "Verify preserve, flow, block, noop, comments, quotes, duplicate values, and undo.",
      "",
    ].join("\n"),
  },
]);

export const ACCEPTANCE_FIXTURE_FILE_NAMES = new Set(
  ACCEPTANCE_FIXTURES.map(({ fileName }) => fileName),
);

export const ACCEPTANCE_CONFLICT_MARKERS = Object.freeze({
  body: [
    {
      expected: "Acceptance body marker.",
      replacement: "Acceptance body marker changed externally.",
    },
  ],
  source: [
    {
      expected: "values: [alpha, 'beta value', \"gamma:value\"]",
      replacement: "values: [external-alpha, 'beta value', \"gamma:value\"]",
    },
    {
      expected: "po_source: [alpha, beta]",
      replacement: "po_source: [external-alpha, beta]",
    },
  ],
  target: [
    {
      expected: "po_target: [gamma]",
      replacement: "po_target: [external-gamma]",
    },
  ],
  unrelated: [
    {
      expected: "other: unchanged",
      replacement: "other: external-conflict",
    },
    {
      expected: "po_unrelated: unchanged",
      replacement: "po_unrelated: external-conflict",
    },
  ],
});

function renderNewlineFixture(label, newline) {
  return [
    "---",
    `values: [alpha, 'beta value', "gamma:value"] # ${label} fixture`,
    "other: unchanged",
    "---",
    "",
    `# Property Order ${label}`,
    "",
    "Drag values in Properties, then verify YAML, body text, undo, and the host's newline serialization.",
    "",
  ].join(newline);
}
