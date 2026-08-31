export const PRODUCTION_MAIN_JS_BUDGET_BYTES: number;
export const PRODUCTION_MAIN_JS_REFERENCE_BYTES: number;

export interface ProductionBundleResult {
  id: string;
  mainJavascriptBudgetBytes: number;
  mainJavascriptBytes: number;
  mainJavascriptReferenceBytes: number;
  version: string;
}

export function checkProductionBundle(
  projectRoot?: string,
  options?: Readonly<{ mainJavascriptBudgetBytes?: number }>,
): Promise<ProductionBundleResult>;
