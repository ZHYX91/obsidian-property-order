export interface AcceptanceFixtureDefinition {
  readonly content: string;
  readonly fileName: string;
}

export interface AcceptanceConflictMarker {
  readonly expected: string;
  readonly replacement: string;
}

export const REQUIRED_ACCEPTANCE_PROPERTY_TYPES: Readonly<Record<string, string>>;
export const ACCEPTANCE_FIXTURES: readonly AcceptanceFixtureDefinition[];
export const ACCEPTANCE_FIXTURE_FILE_NAMES: ReadonlySet<string>;
export const ACCEPTANCE_CONFLICT_MARKERS: Readonly<
  Record<string, readonly AcceptanceConflictMarker[]>
>;
