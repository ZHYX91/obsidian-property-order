export interface KeyboardReorderProperty {
  readonly key: string;
  readonly values: readonly string[];
  readonly canSource: boolean;
}

export interface KeyboardReorderRequest {
  readonly sourceProperty: string;
  readonly sourceIndex: number;
  readonly action: "up" | "down" | "move";
  readonly targetProperty?: string;
}

/** One snapshot and one submission. Closing a dialog invalidates its unused draft. */
export interface KeyboardReorderDraft {
  readonly properties: readonly KeyboardReorderProperty[];
  submit(request: KeyboardReorderRequest): Promise<boolean>;
  cancel(): void;
}
