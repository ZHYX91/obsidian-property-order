import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = {
  repository: "ZHYX91/obsidian-property-order",
  languages: [
    {
      label: "English",
      path: "README.md",
      sections: [
        "Demo",
        "Features",
        "Requirements and compatibility",
        "Installation",
        "Usage",
        "Settings",
        "Limitations",
        "Privacy and security",
        "Development",
        "Support",
        "License",
      ],
    },
    {
      label: "简体中文",
      path: "docs/i18n/README.zh-CN.md",
      sections: [
        "演示",
        "功能特性",
        "使用要求与兼容性",
        "安装",
        "使用",
        "设置",
        "限制",
        "隐私与安全",
        "开发",
        "支持",
        "许可证",
      ],
    },
  ],
  packagedReadmeDir: null,
  requiredTokens: [
    "https://github.com/ZHYX91/obsidian-property-order/releases/latest",
    "`main.js`",
    "`manifest.json`",
    "`styles.css`",
    "`data.json`",
  ],
};

const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "release",
]);
const errors = [];
const normalizePath = (filePath) => filePath.split(path.sep).join("/");
const resolveProjectPath = (filePath) => path.resolve(projectRoot, filePath);

function readProjectJson(filePath) {
  return JSON.parse(readFileSync(resolveProjectPath(filePath), "utf8"));
}

function listReadmeFiles(directory) {
  try {
    return readdirSync(resolveProjectPath(directory), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^README.*\.md$/u.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    errors.push(`Missing README directory: ${directory}`);
    return [];
  }
}

function compareFileSets(label, actualFiles, expectedFiles) {
  const actual = new Set(actualFiles);
  const expected = new Set(expectedFiles);

  for (const file of [...expected].sort()) {
    if (!actual.has(file)) {
      errors.push(`${label} is missing ${file}`);
    }
  }
  for (const file of [...actual].sort()) {
    if (!expected.has(file)) {
      errors.push(`${label} contains unexpected README file ${file}`);
    }
  }
}

function validateLocalLinks(filePath, source) {
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const rawTarget = match[1].trim();
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(rawTarget)) {
      continue;
    }

    let target = rawTarget.replace(/^<|>$/gu, "").split("#", 1)[0].split("?", 1)[0];
    try {
      target = decodeURIComponent(target);
    } catch {
      errors.push(`${filePath} contains an invalid encoded link: ${rawTarget}`);
      continue;
    }
    if (!target) {
      continue;
    }

    const resolvedTarget = path.resolve(path.dirname(resolveProjectPath(filePath)), target);
    const relativeTarget = path.relative(projectRoot, resolvedTarget);
    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
      errors.push(`${filePath} contains a local link outside the repository: ${rawTarget}`);
    } else if (!existsSync(resolvedTarget)) {
      errors.push(`${filePath} contains a missing local link: ${rawTarget}`);
    }
  }
}

function validateReadme(language, title, navigation) {
  const { path: filePath, sections } = language;
  let source;
  try {
    source = readFileSync(resolveProjectPath(filePath), "utf8").replace(/^\uFEFF/u, "");
  } catch {
    errors.push(`Missing README file: ${filePath}`);
    return;
  }

  const lines = source.split(/\r\n|\n|\r/u);
  if (lines[0] !== `# ${title}`) {
    errors.push(`${filePath} must start with the canonical title: # ${title}`);
  }
  if (lines[1] !== "" || lines[2] !== navigation || lines[3] !== "") {
    errors.push(`${filePath} must place the shared language navigation after its title`);
  }
  const actualSections = [...source.matchAll(/^## (.+)$/gmu)].map((match) => match[1].trim());
  if (JSON.stringify(actualSections) !== JSON.stringify(sections)) {
    errors.push(
      `${filePath} must use the configured H2 section order; expected ${sections.join(" -> ")}, got ${actualSections.join(" -> ")}`,
    );
  }
  for (const token of config.requiredTokens) {
    if (!source.includes(token)) {
      errors.push(`${filePath} is missing required README contract token: ${token}`);
    }
  }
  validateLocalLinks(filePath, source);
}

function findLocalizedReadmes(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        findLocalizedReadmes(path.join(directory, entry.name), result);
      }
      continue;
    }
    if (entry.isFile() && /^README[._-][A-Za-z0-9].*\.md$/u.test(entry.name)) {
      result.push(normalizePath(path.relative(projectRoot, path.join(directory, entry.name))));
    }
  }
  return result;
}

const manifest = readProjectJson("manifest.json");
const expectedNavigation = config.languages
  .map(
    ({ label, path: readmePath }) =>
      `[${label}](https://github.com/${config.repository}/blob/main/${readmePath})`,
  )
  .join(" · ");
const publicReadmes = config.languages.map(({ path: readmePath }) => readmePath);
const translatedReadmes = publicReadmes.slice(1);

if (publicReadmes[0] !== "README.md") {
  errors.push("The English public README must be README.md at the repository root");
}
for (const translatedReadme of translatedReadmes) {
  if (!/^docs\/i18n\/README\.[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.md$/u.test(translatedReadme)) {
    errors.push(`Invalid translated README path: ${translatedReadme}`);
  }
}

compareFileSets(
  "docs/i18n",
  listReadmeFiles("docs/i18n"),
  translatedReadmes.map((filePath) => path.basename(filePath)),
);
for (const language of config.languages) {
  validateReadme(language, manifest.name, expectedNavigation);
}

const allowedLocalizedReadmes = new Set(translatedReadmes);
let packagedReadmeCount = 0;
if (config.packagedReadmeDir) {
  const packagedReadmes = publicReadmes.map((filePath) => path.basename(filePath));
  compareFileSets(
    config.packagedReadmeDir,
    listReadmeFiles(config.packagedReadmeDir),
    packagedReadmes,
  );
  for (const fileName of packagedReadmes) {
    const packagedPath = normalizePath(path.join(config.packagedReadmeDir, fileName));
    allowedLocalizedReadmes.add(packagedPath);
    validateReadme(
      { path: packagedPath, sections: config.languages[0].sections },
      manifest.name,
      expectedNavigation,
    );
  }
  packagedReadmeCount = packagedReadmes.length;
}

for (const readmePath of findLocalizedReadmes(projectRoot).sort()) {
  if (!allowedLocalizedReadmes.has(readmePath)) {
    errors.push(`Localized README is outside the configured layout: ${readmePath}`);
  }
}

if (errors.length > 0) {
  console.error("README i18n contract failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  const packagedSummary =
    packagedReadmeCount > 0 ? ` and ${packagedReadmeCount} packaged README files` : "";
  console.log(
    `README i18n contract passed: ${publicReadmes.length} public README files${packagedSummary}.`,
  );
}
