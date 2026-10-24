import { planFrontmatterListPropertyReorder } from "../core/frontmatter";
import type { TranslationKey } from "../shared/i18n";
import type { ListWritebackFormat } from "../shared/types";

const EXAMPLE = "---\ntags:\n  - alpha # Keep with alpha\n\n  - beta\n  - 12\n  - true\n---\n";

export function renderWritebackFormatExamples(
  container: HTMLElement,
  t: (key: TranslationKey) => string,
): void {
  const details = container.createEl("details", { cls: "property-order-format-examples" });
  details.createEl("summary", { text: t("settings.writebackFormat.examples") });
  details.createEl("p", { text: t("settings.writebackFormat.exampleHint") });
  details.createEl("strong", { text: t("settings.writebackFormat.before") });
  details.createEl("pre").createEl("code", { text: EXAMPLE });
  for (const format of ["preserve", "flow", "block"] satisfies ListWritebackFormat[]) {
    const plan = planFrontmatterListPropertyReorder(EXAMPLE, {
      propertyKey: "tags",
      sourceIndex: 1,
      targetSlot: 0,
      normalizeAsTextList: true,
      writebackFormat: format,
    });
    if (plan === null) continue;
    details.createEl("strong", { text: `${t("settings.writebackFormat.after")} — ${t(`settings.writebackFormat.${format}`)}` });
    details.createEl("pre").createEl("code", { text: plan.content });
  }
}
