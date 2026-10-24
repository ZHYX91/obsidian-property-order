import { Notice, type Editor, type Plugin } from "obsidian";
import { blurFocusedPropertyEditor, findPropertyListContextByKey } from "../../obsidian/properties-dom";
import { reconcileMetadataEditorProperties } from "../../obsidian/metadata-editor-refresh";
import { isCurrentFileIdentity, resolvePaneFileContext } from "../../obsidian/pane-context";
import type { TranslationKey } from "../../shared/i18n";
import { arePropertiesAlignedWithContent } from "./property-list-alignment";
import { PropertiesRefreshNotices } from "./properties-refresh-notices";
import type { DropTarget } from "./types";
import type { CommittedValueWritebackResult, PropertiesRefreshContextState, PropertiesRefreshRecoveryContext, PropertiesRefreshRetryResult, ValueEditSession, WrittenValueWritebackResult } from "./value-edit-session";

interface PostEditReconciliationContext extends PropertiesRefreshRecoveryContext {
  revision: number;
}

interface ReconciliationOptions {
  plugin: Plugin;
  t: (key: TranslationKey) => string;
  isLifecycleCurrent: (generation: number) => boolean;
  isOwned: (session: ValueEditSession) => boolean;
  isOriginalDocumentActive: (session: ValueEditSession) => boolean;
  focusAfterCommit: (session: ValueEditSession, target: DropTarget) => void;
}

/** Reconciles only the exact original/committed editor history; never replays a write. */
export class PropertyValueReconciler {
  private readonly postEditReconciliations = new Map<HTMLElement, PostEditReconciliationContext>();
  readonly notices: PropertiesRefreshNotices;

  constructor(private readonly options: ReconciliationOptions) {
    this.notices = new PropertiesRefreshNotices(options.t, (context) => this.retryPropertiesRefresh(context));
  }

  dispose(): void {
    this.notices.clearAll();
    this.postEditReconciliations.clear();
  }

  private t(key: TranslationKey): string { return this.options.t(key); }

  async finalize(
    dragState: ValueEditSession,
    target: DropTarget,
    writebackResult: WrittenValueWritebackResult,
  ): Promise<void> {
    this.options.focusAfterCommit(dragState, target);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await this.waitForHostUiSettlement(dragState.document);

      if (!this.options.isOwned(dragState)) {
        return;
      }

      if (!this.options.isOriginalDocumentActive(dragState)) {
        new Notice(this.t("notice.activeFileChanged"));
        return;
      }

      const currentContent = dragState.editor.getValue();
      const expectedContent = this.resolvePostCommitContent(
        currentContent,
        writebackResult,
      );

      if (expectedContent == null) {
        new Notice(this.t("notice.writebackDiverged"));
        return;
      }

      let propertiesAligned = arePropertiesAlignedWithContent(
        dragState.paneContainer,
        writebackResult.changedPropertyKeys,
        expectedContent,
      );

      if (!propertiesAligned) {
        reconcileMetadataEditorProperties({
          canRefresh: () =>
            this.options.isOwned(dragState) &&
            this.options.isOriginalDocumentActive(dragState),
          document: dragState.document,
          editor: dragState.editor,
          expectedContent,
          file: dragState.file,
          isAligned: () =>
            arePropertiesAlignedWithContent(
              dragState.paneContainer,
              writebackResult.changedPropertyKeys,
              expectedContent,
            ),
          paneContainer: dragState.paneContainer,
          propertyKeys: writebackResult.changedPropertyKeys,
          view: dragState.paneView,
        });
        await this.waitForHostUiSettlement(dragState.document);

        if (!this.options.isOwned(dragState)) {
          return;
        }

        if (!this.options.isOriginalDocumentActive(dragState)) {
          new Notice(this.t("notice.activeFileChanged"));
          return;
        }

        const settledContent = dragState.editor.getValue();
        const settledExpectedContent = this.resolvePostCommitContent(
          settledContent,
          writebackResult,
        );

        if (settledExpectedContent == null) {
          new Notice(this.t("notice.writebackDiverged"));
          return;
        }

        if (settledExpectedContent !== expectedContent) {
          continue;
        }

        propertiesAligned = arePropertiesAlignedWithContent(
          dragState.paneContainer,
          writebackResult.changedPropertyKeys,
          expectedContent,
        );
      }

      if (!propertiesAligned) {
        this.notices.show({
          committedContent: writebackResult.committedContent,
          document: dragState.document,
          editor: dragState.editor,
          file: dragState.file,
          originalPath: dragState.originalPath,
          generation: dragState.generation,
          paneContainer: dragState.paneContainer,
          previousContent: writebackResult.previousContent,
          propertyKeys: writebackResult.changedPropertyKeys,
          view: dragState.paneView,
        });
      } else {
        this.notices.clear(dragState.paneContainer);
      }

      this.options.focusAfterCommit(dragState, target);
      return;
    }

    // Repeated exact undo/redo changes are valid editor history, not a third-party
    // divergence. Leave the current buffer untouched and only repair focus when
    // the user has not deliberately moved it elsewhere.
    this.options.focusAfterCommit(dragState, target);
  }

  private resolvePostCommitContent(
    currentContent: string,
    writebackResult: WrittenValueWritebackResult,
  ): string | null {
    if (currentContent === writebackResult.committedContent) {
      return writebackResult.committedContent;
    }

    return currentContent === writebackResult.previousContent
      ? writebackResult.previousContent
      : null;
  }

  private waitForHostUiSettlement(targetDocument: Document): Promise<void> {
    const targetWindow = targetDocument.defaultView;

    return targetWindow == null
      ? Promise.resolve()
      : new Promise((resolve) => targetWindow.setTimeout(resolve, 0));
  }

  track(
    dragState: ValueEditSession,
    writebackResult: CommittedValueWritebackResult,
  ): void {
    const context: PostEditReconciliationContext = {
      committedContent: writebackResult.committedContent,
      document: dragState.document,
      editor: dragState.editor,
      file: dragState.file,
      originalPath: dragState.originalPath,
      generation: dragState.generation,
      paneContainer: dragState.paneContainer,
      previousContent: writebackResult.previousContent,
      propertyKeys: writebackResult.changedPropertyKeys,
      revision: 0,
      view: dragState.paneView,
    };

    if (this.getPropertiesRefreshContextState(context).status === "current") {
      this.postEditReconciliations.set(context.paneContainer, context);
    }
  }

  handleEditorChange(editor: Editor): void {
    for (const context of Array.from(this.postEditReconciliations.values())) {
      if (context.editor !== editor) {
        continue;
      }

      const state = this.getPropertiesRefreshContextState(context);

      if (state.status !== "current") {
        this.clearPostEditReconciliation(context.paneContainer);
        continue;
      }

      context.revision += 1;
      const revision = context.revision;
      void this.reconcilePostEditEditorChange(context, revision).catch((error: unknown) => {
        console.warn("Property Order: failed to reconcile Properties after editor change", error);
      });
    }
  }

  private async reconcilePostEditEditorChange(
    context: PostEditReconciliationContext,
    revision: number,
  ): Promise<void> {
    await this.waitForHostUiSettlement(context.document);

    if (!this.isPostEditReconciliationCurrent(context, revision)) {
      return;
    }

    const state = this.getPropertiesRefreshContextState(context);

    if (state.status !== "current") {
      this.clearPostEditReconciliation(context.paneContainer);
      return;
    }

    const expectedContent = state.content;

    if (
      arePropertiesAlignedWithContent(
        context.paneContainer,
        context.propertyKeys,
        expectedContent,
      )
    ) {
      this.notices.clear(context.paneContainer);
      return;
    }

    reconcileMetadataEditorProperties({
      canRefresh: () => {
        if (!this.isPostEditReconciliationCurrent(context, revision)) {
          return false;
        }

        const currentState = this.getPropertiesRefreshContextState(context);
        return currentState.status === "current" && currentState.content === expectedContent;
      },
      document: context.document,
      editor: context.editor,
      expectedContent,
      file: context.file,
      isAligned: () =>
        arePropertiesAlignedWithContent(
          context.paneContainer,
          context.propertyKeys,
          expectedContent,
        ),
      paneContainer: context.paneContainer,
      propertyKeys: context.propertyKeys,
      view: context.view,
    });

    await this.waitForHostUiSettlement(context.document);

    if (!this.isPostEditReconciliationCurrent(context, revision)) {
      return;
    }

    const settledState = this.getPropertiesRefreshContextState(context);

    if (settledState.status !== "current") {
      this.clearPostEditReconciliation(context.paneContainer);
      return;
    }

    if (settledState.content !== expectedContent) {
      return;
    }

    if (
      arePropertiesAlignedWithContent(
        context.paneContainer,
        context.propertyKeys,
        expectedContent,
      )
    ) {
      this.notices.clear(context.paneContainer);
      return;
    }

    this.notices.show(context);
  }

  private isPostEditReconciliationCurrent(
    context: PostEditReconciliationContext,
    revision: number,
  ): boolean {
    return (
      this.postEditReconciliations.get(context.paneContainer) === context &&
      context.revision === revision
    );
  }

  private clearPostEditReconciliation(paneContainer: HTMLElement): void {
    this.postEditReconciliations.delete(paneContainer);
    this.notices.clear(paneContainer);
  }

  clearForDocument(targetDocument: Document): void {
    this.notices.clearForDocument(targetDocument);
    for (const [paneContainer, context] of this.postEditReconciliations) {
      if (context.document === targetDocument) {
        this.clearPostEditReconciliation(paneContainer);
      }
    }
  }

  pruneDisconnected(): void {
    this.notices.pruneDisconnected();
    for (const paneContainer of Array.from(this.postEditReconciliations.keys())) {
      if (!paneContainer.isConnected) {
        this.clearPostEditReconciliation(paneContainer);
      }
    }
  }

  private async retryPropertiesRefresh(
    context: PropertiesRefreshRecoveryContext,
  ): Promise<PropertiesRefreshRetryResult> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const initialState = this.getPropertiesRefreshContextState(context);

      if (initialState.status !== "current") {
        return initialState.status;
      }

      const expectedContent = initialState.content;

      if (
        arePropertiesAlignedWithContent(
          context.paneContainer,
          context.propertyKeys,
          expectedContent,
        )
      ) {
        return "refreshed";
      }

      for (const propertyKey of context.propertyKeys) {
        const propertyElement = findPropertyListContextByKey(
          context.paneContainer,
          propertyKey,
        )?.propertyElement;

        if (propertyElement != null) {
          blurFocusedPropertyEditor(propertyElement);
        }
      }

      const beforePublicRefresh = this.getPropertiesRefreshContextState(context);

      if (beforePublicRefresh.status !== "current") {
        return beforePublicRefresh.status;
      }
      if (beforePublicRefresh.content !== expectedContent) {
        continue;
      }

      try {
        context.view.setViewData(expectedContent, false);
      } catch (error) {
        console.warn("Property Order: failed to retry the public Properties refresh", error);
      }

      await this.waitForHostUiSettlement(context.document);
      const afterPublicRefresh = this.getPropertiesRefreshContextState(context);

      if (afterPublicRefresh.status !== "current") {
        return afterPublicRefresh.status;
      }
      if (afterPublicRefresh.content !== expectedContent) {
        continue;
      }

      if (
        arePropertiesAlignedWithContent(
          context.paneContainer,
          context.propertyKeys,
          expectedContent,
        )
      ) {
        return "refreshed";
      }

      reconcileMetadataEditorProperties({
        canRefresh: () => {
          const state = this.getPropertiesRefreshContextState(context);
          return state.status === "current" && state.content === expectedContent;
        },
        document: context.document,
        editor: context.editor,
        expectedContent,
        file: context.file,
        isAligned: () =>
          arePropertiesAlignedWithContent(
            context.paneContainer,
            context.propertyKeys,
            expectedContent,
          ),
        paneContainer: context.paneContainer,
        propertyKeys: context.propertyKeys,
        view: context.view,
      });

      await this.waitForHostUiSettlement(context.document);
      const afterPrivateRefresh = this.getPropertiesRefreshContextState(context);

      if (afterPrivateRefresh.status !== "current") {
        return afterPrivateRefresh.status;
      }
      if (afterPrivateRefresh.content !== expectedContent) {
        continue;
      }

      return arePropertiesAlignedWithContent(
        context.paneContainer,
        context.propertyKeys,
        expectedContent,
      )
        ? "refreshed"
        : "failed";
    }

    return "failed";
  }

  private getPropertiesRefreshContextState(
    context: PropertiesRefreshRecoveryContext,
  ): PropertiesRefreshContextState {
    if (
      !this.options.isLifecycleCurrent(context.generation) ||
      !context.paneContainer.isConnected ||
      context.paneContainer.ownerDocument !== context.document ||
      context.view.containerEl.ownerDocument !== context.document
    ) {
      return { status: "stale" };
    }

    const paneContext = resolvePaneFileContext(this.options.plugin, context.paneContainer);

    if (
      paneContext?.view !== context.view ||
      paneContext.editor !== context.editor ||
      paneContext.file !== context.file ||
      !isCurrentFileIdentity(this.options.plugin, context.file, context.originalPath)
    ) {
      return { status: "stale" };
    }

    const currentContent = context.editor.getValue();

    if (currentContent === context.committedContent) {
      return { content: context.committedContent, status: "current" };
    }
    if (currentContent === context.previousContent) {
      return { content: context.previousContent, status: "current" };
    }

    return { status: "diverged" };
  }

}
