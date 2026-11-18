import { planFrontmatterListPropertyReorder } from "../core/frontmatter";
import type { TranslationKey } from "../shared/i18n";
import type { ListWritebackFormat } from "../shared/types";

export function renderWritebackFormatExamples(
  container: HTMLElement,
  t: (key: TranslationKey) => string,
  open = false,
): HTMLDetailsElement {
  const example = `---\ntags:\n  - alpha # ${t("settings.writebackFormat.exampleComment")}\n\n  - beta\n  - 12\n  - true\n---\n`;
  const details = container.createEl("details", { cls: "property-order-format-examples" });
  details.open = open;
  details.createEl("summary", { text: t("settings.writebackFormat.examples") });
  details.createEl("p", { text: t("settings.writebackFormat.exampleHint") });
  details.createEl("strong", { text: t("settings.writebackFormat.before") });
  details.createEl("pre").createEl("code", { text: example });
  for (const format of ["preserve", "flow", "block"] satisfies ListWritebackFormat[]) {
    const plan = planFrontmatterListPropertyReorder(example, {
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
  return details;
}
