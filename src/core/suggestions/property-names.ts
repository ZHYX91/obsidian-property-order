const PROPERTY_NAME_GROUP = {
  number: 0,
  latin: 1,
  han: 2,
  other: 3,
} as const;

const NUMBER_CHARACTER = /\p{Decimal_Number}/u;
const LATIN_CHARACTER = /\p{Script=Latin}/u;
const HAN_CHARACTER = /\p{Script=Han}/u;

const LATIN_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const HAN_COLLATOR = new Intl.Collator("zh-CN-u-co-pinyin", {
  numeric: true,
  sensitivity: "base",
});
const VARIANT_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "variant",
});

export function comparePropertyNames(left: string, right: string): number {
  const leftGroup = getPropertyNameGroup(left);
  const rightGroup = getPropertyNameGroup(right);
  const groupDelta = leftGroup - rightGroup;

  if (groupDelta !== 0) {
    return groupDelta;
  }

  const primaryCollator = leftGroup === PROPERTY_NAME_GROUP.han
    ? HAN_COLLATOR
    : LATIN_COLLATOR;
  const primaryDelta = primaryCollator.compare(left, right);

  if (primaryDelta !== 0) {
    return primaryDelta;
  }

  const variantDelta = VARIANT_COLLATOR.compare(left, right);

  if (variantDelta !== 0) {
    return variantDelta;
  }

  return compareCodePoints(left, right);
}

export function getPropertyNameSuggestions(
  availableNames: string[],
  excludedNames: string[],
  query: string,
): string[] {
  const excludedNameSet = new Set(excludedNames);
  const normalizedQuery = query.trim().toLowerCase();

  return dedupePropertyNames(availableNames)
    .filter((name) => !excludedNameSet.has(name))
    .filter(
      (name) =>
        normalizedQuery.length === 0 ||
        name.toLowerCase().includes(normalizedQuery),
    )
    .sort(comparePropertyNames);
}

function getPropertyNameGroup(value: string): number {
  const firstCharacter = Array.from(value.trimStart())[0] ?? "";

  if (NUMBER_CHARACTER.test(firstCharacter)) {
    return PROPERTY_NAME_GROUP.number;
  }

  if (LATIN_CHARACTER.test(firstCharacter)) {
    return PROPERTY_NAME_GROUP.latin;
  }

  if (HAN_CHARACTER.test(firstCharacter)) {
    return PROPERTY_NAME_GROUP.han;
  }

  return PROPERTY_NAME_GROUP.other;
}

function dedupePropertyNames(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim();

    if (value.length === 0 || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function compareCodePoints(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}
