export function isSameNoteDocument(
  expectedPath: string,
  currentPath: string | null | undefined,
): boolean {
  return currentPath === expectedPath;
}
