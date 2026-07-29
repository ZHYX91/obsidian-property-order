export { diagnoseFrontmatterReorder } from "./diagnostics";
export {
  getFrontmatterListPropertyScalars,
  getFrontmatterListPropertyValues,
  getFrontmatterTextListPropertyValues,
  moveFrontmatterListPropertyValue,
  planFrontmatterListPropertyMove,
  planFrontmatterListPropertyReorder,
  reorderFrontmatterListProperty,
} from "./rewrite";
export type {
  FrontmatterRewritePlan,
  FrontmatterScalar,
  FrontmatterScalarKind,
  FrontmatterTextChange,
} from "./types";
