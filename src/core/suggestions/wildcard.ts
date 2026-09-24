export function createWildcardMatcher(rawPattern: string): (value: string) => boolean {
  const pattern = rawPattern.toLocaleLowerCase();

  return (rawValue: string) => matchesWildcard(pattern, rawValue.toLocaleLowerCase());
}

function matchesWildcard(pattern: string, value: string): boolean {
  let patternIndex = 0;
  let valueIndex = 0;
  let starIndex = -1;
  let retryValueIndex = -1;

  while (valueIndex < value.length) {
    if (
      patternIndex < pattern.length &&
      pattern[patternIndex] !== "*" &&
      pattern[patternIndex] === value[valueIndex]
    ) {
      patternIndex += 1;
      valueIndex += 1;
      continue;
    }

    if (patternIndex < pattern.length && pattern[patternIndex] === "*") {
      starIndex = patternIndex;
      patternIndex += 1;
      retryValueIndex = valueIndex;
      continue;
    }

    if (starIndex !== -1) {
      patternIndex = starIndex + 1;
      retryValueIndex += 1;
      valueIndex = retryValueIndex;
      continue;
    }

    return false;
  }

  while (patternIndex < pattern.length && pattern[patternIndex] === "*") {
    patternIndex += 1;
  }

  return patternIndex === pattern.length;
}
