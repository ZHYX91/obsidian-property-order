import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = {
  repository: "ZHYX91/obsidian-property-order",
  languages: [
    { label: "English", path: "README.md" },
    { label: "简体中文", path: "docs/i18n/README.zh-CN.md" },
  ],
  packagedReadmeDir: null,
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

function validateReadmeHeader(filePath, title, navigation) {
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
for (const readmePath of publicReadmes) {
  validateReadmeHeader(readmePath, manifest.name, expectedNavigation);
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
    validateReadmeHeader(packagedPath, manifest.name, expectedNavigation);
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
