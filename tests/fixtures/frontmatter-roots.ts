export const FLOW_ROOT_DOCUMENTS = [
  {
    name: "a multiline root flow mapping",
    source: "---\n{\nflow: [alpha, beta]\n}\n---\nBody\n",
  },
  {
    name: "a nested flow key beside an explicit root key",
    source: "---\n{\nobject: {\nflow: [alpha, beta]\n},\n? flow: [alpha, beta]\n}\n---\nBody\n",
  },
  {
    name: "an anchored flow root after a comment",
    source: "---\n# Keep this comment\n&root {\nflow: [alpha, beta]\n}\n---\nBody\n",
  },
] as const;
