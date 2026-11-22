import { trimPropertyKey } from "../core/suggestions/property-names";
import { preserveSettingsView } from "./settings-view-state";

export function parseKeyRuleLines(value: string): string[] {
  return value.split(/\r?\n/).map(trimPropertyKey).filter(Boolean);
}

/** Keep drafts and caret positions while letting merged settings supply stored values. */
export function preserveSettingsDrafts(
  container: HTMLElement, render: (draftBehaviors: ReadonlySet<string>) => void,
): void {
  const draftSelector = [
    ".property-order-value-behavior-input", ".property-order-custom-value-add input",
    ".property-order-property-name-input", ".property-order-rule-diagnostic-input",
    ".property-order-key-list-input",
  ].join(", ");
  const drafts = new Map<string, { value: string; start: number | null; end: number | null; direction: HTMLInputElement["selectionDirection"] }>();
  const draftBehaviors = new Set<string>();
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(draftSelector))) {
    const id = input.dataset.settingsFocus;
    if (id == null || (!input.value && input !== container.ownerDocument.activeElement)) continue;
    drafts.set(id, { value: input.value, start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection });
    const behavior = input.closest<HTMLElement>("[data-behavior]")?.dataset.behavior;
    if (behavior) draftBehaviors.add(behavior);
  }
  preserveSettingsView(container, () => render(draftBehaviors));
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(draftSelector))) {
    const draft = drafts.get(input.dataset.settingsFocus ?? "");
    if (!draft) continue;
    // Cleanup flushes an edited rule list before remounting. Restore its raw
    // whitespace only when it still represents the freshly rendered rules.
    if (!input.matches("textarea") ||
        parseKeyRuleLines(draft.value).join("\n") === input.value) {
      input.value = draft.value;
    }
    input.setSelectionRange(draft.start, draft.end, draft.direction ?? "none");
  }
}
