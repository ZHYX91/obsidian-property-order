import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SUPPORTED_LOCALES } from "../src/shared/locale-catalog.ts";

const scriptPath = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(path.dirname(scriptPath), "..");
const contentByLocale = {
  en: {
    semanticPhrases: ["property-type grouping"],
    sections: [
      "Property name suggestions",
      "Property value suggestions",
      "List value ordering",
      "Installation",
      "Settings reference",
      "Compatibility and limitations",
      "Privacy and security",
      "Development and support",
      "License",
    ],
  },
  "zh-CN": {
    semanticPhrases: ["属性类型分组"],
    sections: [
      "属性名候选",
      "属性值候选",
      "列表值重排与移动",
      "安装",
      "设置参考",
      "兼容性与限制",
      "隐私与安全",
      "开发与支持",
      "许可证",
    ],
  },
  "zh-TW": {
    semanticPhrases: ["屬性類型分組"],
    sections: [
      "屬性名稱候選", "屬性值候選", "清單值重排與移動", "安裝", "設定參考",
      "相容性與限制", "隱私與安全", "開發與支援", "授權條款",
    ],
  },
  "de-DE": {
    semanticPhrases: ["Gruppierung nach Eigenschaftstyp"],
    sections: [
      "Vorschläge für Eigenschaftsnamen", "Vorschläge für Eigenschaftswerte", "Listenwerte umordnen",
      "Installation", "Einstellungsübersicht", "Kompatibilität und Einschränkungen",
      "Datenschutz und Sicherheit", "Entwicklung und Hilfe", "Lizenz",
    ],
  },
  "fr-FR": {
    semanticPhrases: ["regroupement par type de propriété"],
    sections: [
      "Suggestions de noms de propriétés", "Suggestions de valeurs de propriétés", "Réorganiser les valeurs de liste",
      "Installation", "Référence des paramètres", "Compatibilité et limites",
      "Confidentialité et sécurité", "Développement et assistance", "Licence",
    ],
  },
  "es-ES": {
    semanticPhrases: ["agrupación por tipo de propiedad"],
    sections: [
      "Sugerencias de nombres de propiedades", "Sugerencias de valores de propiedades", "Reordenar valores de listas",
      "Instalación", "Referencia de ajustes", "Compatibilidad y limitaciones",
      "Privacidad y seguridad", "Desarrollo y ayuda", "Licencia",
    ],
  },
  "pt-BR": {
    semanticPhrases: ["agrupamento por tipo de propriedade"],
    sections: [
      "Sugestões de nomes de propriedades", "Sugestões de valores de propriedades", "Reordenar valores de listas",
      "Instalação", "Referência de configurações", "Compatibilidade e limitações",
      "Privacidade e segurança", "Desenvolvimento e suporte", "Licença",
    ],
  },
  "ru-RU": {
    semanticPhrases: ["группировка по типу свойства"],
    sections: [
      "Подсказки имён свойств", "Подсказки значений свойств", "Порядок значений списков",
      "Установка", "Справочник настроек", "Совместимость и ограничения",
      "Конфиденциальность и безопасность", "Разработка и поддержка", "Лицензия",
    ],
  },
  "ja-JP": {
    semanticPhrases: ["プロパティの種類ごとに候補をまとめる"],
    sections: [
      "プロパティ名の候補", "プロパティ値の候補", "リスト値の並べ替えと移動", "インストール", "設定リファレンス",
      "互換性と制限", "プライバシーとセキュリティ", "開発とサポート", "ライセンス",
    ],
  },
  "ko-KR": {
    semanticPhrases: ["속성 유형별로 후보 묶기"],
    sections: [
      "속성 이름 후보", "속성 값 후보", "목록 값 순서 변경 및 이동", "설치", "설정 참고",
      "호환성 및 제한 사항", "개인정보 보호 및 보안", "개발 및 지원", "라이선스",
    ],
  },
  "vi-VN": {
    semanticPhrases: ["Nhóm gợi ý theo kiểu thuộc tính"],
    sections: [
      "Gợi ý tên thuộc tính", "Gợi ý giá trị thuộc tính", "Sắp xếp và di chuyển giá trị danh sách",
      "Cài đặt", "Tham khảo cài đặt", "Khả năng tương thích và giới hạn",
      "Quyền riêng tư và bảo mật", "Phát triển và hỗ trợ", "Giấy phép",
    ],
  },
  ar: {
    semanticPhrases: ["تجميع الاقتراحات حسب نوع الخاصية"],
    sections: [
      "اقتراحات أسماء الخصائص", "اقتراحات قيم الخصائص", "إعادة ترتيب قيم القوائم",
      "التثبيت", "مرجع الإعدادات", "التوافق والقيود",
      "الخصوصية والأمان", "التطوير والدعم", "الترخيص",
    ],
  },
};
const config = {
  repository: "ZHYX91/obsidian-property-order",
  languages: SUPPORTED_LOCALES.map(({ id, label }) => {
    const content = contentByLocale[id];
    if (!content) {
      throw new Error(`Missing README section contract for locale: ${id}`);
    }
    return {
      label,
      path: id === "en" ? "README.md" : `docs/i18n/README.${id}.md`,
      ...content,
    };
  }),
  requiredTokens: [
    "https://github.com/ZHYX91/obsidian-property-order/releases/latest",
    "`main.js`",
    "`manifest.json`",
    "`styles.css`",
    "`data.json`",
  ],
};

const dataSafetyPhrasesByLocale = {
  "en": [
    "This changes the value type",
    "bracket-list format can discard",
    "host menu cannot be extended"
  ],
  "zh-CN": [
    "改变值类型",
    "可能丢失项目注释",
    "宿主菜单无法扩展"
  ],
  "zh-TW": [
    "改變值的型別",
    "可能遺失項目註解",
    "宿主選單無法擴充"
  ],
  "de-DE": [
    "Datentyp",
    "Kommentare oder Leerzeilen verlieren",
    "Menüerweiterung nicht verfügbar"
  ],
  "fr-FR": [
    "Le type peut donc changer",
    "perdre les commentaires ou lignes vides",
    "ne peut pas être étendu"
  ],
  "es-ES": [
    "cambiar el tipo de dato",
    "perder comentarios o líneas en blanco",
    "no admite la extensión"
  ],
  "pt-BR": [
    "tipo do valor pode mudar",
    "eliminar comentários ou linhas vazias",
    "não puder ser estendido"
  ],
  "ru-RU": [
    "тип данных",
    "убрать комментарии и пустые строки",
    "расширение меню недоступно"
  ],
  "ja-JP": [
    "値の型も変わる",
    "コメントや空行が失われる",
    "メニューを拡張できない"
  ],
  "ko-KR": [
    "값의 유형도 달라질",
    "주석이나 빈 줄이 사라질",
    "메뉴를 확장할 수 없는"
  ],
  "vi-VN": [
    "kiểu dữ liệu cũng có thể thay đổi",
    "mất chú thích hoặc dòng trống",
    "không thể mở rộng menu"
  ],
  "ar": [
    "نوع القيمة",
    "فقدان التعليقات أو الأسطر الفارغة",
    "تعذرت إضافة هذا الخيار"
  ]
};

const ignoredDirectories = new Set([".git", "coverage", "dist", "node_modules", "release"]);
const normalizePath = (filePath) => filePath.split(path.sep).join("/");

function expectedNavigation(filePath) {
  return config.languages
    .map(({ label, path: targetPath }) => {
      const target = filePath === "README.md"
        ? `https://github.com/${config.repository}/blob/main/${targetPath}`
        : path.posix.relative(path.posix.dirname(filePath), targetPath);
      return `[${label}](${target})`;
    })
    .join(" · ");
}

function stripCodeFences(source) {
  return source.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gmu, "");
}

function collectTargets(source) {
  const targets = [];
  const visibleSource = stripCodeFences(source);
  for (const match of visibleSource.matchAll(/(!?)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^)]*)?\)/gu)) {
    targets.push({ kind: match[1] === "!" ? "image" : "link", target: match[2] });
  }
  for (const match of visibleSource.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)) {
    targets.push({ kind: "image", target: match[1] });
  }
  return targets;
}

function decodeTarget(rawTarget, filePath, errors) {
  const withoutWrapper = rawTarget.replace(/^<|>$/gu, "");
  try {
    return decodeURIComponent(withoutWrapper.split("#", 1)[0].split("?", 1)[0]);
  } catch {
    errors.push(`${filePath} contains an invalid encoded target: ${rawTarget}`);
    return null;
  }
}

function validateRepositoryPath(projectRoot, filePath, rawTarget, repositoryPath, errors) {
  const absoluteTarget = path.resolve(projectRoot, repositoryPath);
  const relativeTarget = path.relative(projectRoot, absoluteTarget);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    errors.push(`${filePath} contains a repository target outside the repository: ${rawTarget}`);
  } else if (!existsSync(absoluteTarget)) {
    errors.push(`${filePath} contains a missing repository target: ${rawTarget}`);
  }
}

function classifyRepositoryUrl(rawTarget) {
  let url;
  try {
    url = new URL(rawTarget);
  } catch {
    return null;
  }
  const blobPrefix = `/${config.repository}/blob/main/`;
  const rawPrefix = `/${config.repository}/main/`;
  if (url.hostname === "github.com" && url.pathname.startsWith(blobPrefix)) {
    return { kind: "blob", path: url.pathname.slice(blobPrefix.length) };
  }
  if (url.hostname === "raw.githubusercontent.com" && url.pathname.startsWith(rawPrefix)) {
    return { kind: "raw", path: url.pathname.slice(rawPrefix.length) };
  }
  return null;
}

function validateTargets(projectRoot, filePath, source, errors) {
  const isRoot = filePath === "README.md";
  for (const { kind, target: rawTarget } of collectTargets(source)) {
    if (rawTarget.startsWith("#")) {
      continue;
    }
    const repositoryUrl = classifyRepositoryUrl(rawTarget);
    if (repositoryUrl) {
      if (!isRoot) {
        errors.push(`${filePath} must use a relative target for repository content: ${rawTarget}`);
        continue;
      }
      if (kind === "image" && repositoryUrl.kind !== "raw") {
        errors.push(`${filePath} must use raw.githubusercontent.com for repository images: ${rawTarget}`);
      }
      if (kind === "link" && repositoryUrl.kind !== "blob") {
        errors.push(`${filePath} must use github.com blob/main for repository documents: ${rawTarget}`);
      }
      const decoded = decodeTarget(repositoryUrl.path, filePath, errors);
      if (decoded) {
        validateRepositoryPath(projectRoot, filePath, rawTarget, decoded, errors);
      }
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)) {
      continue;
    }
    const decoded = decodeTarget(rawTarget, filePath, errors);
    if (!decoded) {
      continue;
    }
    if (isRoot) {
      errors.push(`${filePath} must use a canonical absolute GitHub target for repository content: ${rawTarget}`);
      continue;
    }
    const repositoryPath = path.resolve(path.dirname(path.resolve(projectRoot, filePath)), decoded);
    const relativePath = path.relative(projectRoot, repositoryPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      errors.push(`${filePath} contains a relative target outside the repository: ${rawTarget}`);
    } else if (!existsSync(repositoryPath)) {
      errors.push(`${filePath} contains a missing relative target: ${rawTarget}`);
    }
  }
}

function listLocalizedReadmes(projectRoot, directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        listLocalizedReadmes(projectRoot, path.join(directory, entry.name), result);
      }
      continue;
    }
    if (entry.isFile() && /^README[._-][A-Za-z0-9].*\.md$/u.test(entry.name)) {
      result.push(normalizePath(path.relative(projectRoot, path.join(directory, entry.name))));
    }
  }
  return result;
}

export function checkReadmeI18n(projectRoot = defaultProjectRoot) {
  const errors = [];
  const manifest = JSON.parse(readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
  const translatedReadmes = config.languages.slice(1).map(({ path: filePath }) => filePath);
  const actualTranslatedReadmes = readdirSync(path.join(projectRoot, "docs/i18n"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^README.*\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const expectedTranslatedReadmes = translatedReadmes.map((filePath) => path.basename(filePath)).sort();
  if (JSON.stringify(actualTranslatedReadmes) !== JSON.stringify(expectedTranslatedReadmes)) {
    errors.push(`docs/i18n README set must be exactly: ${expectedTranslatedReadmes.join(", ")}`);
  }

  for (const language of config.languages) {
    const filePath = language.path;
    const absolutePath = path.join(projectRoot, filePath);
    if (!existsSync(absolutePath)) {
      errors.push(`Missing README file: ${filePath}`);
      continue;
    }
    const source = readFileSync(absolutePath, "utf8").replace(/^\uFEFF/u, "");
    const lines = source.split(/\r\n|\n|\r/u);
    if (lines[0] !== `# ${manifest.name}`) {
      errors.push(`${filePath} must start with the canonical title: # ${manifest.name}`);
    }
    const navigation = expectedNavigation(filePath);
    if (lines[1] !== "" || lines[2] !== navigation || lines[3] !== "") {
      errors.push(`${filePath} must place its canonical language navigation after the title`);
    }
    const actualSections = [...source.matchAll(/^## (.+)$/gmu)].map((match) => match[1].trim());
    if (JSON.stringify(actualSections) !== JSON.stringify(language.sections)) {
      errors.push(`${filePath} must use the configured H2 section order`);
    }
    for (const token of config.requiredTokens) {
      if (!source.includes(token)) {
        errors.push(`${filePath} is missing required README contract token: ${token}`);
      }
    }
    for (const phrase of language.semanticPhrases ?? []) {
      if (!source.includes(phrase)) {
        errors.push(`${filePath} is missing required README semantic phrase: ${phrase}`);
      }
    }
    // Risk text is user-facing behavior, not merely section presence. Guard
    // the values, syntax, and mobile fallback in all twelve complete guides.
    for (const token of ["`true`", "`\"true\"`", "`123`", "`\"123\"`"]) {
      if (!source.includes(token)) {
        errors.push(`${filePath} is missing YAML type-change example: ${token}`);
      }
    }
    for (const phrase of dataSafetyPhrasesByLocale[language.path === "README.md"
      ? "en"
      : language.path.split("README.")[1].replace(".md", "")] ?? []) {
      if (!source.includes(phrase)) {
        errors.push(`${filePath} is missing current drag safety explanation: ${phrase}`);
      }
    }
    validateTargets(projectRoot, filePath, source, errors);
  }

  const allowed = new Set(translatedReadmes);
  for (const readmePath of listLocalizedReadmes(projectRoot, projectRoot).sort()) {
    if (!allowed.has(readmePath)) {
      errors.push(`Localized README is outside the configured layout: ${readmePath}`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = checkReadmeI18n();
  if (errors.length > 0) {
    console.error("README i18n contract failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`README i18n contract passed: ${config.languages.length} public README files.`);
  }
}
