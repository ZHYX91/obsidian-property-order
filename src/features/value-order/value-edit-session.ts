import type { Editor, MarkdownView, TFile } from "obsidian";
import type { PropertyPillContext } from "../../obsidian/properties-dom";
import type { ValueWritebackResult } from "./writeback";

export interface ValueEditSession {
  document: Document;
  editor: Editor;
  expectedContent: string | null;
  file: TFile;
  originalPath: string;
  restoreEditorFocus?: boolean;
  focusOwnerAtStart: Element | null;
  focusIntentGeneration: number;
  generation: number;
  paneContainer: HTMLElement;
  paneView: MarkdownView;
  context: PropertyPillContext;
}

export interface PropertiesRefreshRecoveryContext {
  committedContent: string;
  document: Document;
  editor: Editor;
  file: TFile;
  originalPath: string;
  generation: number;
  paneContainer: HTMLElement;
  previousContent: string;
  propertyKeys: readonly string[];
  view: MarkdownView;
}


export type PropertiesRefreshRetryResult = "diverged" | "failed" | "refreshed" | "stale";
export type PropertiesRefreshContextState =
  | { content: string; status: "current" }
  | { status: "diverged" | "stale" };
export type CommittedValueWritebackResult = Extract<
  ValueWritebackResult,
  { status: "persistence-failed" | "written" }
>;
export type WrittenValueWritebackResult = Extract<ValueWritebackResult, { status: "written" }>;

