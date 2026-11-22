export { diagnoseFrontmatterReorder } from "./diagnostics";
export {
  getFrontmatterListPropertyScalars,
  getFrontmatterListPropertyValues,
  createTextListReader,
  getFrontmatterTextListProperty,
  getFrontmatterTextListPropertyValues,
  haveSameTextListValues,
  type TextListProperty,
} from "./property-reader";
export {
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
