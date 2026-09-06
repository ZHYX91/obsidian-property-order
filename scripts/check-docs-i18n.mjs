import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const stableDocumentPairs = [
  {
    requiredTokens: ["preserve", "flow", "block", "[]"],
    source: "docs/product-requirements.zh-CN.md",
    translation: "docs/product-requirements.en.md",
  },
  {
    requiredTokens: [
      "preserve",
      "flow",
      "block",
      "propertyOrderSettings",
      "editor.transaction()",
      "MarkdownView.setViewData(committedContent, false)",
      "MarkdownView.requestSave()",
    ],
    source: "docs/architecture.zh-CN.md",
    translation: "docs/architecture.en.md",
  },
  {
    requiredTokens: [
      "tablist",
      "tab",
      "tabpanel",
      "aria-selected",
      "tabindex",
      'role="alert"',
    ],
    source: "docs/ux-spec.zh-CN.md",
    translation: "docs/ux-spec.en.md",
  },
  {
    requiredTokens: [
      "npm run check",
      "npm run test:coverage",
      "main.ts",
      "src/**/*.ts",
      "preserve",
      "flow",
      "block",
    ],
    source: "docs/testing-strategy.zh-CN.md",
    translation: "docs/testing-strategy.en.md",
  },
];

export function checkDocsI18n(projectRoot = defaultProjectRoot) {
  const errors = [];

  validateStableDocumentInventory(projectRoot, errors);

  for (const pair of stableDocumentPairs) {
    const source = readDocument(projectRoot, pair.source, errors);
    const translation = readDocument(projectRoot, pair.translation, errors);

    if (source == null || translation == null) {
      continue;
    }

    validateFrontmatter(source, pair.source, {
      source_language: "zh-CN",
      translation_status: "source",
    }, errors);
    validateFrontmatter(translation, pair.translation, {
      source_language: "zh-CN",
      translation_of: path.basename(pair.source),
      translation_status: "synced",
    }, errors);
    validateHeadingHierarchy(source, pair.source, errors);
    validateHeadingHierarchy(translation, pair.translation, errors);
    validateBalancedFences(source.body, pair.source, errors);
    validateBalancedFences(translation.body, pair.translation, errors);
    compareSequence(
      pair,
      "heading levels",
      extractHeadingLevels(source.body),
      extractHeadingLevels(translation.body),
      errors,
    );
    compareSequence(
      pair,
      "fenced code block languages",
      extractFenceLanguages(source.body),
      extractFenceLanguages(translation.body),
      errors,
    );
    compareSequence(
      pair,
      "table shapes",
      extractTableShapes(source.body),
      extractTableShapes(translation.body),
      errors,
    );

    const sourceLinks = validateAndExtractLinks(projectRoot, pair.source, source.body, errors);
    const translationLinks = validateAndExtractLinks(
      projectRoot,
      pair.translation,
      translation.body,
      errors,
    );
    compareSequence(pair, "relative links", sourceLinks, translationLinks, errors);

    for (const token of pair.requiredTokens) {
      validateRequiredToken(source.body, pair.source, token, errors);
      validateRequiredToken(translation.body, pair.translation, token, errors);
    }
  }

  return errors;
}

function validateStableDocumentInventory(projectRoot, errors) {
  const docsRoot = path.join(projectRoot, "docs");
  let entries;

  try {
    entries = readdirSync(docsRoot, { withFileTypes: true });
  } catch {
    errors.push("Missing stable documentation directory: docs");
    return;
  }

  const discoveredPairs = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = /^(.*)\.(zh-CN|en)\.md$/u.exec(entry.name);

    if (match == null) {
      continue;
    }

    const [, stem, locale] = match;

    if (stem == null || locale == null) {
      continue;
    }

    const pair = discoveredPairs.get(stem) ?? {};
    pair[locale] = path.posix.join("docs", entry.name);
    discoveredPairs.set(stem, pair);
  }

  const registeredPairCounts = new Map();

  for (const pair of stableDocumentPairs) {
    const source = parseRegisteredStableDocument(pair.source, "zh-CN");
    const translation = parseRegisteredStableDocument(pair.translation, "en");

    if (source == null) {
      errors.push(
        `Registered stable source must be a docs root *.zh-CN.md file: ${pair.source}`,
      );
    }

    if (translation == null) {
      errors.push(
        `Registered stable translation must be a docs root *.en.md file: ${pair.translation}`,
      );
    }

    if (source == null || translation == null) {
      continue;
    }

    if (source.stem !== translation.stem) {
      errors.push(
        `Registered stable documents must share a basename: ${pair.source} and ${pair.translation}`,
      );
      continue;
    }

    const key = createStablePairKey(pair.source, pair.translation);
    registeredPairCounts.set(key, (registeredPairCounts.get(key) ?? 0) + 1);
  }

  for (const [stem, pair] of [...discoveredPairs.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  )) {
    const expectedSource = path.posix.join("docs", `${stem}.zh-CN.md`);
    const expectedTranslation = path.posix.join("docs", `${stem}.en.md`);

    if (pair["zh-CN"] == null) {
      errors.push(
        `Stable document has no Simplified Chinese source: ${pair.en} ` +
          `(expected ${expectedSource})`,
      );
      continue;
    }

    if (pair.en == null) {
      errors.push(
        `Stable document has no English translation: ${pair["zh-CN"]} ` +
          `(expected ${expectedTranslation})`,
      );
      continue;
    }

    const registrationCount =
      registeredPairCounts.get(createStablePairKey(pair["zh-CN"], pair.en)) ?? 0;

    if (registrationCount === 0) {
      errors.push(`Unregistered stable document pair: ${pair["zh-CN"]} and ${pair.en}`);
    } else if (registrationCount > 1) {
      errors.push(
        `Stable document pair must be registered exactly once: ${pair["zh-CN"]} and ` +
          `${pair.en} (found ${registrationCount})`,
      );
    }
  }
}

function parseRegisteredStableDocument(filePath, locale) {
  const prefix = "docs/";
  const suffix = `.${locale}.md`;

  if (!filePath.startsWith(prefix) || !filePath.endsWith(suffix)) {
    return null;
  }

  const stem = filePath.slice(prefix.length, -suffix.length);
  return stem.length === 0 || stem.includes("/") ? null : { stem };
}

function createStablePairKey(source, translation) {
  return `${source}\u0000${translation}`;
}

function readDocument(projectRoot, filePath, errors) {
  try {
    const content = readFileSync(path.join(projectRoot, filePath), "utf8").replace(/^\uFEFF/u, "");
    return parseFrontmatter(content, filePath, errors);
  } catch {
    errors.push(`Missing stable document: ${filePath}`);
    return null;
  }
}

function parseFrontmatter(content, filePath, errors) {
  const lines = content.split(/\r\n|\n|\r/u);

  if (lines[0] !== "---") {
    errors.push(`${filePath} must start with YAML frontmatter`);
    return { body: content, frontmatter: {} };
  }

  const closingIndex = lines.indexOf("---", 1);

  if (closingIndex < 0) {
    errors.push(`${filePath} has unterminated YAML frontmatter`);
    return { body: content, frontmatter: {} };
  }

  const frontmatter = {};

  for (const line of lines.slice(1, closingIndex)) {
    const match = /^([a-z_]+):\s*(.+)$/u.exec(line);

    if (match == null) {
      errors.push(`${filePath} has an invalid frontmatter line: ${line}`);
      continue;
    }

    const [, key, value] = match;
    frontmatter[key] = value;
  }

  return {
    body: lines.slice(closingIndex + 1).join("\n"),
    frontmatter,
  };
}

function validateFrontmatter(document, filePath, expected, errors) {
  const actualKeys = Object.keys(document.frontmatter).sort();
  const expectedKeys = Object.keys(expected).sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    errors.push(
      `${filePath} frontmatter keys must be ${expectedKeys.join(", ")}; found ` +
        `${actualKeys.join(", ")}`,
    );
  }

  for (const [key, value] of Object.entries(expected)) {
    if (document.frontmatter[key] !== value) {
      errors.push(`${filePath} frontmatter must set ${key}: ${value}`);
    }
  }
}

function validateHeadingHierarchy(document, filePath, errors) {
  const levels = extractHeadingLevels(document.body);

  if (levels[0] !== 1 || levels.filter((level) => level === 1).length !== 1) {
    errors.push(`${filePath} must contain exactly one leading level-1 heading`);
  }

  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];

    if (previous != null && current != null && current > previous + 1) {
      errors.push(`${filePath} heading hierarchy jumps from level ${previous} to ${current}`);
    }
  }
}

function validateBalancedFences(body, filePath, errors) {
  if (scanMarkdownLines(body).unclosedFence != null) {
    errors.push(`${filePath} has an unterminated fenced code block`);
  }
}

function extractHeadingLevels(body) {
  return getMarkdownLines(body)
    .filter(({ inFence }) => !inFence)
    .map(({ line }) => /^(#{1,6})\s+\S/u.exec(line)?.[1].length ?? null)
    .filter((level) => level != null);
}

function extractFenceLanguages(body) {
  const result = [];

  for (const { fenceStart, info } of getMarkdownLines(body)) {
    if (fenceStart) {
      result.push(info);
    }
  }

  return result;
}

function extractTableShapes(body) {
  const result = [];
  let current = [];

  for (const { inFence, line } of getMarkdownLines(body)) {
    const trimmed = line.trim();
    const isTableRow = !inFence && trimmed.startsWith("|") && trimmed.endsWith("|");

    if (isTableRow) {
      current.push(trimmed.split(/(?<!\\)\|/u).length - 2);
      continue;
    }

    if (current.length > 0) {
      result.push(`${current.length}x${current.join(",")}`);
      current = [];
    }
  }

  if (current.length > 0) {
    result.push(`${current.length}x${current.join(",")}`);
  }

  return result;
}

function getMarkdownLines(body) {
  return scanMarkdownLines(body).lines;
}

function scanMarkdownLines(body) {
  const result = [];
  let activeFence = null;

  for (const line of body.split("\n")) {
    const fenceMatch = /^\s*(`{3,}|~{3,})(.*)$/u.exec(line);
    const wasInFence = activeFence != null;
    let fenceStart = false;
    let info = "";

    if (fenceMatch != null) {
      const marker = fenceMatch[1];

      if (activeFence == null) {
        activeFence = marker;
        fenceStart = true;
        info = fenceMatch[2].trim();
      } else if (
        marker[0] === activeFence[0] &&
        marker.length >= activeFence.length &&
        fenceMatch[2].trim().length === 0
      ) {
        activeFence = null;
      }
    }

    result.push({ fenceStart, inFence: wasInFence, info, line });
  }

  return { lines: result, unclosedFence: activeFence };
}

function validateAndExtractLinks(projectRoot, filePath, body, errors) {
  const links = [];
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/gu;
  const markdownOutsideFences = getMarkdownLines(body)
    .filter(({ fenceStart, inFence }) => !fenceStart && !inFence)
    .map(({ line }) => line.replace(/(`+)[^`]*\1/gu, ""))
    .join("\n");

  for (const match of markdownOutsideFences.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/gu, "");

    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/iu.test(rawTarget)) {
      continue;
    }

    const [encodedPath, fragment = ""] = rawTarget.split("#", 2);
    const decodedPath = decodeURIComponent(encodedPath);
    const targetPath = decodedPath.length === 0
      ? filePath
      : path.join(path.dirname(filePath), decodedPath);
    const absoluteTarget = path.resolve(projectRoot, targetPath);

    if (!absoluteTarget.startsWith(`${path.resolve(projectRoot)}${path.sep}`)) {
      errors.push(`${filePath} link escapes the repository: ${rawTarget}`);
      continue;
    }

    if (!existsSync(absoluteTarget) || !statSync(absoluteTarget).isFile()) {
      errors.push(`${filePath} has a broken relative link: ${rawTarget}`);
      continue;
    }

    links.push(`${canonicalizeLocalizedPath(decodedPath)}#${fragment}`);
  }

  return links;
}

function canonicalizeLocalizedPath(filePath) {
  return filePath.replace(/\.(?:zh-CN|en)\.md$/u, ".md");
}

function validateRequiredToken(body, filePath, token, errors) {
  if (!body.includes(`\`${token}\``)) {
    errors.push(`${filePath} must retain the stable contract token \`${token}\``);
  }
}

function compareSequence(pair, label, sourceValues, translationValues, errors) {
  if (JSON.stringify(sourceValues) !== JSON.stringify(translationValues)) {
    errors.push(
      `${pair.source} and ${pair.translation} have different ${label}: ` +
        `${JSON.stringify(sourceValues)} != ${JSON.stringify(translationValues)}`,
    );
  }
}

if (
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const errors = checkDocsI18n();

  if (errors.length > 0) {
    console.error("Stable documentation i18n contract failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Stable documentation i18n contract passed: ${stableDocumentPairs.length} document pairs.`,
    );
  }
}
