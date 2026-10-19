export function formatTranslation(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  // Scan only the template: inserted values are literal text, never new placeholders.
  return template.replace(/\{([a-z]+)\}/gu, (placeholder: string, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder,
  );
}
