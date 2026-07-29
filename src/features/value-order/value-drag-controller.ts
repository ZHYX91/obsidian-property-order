import {
  Notice,
  Platform,
  type Editor,
  type MarkdownView,
  type Plugin,
  type TFile,
} from "obsidian";

import {
  createIdleDragInteractionState,
  TOUCH_LONG_PRESS_MS,
  transitionDragInteraction,
  type DragInteractionAction,
  type DragInteractionEvent,
  type DragInteractionState,
  type SupportedPointerType,
} from "../../core/interaction/pointer-drag";
import {
  getFrontmatterListPropertyScalars,
  getFrontmatterTextListPropertyValues,
  type FrontmatterScalar,
} from "../../core/frontmatter";
import { isSameNoteDocument } from "../../core/interaction/document-guard";
import { t, type TranslationKey } from "../../shared/i18n";
import type { PropertyOrderSettings } from "../../shared/types";
import {
  blurFocusedPropertyEditor,
  findPropertyListContextByKey,
  getContainerPills,
  getListTypeMismatchDisplayValue,
  getPropertyPillDisplayValues,
  isPropertyPillTarget,
  resolveDraggablePropertyPill,
  resolveListTypeMismatchContext,
  resolvePropertyContainerContext,
  resolvePropertyPillContext,
  type PropertyContainerContext,
  type PropertyPillContext,
} from "../../obsidian/properties-dom";
import { getCachedFrontmatterStorageKinds } from "../../obsidian/metadata";
import {
  resolvePaneFileContext,
} from "../../obsidian/pane-context";
import {
  createIndicatorElement,
  createPreviewElement,
  positionPreview,
  setDocumentDragCursorActive,
  suppressNativeDrag,
  updateIndicator,
  updateInvalidDropTarget,
} from "./drag-dom";
import {
  resolveDropPoint,
  resolveDropTarget,
} from "./drop-targeting";
import type { DropTarget, InvalidDropTarget } from "./types";
import { writePropertyValueDrop } from "./writeback";
import { addMobileReorderMenuItem } from "./mobile-reorder-menu";

interface DragState {
  document: Document;
  editor: Editor;
  expectedContent: string | null;
  file: TFile;
  generation: number;
  paneContainer: HTMLElement;
  paneView: MarkdownView;
  context: PropertyPillContext;
  expectedStorageKinds: ReturnType<typeof getCachedFrontmatterStorageKinds>;
  indicatorElement: HTMLElement;
  invalidTarget: InvalidDropTarget | null;
  previewElement: HTMLElement;
  pointerId: number;
  pointerType: SupportedPointerType;
  target: DropTarget | null;
}

const TOUCH_MOVE_LISTENER_OPTIONS: AddEventListenerOptions = {
  capture: true,
  passive: false,
};

export const MOBILE_REORDER_ARM_TIMEOUT_MS = 15_000;
const MOBILE_REORDER_ARMED_CLASS = "property-order-mobile-reorder-armed";

export class PropertyValueOrderController {
  private dragState: DragState | null = null;
  private interactionState: DragInteractionState = createIdleDragInteractionState();
  private pressedPill: HTMLElement | null = null;
  private pressedPointerType: SupportedPointerType | null = null;
  private restoreNativeDragState: (() => void) | null = null;
  private dragUpdateRafId: number | null = null;
  private dragUpdateWindow: Window | null = null;
  private touchLongPressTimeoutId: number | null = null;
  private touchLongPressWindow: Window | null = null;
  private touchMoveDocument: Document | null = null;
  private mobileArmedPill: HTMLElement | null = null;
  private mobileArmTimeoutId: number | null = null;
  private mobileArmWindow: Window | null = null;
  private mobileDirectPointerId: number | null = null;
  private pendingDragX: number | null = null;
  private pendingDragY: number | null = null;
  private lastDiagnosticAt = 0;
  private initialized = false;
  private lifecycleGeneration = 0;
  private readonly registeredDocumentCleanups = new Map<Document, () => void>();
  private readonly plugin: Plugin;
  private readonly getSettings: () => PropertyOrderSettings;

  constructor(plugin: Plugin, getSettings: () => PropertyOrderSettings) {
    this.plugin = plugin;
    this.getSettings = getSettings;
  }

  initialize(): () => void {
    this.initialized = true;
    this.lifecycleGeneration += 1;
    this.registerDocumentEvents(document);
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      this.registerDocumentEvents(leaf.view.containerEl.ownerDocument);
    });
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("window-open", (_workspaceWindow, targetWindow) => {
        this.registerDocumentEvents(targetWindow.document);
      }),
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on("window-close", (_workspaceWindow, targetWindow) => {
        this.unregisterDocumentEvents(targetWindow.document);
      }),
    );

    return () => {
      this.initialized = false;
      this.lifecycleGeneration += 1;
      this.clearInteractionState();

      for (const cleanup of Array.from(this.registeredDocumentCleanups.values())) {
        cleanup();
      }
    };
  }

  private registerDocumentEvents(targetDocument: Document): void {
    if (!this.initialized || this.registeredDocumentCleanups.has(targetDocument)) {
      return;
    }

    const targetWindow = targetDocument.defaultView;

    targetDocument.addEventListener("pointerdown", this.handlePointerDown, true);
    targetDocument.addEventListener("pointermove", this.handlePointerMove, true);
    targetDocument.addEventListener("pointerup", this.handlePointerUpEvent, true);
    targetDocument.addEventListener("pointercancel", this.handlePointerCancel, true);
    targetDocument.addEventListener("contextmenu", this.handleContextMenu, true);
    targetDocument.addEventListener("dragstart", this.handleNativeDragStart, true);
    targetDocument.addEventListener("drop", this.handleNativeDrop, true);
    targetDocument.addEventListener("keydown", this.handleKeyDown, true);

    const handleWindowBlur = (): void => {
      this.clearInteractionForDocument(targetDocument);
    };

    if (targetWindow != null) {
      targetWindow.addEventListener("blur", handleWindowBlur);
    }

    const cleanup = (): void => {
      targetDocument.removeEventListener("pointerdown", this.handlePointerDown, true);
      targetDocument.removeEventListener("pointermove", this.handlePointerMove, true);
      targetDocument.removeEventListener("pointerup", this.handlePointerUpEvent, true);
      targetDocument.removeEventListener("pointercancel", this.handlePointerCancel, true);
      targetDocument.removeEventListener("contextmenu", this.handleContextMenu, true);
      targetDocument.removeEventListener("dragstart", this.handleNativeDragStart, true);
      targetDocument.removeEventListener("drop", this.handleNativeDrop, true);
      targetDocument.removeEventListener("keydown", this.handleKeyDown, true);
      targetWindow?.removeEventListener("blur", handleWindowBlur);

      if (this.registeredDocumentCleanups.get(targetDocument) === cleanup) {
        this.registeredDocumentCleanups.delete(targetDocument);
      }
    };

    this.registeredDocumentCleanups.set(targetDocument, cleanup);
  }

  private unregisterDocumentEvents(targetDocument: Document): void {
    this.clearInteractionForDocument(targetDocument);
    this.registeredDocumentCleanups.get(targetDocument)?.();
  }

  private clearInteractionForDocument(targetDocument: Document): void {
    const interactionDocument =
      this.dragState?.document ??
      this.pressedPill?.ownerDocument ??
      this.mobileArmedPill?.ownerDocument ??
      null;

    if (interactionDocument === targetDocument) {
      this.clearInteractionState();
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.initialized || !this.getSettings().enablePropertyValueDrag) {
      this.clearMobileArmState();
      return;
    }

    if (this.interactionState.phase !== "idle") {
      return;
    }

    if (
      event.button !== 0 ||
      (event.pointerType !== "mouse" &&
        event.pointerType !== "touch" &&
        event.pointerType !== "pen")
    ) {
      return;
    }

    const pill = resolveDraggablePropertyPill(event.target);

    if (pill == null) {
      if (Platform.isMobileApp) {
        this.clearMobileArmState();
      }
      return;
    }

    const startsFromMobileMenu =
      Platform.isMobileApp &&
      event.pointerType !== "mouse" &&
      this.consumeMobileArm(pill, event.pointerId);

    if (Platform.isMobileApp && event.pointerType !== "mouse" && !startsFromMobileMenu) {
      return;
    }

    const actions = this.transition({
      type: "press",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      startOnMove: startsFromMobileMenu,
    });

    this.pressedPill = pill;
    this.pressedPointerType = event.pointerType;

    if (event.pointerType === "touch") {
      this.startTouchMoveCapture(pill.ownerDocument);
    }

    if (startsFromMobileMenu) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.restoreNativeDragState = suppressNativeDrag(pill);
    this.applyActions(actions);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.getSettings().enablePropertyValueDrag && this.interactionState.phase !== "idle") {
      this.applyActions(this.transition({ type: "abort" }));
      return;
    }

    const actions = this.transition({
      type: "move",
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (actions.some((action) => action.type === "update-drag" || action.type === "start-drag")) {
      event.preventDefault();
    }

    if (this.mobileDirectPointerId === event.pointerId) {
      event.stopPropagation();
    }

    this.applyActions(actions);
  };

  private readonly handlePointerUpEvent = (event: PointerEvent): void => {
    void this.handlePointerUp(event);
  };

  private readonly handlePointerUp = async (event: PointerEvent): Promise<void> => {
    const isMobileDirectPointer = this.mobileDirectPointerId === event.pointerId;

    if (isMobileDirectPointer) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (
      this.interactionState.phase === "dragging" &&
      this.interactionState.pointerId === event.pointerId
    ) {
      this.flushDragUpdate(event.clientX, event.clientY);
    }

    const actions = this.transition({ type: "release", pointerId: event.pointerId });

    if (actions.some((action) => action.type === "finish-drag")) {
      event.preventDefault();
      this.clearTouchMoveCapture();
      await this.finishDrag(event.pointerId);
    }

    this.applyActions(actions.filter((action) => action.type !== "finish-drag"));
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.applyActions(this.transition({ type: "cancel", pointerId: event.pointerId }));
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    if (
      (this.mobileDirectPointerId != null &&
        this.interactionState.phase === "pressing") ||
      (this.interactionState.phase === "dragging" &&
        this.dragState?.pointerType === "touch")
    ) {
      event.preventDefault();
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    if (Platform.isMobileApp) {
      this.handleMobileContextMenu(event);
      return;
    }

    if (
      (this.dragState?.pointerType ?? this.pressedPointerType) !== "touch" ||
      (this.interactionState.phase !== "pressing" &&
        this.interactionState.phase !== "dragging")
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private handleMobileContextMenu(event: MouseEvent): void {
    if (
      this.mobileDirectPointerId != null ||
      this.interactionState.phase === "pressing" ||
      this.interactionState.phase === "dragging"
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (!this.initialized || !this.getSettings().enablePropertyValueDrag) {
      this.clearMobileArmState();
      return;
    }

    const pill = resolveDraggablePropertyPill(event.target);

    if (pill == null) {
      return;
    }

    addMobileReorderMenuItem({
      event,
      onSelect: () => {
        this.armMobileReorder(pill);
      },
      title: this.t(
        this.getSettings().enableCrossPropertyDrag
          ? "menu.reorderOrMove"
          : "menu.reorder",
      ),
    });
  }

  private armMobileReorder(pill: HTMLElement): void {
    if (
      !this.initialized ||
      !this.getSettings().enablePropertyValueDrag ||
      !pill.isConnected ||
      resolvePropertyPillContext(pill) == null ||
      resolvePaneFileContext(this.plugin, pill) == null
    ) {
      this.maybeShowDiagnostic("notice.unsupportedContext");
      return;
    }

    this.clearInteractionState();
    const targetWindow = pill.ownerDocument.defaultView;

    if (targetWindow == null) {
      this.maybeShowDiagnostic("notice.unsupportedContext");
      return;
    }

    this.mobileArmedPill = pill;
    this.mobileArmWindow = targetWindow;
    pill.classList.add(MOBILE_REORDER_ARMED_CLASS);
    this.mobileArmTimeoutId = targetWindow.setTimeout(() => {
      this.clearMobileArmState();
    }, MOBILE_REORDER_ARM_TIMEOUT_MS);
    new Notice(this.t("notice.mobileReorderArmed"));
  }

  private consumeMobileArm(pill: HTMLElement, pointerId: number): boolean {
    const armedPill = this.mobileArmedPill;

    if (armedPill == null) {
      return false;
    }

    if (pill !== armedPill || !armedPill.isConnected) {
      this.clearMobileArmState();
      return false;
    }

    this.clearMobileArmTimer();
    this.mobileDirectPointerId = pointerId;
    return true;
  }

  private clearMobileArmTimer(): void {
    if (this.mobileArmTimeoutId == null) {
      return;
    }

    this.mobileArmWindow?.clearTimeout(this.mobileArmTimeoutId);
    this.mobileArmTimeoutId = null;
    this.mobileArmWindow = null;
  }

  private clearMobileArmState(): void {
    this.clearMobileArmTimer();
    const armedPill = this.mobileArmedPill;
    armedPill?.classList.remove(MOBILE_REORDER_ARMED_CLASS);
    this.mobileArmedPill = null;
  }

  private startTouchMoveCapture(targetDocument: Document): void {
    this.clearTouchMoveCapture();
    this.touchMoveDocument = targetDocument;
    targetDocument.addEventListener(
      "touchmove",
      this.handleTouchMove,
      TOUCH_MOVE_LISTENER_OPTIONS,
    );
  }

  private clearTouchMoveCapture(): void {
    this.touchMoveDocument?.removeEventListener(
      "touchmove",
      this.handleTouchMove,
      TOUCH_MOVE_LISTENER_OPTIONS,
    );
    this.touchMoveDocument = null;
  }

  private readonly handleNativeDragStart = (event: DragEvent): void => {
    if (!this.initialized || !this.getSettings().enablePropertyValueDrag) {
      return;
    }

    if (!isPropertyPillTarget(event.target)) {
      return;
    }

    event.preventDefault();
  };

  private readonly handleNativeDrop = (event: DragEvent): void => {
    if (this.dragState == null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (this.mobileArmedPill != null && this.interactionState.phase === "idle") {
      event.preventDefault();
      this.clearMobileArmState();
      return;
    }

    if (this.interactionState.phase === "idle") {
      return;
    }

    event.preventDefault();
    this.applyActions(this.transition({ type: "abort" }));
  };

  private scheduleTouchLongPressStart(pointerId: number): void {
    this.clearTouchLongPressTimer();
    const targetWindow = this.pressedPill?.ownerDocument.defaultView;

    if (targetWindow == null) {
      this.applyActions(this.transition({ type: "abort" }));
      return;
    }

    this.touchLongPressWindow = targetWindow;
    this.touchLongPressTimeoutId = targetWindow.setTimeout(() => {
      this.touchLongPressTimeoutId = null;
      this.touchLongPressWindow = null;

      if (!this.initialized) {
        return;
      }

      if (!this.getSettings().enablePropertyValueDrag) {
        this.applyActions(this.transition({ type: "abort" }));
        return;
      }

      this.applyActions(this.transition({ type: "long-press", pointerId }));
    }, TOUCH_LONG_PRESS_MS);
  }

  private startDrag(pointerId: number, clientX: number, clientY: number): boolean {
    this.clearTouchLongPressTimer();
    const pressedPill = this.pressedPill;
    const pressedPointerType = this.pressedPointerType;

    if (pressedPill == null || pressedPointerType == null) {
      this.clearInteractionState();
      return false;
    }

    const context = resolvePropertyPillContext(pressedPill);
    const paneContext = resolvePaneFileContext(this.plugin, pressedPill);

    if (context == null || paneContext == null) {
      this.maybeShowDiagnostic("notice.unsupportedContext");
      this.clearInteractionState();
      return false;
    }

    const expectedContent = this.readExpectedContent(paneContext.editor);

    if (
      context.editorKind === "list-type-mismatch" &&
      (expectedContent == null ||
        getFrontmatterListPropertyScalars(
          expectedContent,
          context.propertyKey,
          true,
        )?.length !== 1)
    ) {
      this.maybeShowDiagnostic("notice.unsupportedProperty");
      this.clearInteractionState();
      return false;
    }

    if (
      expectedContent == null ||
      !this.isSourceContextAlignedWithContent(context, expectedContent)
    ) {
      new Notice(this.t("notice.propertiesOutOfSync"));
      this.clearInteractionState();
      return false;
    }

    const targetDocument = context.pill.ownerDocument;
    const targetWindow = targetDocument.defaultView;

    if (targetWindow == null) {
      this.maybeShowDiagnostic("notice.unsupportedContext");
      this.clearInteractionState();
      return false;
    }

    blurFocusedPropertyEditor(context.propertyElement);

    this.restoreNativeDragState ??= suppressNativeDrag(context.pill);
    this.clearMobileArmState();
    const previewElement = createPreviewElement(context.pill);
    const indicatorElement = createIndicatorElement(targetDocument.body);
    targetDocument.body.append(previewElement);
    context.pill.classList.add("property-order-dragging");
    setDocumentDragCursorActive(targetDocument, true);

    this.dragState = {
      document: targetDocument,
      editor: paneContext.editor,
      expectedContent,
      file: paneContext.file,
      generation: this.lifecycleGeneration,
      paneContainer: paneContext.container,
      paneView: paneContext.view,
      context,
      expectedStorageKinds: getCachedFrontmatterStorageKinds(this.plugin.app, paneContext.file),
      indicatorElement,
      invalidTarget: null,
      previewElement,
      pointerId,
      pointerType: pressedPointerType,
      target: null,
    };
    this.pressedPill = null;
    this.pressedPointerType = null;

    this.pendingDragX = clientX;
    this.pendingDragY = clientY;
    this.scheduleDragUpdate();
    return true;
  }

  private readExpectedContent(editor: Editor): string | null {
    try {
      return editor.getValue();
    } catch {
      return null;
    }
  }

  private scheduleDragUpdate(): void {
    if (this.dragUpdateRafId != null) {
      return;
    }

    const targetWindow = this.dragState?.document.defaultView;

    if (targetWindow == null) {
      this.applyActions(this.transition({ type: "abort" }));
      return;
    }

    this.dragUpdateWindow = targetWindow;
    this.dragUpdateRafId = targetWindow.requestAnimationFrame(() => {
      this.dragUpdateRafId = null;
      this.dragUpdateWindow = null;
      this.applyDragUpdate();
    });
  }

  private flushDragUpdate(clientX: number, clientY: number): void {
    if (this.dragState == null) {
      return;
    }

    this.pendingDragX = clientX;
    this.pendingDragY = clientY;

    if (this.dragUpdateRafId != null) {
      this.dragUpdateWindow?.cancelAnimationFrame(this.dragUpdateRafId);
      this.dragUpdateRafId = null;
      this.dragUpdateWindow = null;
    }

    this.applyDragUpdate();
  }

  private applyDragUpdate(): void {
    const dragState = this.dragState;

    if (dragState == null || this.pendingDragX == null || this.pendingDragY == null) {
      return;
    }

    const sourcePill = dragState.context.pill;

    if (!sourcePill.isConnected || sourcePill.ownerDocument !== dragState.document) {
      this.applyActions(this.transition({ type: "abort" }));
      return;
    }

    const currentPills =
      dragState.context.editorKind === "list-type-mismatch"
        ? [sourcePill]
        : getContainerPills(dragState.context.container);

    if (
      currentPills.length !== dragState.context.pills.length ||
      currentPills[dragState.context.sourceIndex] !== sourcePill ||
      currentPills.some((pill, index) => pill !== dragState.context.pills[index])
    ) {
      this.applyActions(this.transition({ type: "abort" }));
      return;
    }

    positionPreview(dragState.previewElement, this.pendingDragX, this.pendingDragY);

    const dropPoint = resolveDropPoint(
      dragState.context,
      this.pendingDragX,
      this.pendingDragY,
      this.getSettings().enableCrossPropertyDrag,
      dragState.paneContainer,
      dragState.expectedStorageKinds,
    );
    const targetContext =
      dropPoint.kind === "supported-list" ||
      dropPoint.kind === "supported-list-mismatch"
        ? dropPoint.context
        : null;
    const target =
      targetContext == null
        ? null
        : resolveDropTarget(
            dragState.context,
            targetContext,
            this.pendingDragX,
            this.pendingDragY,
          );
    const invalidTarget = target == null && dropPoint.kind === "invalid" ? dropPoint : null;
    updateInvalidDropTarget(dragState.document, dragState.invalidTarget, invalidTarget);
    dragState.target = target;
    dragState.invalidTarget = invalidTarget;
    updateIndicator(dragState.indicatorElement, target);
  }

  private async finishDrag(pointerId: number): Promise<void> {
    const dragState = this.dragState;

    if (dragState == null) {
      this.transition({ type: "finish-complete", pointerId });
      return;
    }

    const target = dragState.target;

    if (target == null) {
      const invalidTarget = dragState.invalidTarget;

      if (
        invalidTarget?.reason === "non-list" &&
        this.isDragStateActive(dragState) &&
        this.isOriginalDocumentActive(dragState)
      ) {
        new Notice(
          this.t("notice.targetNotList").replace(
            "{property}",
            () => invalidTarget.propertyKey,
          ),
        );
      }

      this.clearInteractionState();
      return;
    }

    if (target.kind === "noop") {
      this.clearInteractionState();
      return;
    }

    try {
      if (!this.isDragStateActive(dragState)) {
        return;
      }

      if (!this.isOriginalDocumentActive(dragState)) {
        new Notice(this.t("notice.activeFileChanged"));
        return;
      }

      const currentContent = dragState.editor.getValue();

      if (
        !this.isSourceContextAlignedWithContent(dragState.context, currentContent) ||
        !this.isTargetContextAlignedWithContent(target.context, currentContent)
      ) {
        new Notice(this.t("notice.propertiesOutOfSync"));
        return;
      }

      blurFocusedPropertyEditor(target.context.propertyElement);

      const writebackResult = await writePropertyValueDrop({
        canFinalize: () => this.isOriginalDocumentActive(dragState),
        canWrite: () =>
          this.isDropReadyForWrite(dragState, target),
        editor: dragState.editor,
        expectedContent: dragState.expectedContent,
        sourceContext: dragState.context,
        target,
        view: dragState.paneView,
        writebackFormat: this.getSettings().listWritebackFormat,
      });

      if (!this.isDragOperationOwned(dragState)) {
        return;
      }

      if (!this.isOriginalDocumentActive(dragState)) {
        new Notice(this.t("notice.activeFileChanged"));
        return;
      }

      if (writebackResult.status === "conflict") {
        new Notice(this.t("notice.contentChanged"));
        return;
      }

      if (writebackResult.status === "aborted") {
        return;
      }

      if (writebackResult.status === "diagnostic") {
        this.maybeShowDiagnostic(writebackResult.messageKey);
        return;
      }

      if (writebackResult.status === "failed") {
        new Notice(this.t("notice.reorderFailed"));
        return;
      }

      if (writebackResult.status === "diverged") {
        new Notice(this.t("notice.writebackDiverged"));
        return;
      }

      if (writebackResult.status === "persistence-failed") {
        new Notice(this.t("notice.persistenceFailed"));
        return;
      }

      if (writebackResult.status === "written") {
        if (dragState.editor.getValue() !== writebackResult.committedContent) {
          new Notice(this.t("notice.writebackDiverged"));
          return;
        }
        await this.waitForHostUiSettlement(dragState.document);

        if (!this.isDragOperationOwned(dragState)) {
          return;
        }

        if (dragState.editor.getValue() !== writebackResult.committedContent) {
          new Notice(this.t("notice.writebackDiverged"));
          return;
        }

        const propertiesAligned = writebackResult.changedPropertyKeys.every((propertyKey) => {
          const context = findPropertyListContextByKey(dragState.paneContainer, propertyKey);
          return context != null && this.isListContextAlignedWithContent(
            context,
            writebackResult.committedContent,
            true,
          );
        });

        if (!propertiesAligned) {
          new Notice(this.t("notice.propertiesRefreshNeeded"));
        }
      }
    } catch (error) {
      if (this.isDragOperationOwned(dragState)) {
        console.error("Property Order: failed to write frontmatter", error);
        new Notice(this.t("notice.reorderFailed"));
      }
    } finally {
      if (this.dragState === dragState) {
        this.clearInteractionState();
      }
    }
  }

  private isOriginalDocumentActive(dragState: DragState): boolean {
    const currentPaneContext = resolvePaneFileContext(this.plugin, dragState.paneContainer);
    return (
      currentPaneContext?.view === dragState.paneView &&
      currentPaneContext?.editor === dragState.editor &&
      isSameNoteDocument(dragState.file.path, currentPaneContext.file.path)
    );
  }

  private isSourceContextAlignedWithContent(
    context: PropertyContainerContext,
    content: string,
  ): boolean {
    return this.isListContextAlignedWithContent(context, content, false);
  }

  private isTargetContextAlignedWithContent(
    context: PropertyContainerContext,
    content: string,
  ): boolean {
    return this.isListContextAlignedWithContent(context, content, true);
  }

  private isListContextAlignedWithContent(
    context: PropertyContainerContext,
    content: string,
    allowMultipleMismatchValues: boolean,
  ): boolean {
    if (context.editorKind === "list-type-mismatch") {
      return isListTypeMismatchContextAlignedWithContent(
        context,
        content,
        allowMultipleMismatchValues,
      );
    }

    return this.isMultiSelectContextAlignedWithContent(context, content);
  }

  private isMultiSelectContextAlignedWithContent(
    context: PropertyContainerContext,
    content: string,
  ): boolean {
    if (context.editorKind !== "multi-select") {
      return false;
    }

    const expectedValues = getFrontmatterTextListPropertyValues(content, context.propertyKey);
    const visibleValues = getPropertyPillDisplayValues(context);

    return areStringArraysEqual(expectedValues, visibleValues);
  }

  private isDropReadyForWrite(dragState: DragState, target: DropTarget): boolean {
    if (
      !this.isDragStateActive(dragState) ||
      !this.isOriginalDocumentActive(dragState) ||
      !this.isDropTargetActive(dragState, target)
    ) {
      return false;
    }

    const currentContent = this.readExpectedContent(dragState.editor);

    return (
      currentContent != null &&
      this.isSourceContextAlignedWithContent(dragState.context, currentContent) &&
      this.isTargetContextAlignedWithContent(target.context, currentContent)
    );
  }

  private waitForHostUiSettlement(targetDocument: Document): Promise<void> {
    const targetWindow = targetDocument.defaultView;

    return targetWindow == null
      ? Promise.resolve()
      : new Promise((resolve) => targetWindow.setTimeout(resolve, 0));
  }

  private isDragOperationOwned(dragState: DragState): boolean {
    return (
      this.initialized &&
      this.lifecycleGeneration === dragState.generation &&
      this.dragState === dragState
    );
  }

  private isDragStateActive(dragState: DragState): boolean {
    return this.isDragOperationOwned(dragState) && this.isDragSourceConnected(dragState);
  }

  private isDropTargetActive(dragState: DragState, target: DropTarget): boolean {
    const { container, propertyElement, propertyKey } = target.context;

    if (
      !container.isConnected ||
      container.ownerDocument !== dragState.document ||
      !propertyElement.isConnected ||
      propertyElement.ownerDocument !== dragState.document ||
      !propertyElement.contains(container) ||
      !dragState.paneContainer.contains(propertyElement)
    ) {
      return false;
    }

    const currentContext =
      target.context.editorKind === "list-type-mismatch"
        ? resolveListTypeMismatchContext(propertyElement)
        : resolvePropertyContainerContext(container);
    return (
      currentContext?.propertyKey === propertyKey &&
      currentContext.container === container &&
      currentContext.editorKind === target.context.editorKind &&
      currentContext.pills.length === target.context.pills.length &&
      currentContext.pills.every((pill, index) => pill === target.context.pills[index])
    );
  }

  private isDragSourceConnected(dragState: DragState): boolean {
    const { container, pill, propertyElement } = dragState.context;
    const { document: targetDocument, paneContainer } = dragState;

    const currentContext =
      dragState.context.editorKind === "list-type-mismatch"
        ? resolveListTypeMismatchContext(propertyElement)
        : resolvePropertyContainerContext(container);

    return (
      pill.isConnected &&
      pill.ownerDocument === targetDocument &&
      container.isConnected &&
      container.ownerDocument === targetDocument &&
      container.contains(pill) &&
      propertyElement.isConnected &&
      propertyElement.ownerDocument === targetDocument &&
      propertyElement.contains(container) &&
      paneContainer.isConnected &&
      paneContainer.ownerDocument === targetDocument &&
      paneContainer.contains(propertyElement) &&
      currentContext?.propertyKey === dragState.context.propertyKey &&
      currentContext.container === container &&
      currentContext.editorKind === dragState.context.editorKind &&
      (dragState.context.editorKind === "list-type-mismatch" ||
        (currentContext.pills.length === dragState.context.pills.length &&
          currentContext.pills.every(
            (currentPill, index) => currentPill === dragState.context.pills[index],
          )))
    );
  }

  private clearPressState(): void {
    if (this.dragState != null) {
      return;
    }

    this.clearTouchLongPressTimer();
    this.clearTouchMoveCapture();
    this.restoreNativeDragState?.();
    this.restoreNativeDragState = null;
    this.pressedPill = null;
    this.pressedPointerType = null;
    this.mobileDirectPointerId = null;
    this.clearMobileArmState();
  }

  private clearInteractionState(): void {
    this.clearTouchLongPressTimer();
    this.clearTouchMoveCapture();

    if (this.dragUpdateRafId != null) {
      this.dragUpdateWindow?.cancelAnimationFrame(this.dragUpdateRafId);
      this.dragUpdateRafId = null;
    }
    this.dragUpdateWindow = null;

    this.pendingDragX = null;
    this.pendingDragY = null;

    const targetDocument = this.dragState?.document;

    if (this.dragState != null) {
      updateInvalidDropTarget(
        this.dragState.document,
        this.dragState.invalidTarget,
        null,
      );
      this.dragState.context.pill.classList.remove("property-order-dragging");
      this.dragState.previewElement.remove();
      this.dragState.indicatorElement.remove();
    }

    if (targetDocument != null) {
      setDocumentDragCursorActive(targetDocument, false);
    }
    this.restoreNativeDragState?.();
    this.restoreNativeDragState = null;

    this.clearMobileArmState();
    this.dragState = null;
    this.pressedPill = null;
    this.pressedPointerType = null;
    this.mobileDirectPointerId = null;
    this.interactionState = createIdleDragInteractionState();
  }

  private transition(event: DragInteractionEvent): DragInteractionAction[] {
    const transition = transitionDragInteraction(this.interactionState, event);
    this.interactionState = transition.state;
    return transition.actions;
  }

  private applyActions(actions: DragInteractionAction[]): void {
    for (const action of actions) {
      if (action.type === "schedule-long-press") {
        this.scheduleTouchLongPressStart(action.pointerId);
      } else if (action.type === "clear-press") {
        this.clearPressState();
      } else if (action.type === "start-drag") {
        this.startDrag(action.pointerId, action.clientX, action.clientY);
      } else if (action.type === "update-drag") {
        this.pendingDragX = action.clientX;
        this.pendingDragY = action.clientY;
        this.scheduleDragUpdate();
      } else if (action.type === "cancel-drag") {
        this.clearInteractionState();
      }
    }
  }

  private clearTouchLongPressTimer(): void {
    if (this.touchLongPressTimeoutId == null) {
      return;
    }

    this.touchLongPressWindow?.clearTimeout(this.touchLongPressTimeoutId);
    this.touchLongPressTimeoutId = null;
    this.touchLongPressWindow = null;
  }

  private maybeShowDiagnostic(messageKey: TranslationKey): void {
    if (!this.getSettings().showDiagnostics) {
      return;
    }

    const now = Date.now();

    if (now - this.lastDiagnosticAt < 2000) {
      return;
    }

    this.lastDiagnosticAt = now;
    new Notice(this.t(messageKey));
  }

  private t(messageKey: TranslationKey): string {
    return t(messageKey, this.getSettings().language);
  }
}

function areStringArraysEqual(
  left: readonly string[] | null,
  right: readonly string[] | null,
): boolean {
  return (
    left != null &&
    right != null &&
    left.length === right.length &&
    left.every((value, index) => right[index] === value)
  );
}

function isListTypeMismatchContextAlignedWithContent(
  context: PropertyContainerContext,
  content: string,
  allowMultipleValues: boolean,
): boolean {
  const expectedTextValues = getFrontmatterTextListPropertyValues(
    content,
    context.propertyKey,
  );
  const expectedScalars = getFrontmatterListPropertyScalars(
    content,
    context.propertyKey,
    true,
  );
  const displayedValue = getListTypeMismatchDisplayValue(context);

  if (
    expectedTextValues == null ||
    expectedScalars == null ||
    displayedValue == null ||
    expectedTextValues.length !== expectedScalars.length
  ) {
    return false;
  }

  if (expectedTextValues.length === 0) {
    return displayedValue === "" || displayedValue === "null" || displayedValue === "~";
  }

  if (expectedTextValues.length === 1) {
    const expectedScalar = expectedScalars[0];
    return (
      expectedScalar != null &&
      (displayedValue === expectedTextValues[0] || displayedValue === expectedScalar.value)
    );
  }

  if (!allowMultipleValues) {
    return false;
  }

  const displayedScalars = parseMismatchDisplayScalars(displayedValue);
  return (
    displayedScalars != null &&
    displayedScalars.length === expectedScalars.length &&
    expectedScalars.every((expectedScalar, index) => {
      const displayedScalar = displayedScalars[index];

      if (displayedScalar == null || displayedScalar.value !== expectedScalar.value) {
        return false;
      }

      return (
        displayedScalar.kind === expectedScalar.kind ||
        (expectedScalar.kind !== "string" && displayedScalar.kind === "string")
      );
    })
  );
}

function parseMismatchDisplayScalars(displayedValue: string): readonly FrontmatterScalar[] | null {
  const trimmedValue = displayedValue.trim();
  const flowValue =
    trimmedValue.startsWith("[") && trimmedValue.endsWith("]")
      ? trimmedValue
      : `[${trimmedValue}]`;
  return getFrontmatterListPropertyScalars(
    `---\nproperty-order-value: ${flowValue}\n---\n`,
    "property-order-value",
  );
}
