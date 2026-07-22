import path from "node:path";

export function createEsbuildOptions({
  production = false,
  projectRoot = process.cwd(),
} = {}) {
  return {
    absWorkingDir: projectRoot,
    bundle: true,
    entryPoints: ["main.ts"],
    external: ["obsidian", "electron", "@codemirror/state", "@codemirror/view"],
    format: "cjs",
    target: "es2020",
    logLevel: "info",
    sourcemap: production ? false : "inline",
    treeShaking: true,
    outfile: path.join(projectRoot, "dist", "property-order", "main.js"),
  };
}
