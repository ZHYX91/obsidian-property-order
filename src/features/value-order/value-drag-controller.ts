import { Notice, Platform, type Plugin, type TFile } from "obsidian";

import {
  createIdleDragInteractionState,
  TOUCH_LONG_PRESS_MS,
  transitionDragInteraction,
  type DragInteractionAction,
  type DragInteractionEvent,
  type DragInteractionState,
  type SupportedPointerType,
} from "../../core/interaction/pointer-drag";
import type { FrontmatterScalar } from "../../core/frontmatter";
import { isSameNoteDocument } from "../../core/interaction/document-guard";
import { t, type TranslationKey } from "../../shared/i18n";
import type { PropertyOrderSettings } from "../../shared/types";
import {
  getContainerPills,
  isPropertyPillTarget,
  resolveDraggablePropertyPill,
  resolvePropertyPillContext,
  type PropertyPillContext,
} from "../../obsidian/properties-dom";
import { getCachedFrontmatterListProperties } from "../../obsidian/metadata";
import {
  resolveFileFromPaneContainer,
  resolvePaneFileContext,
} from "../../obsidian/pane-context";
import {
  applyDomDrop,
  createIndicatorElement,
  createPreviewElement,
  positionPreview,
  setDocumentDragCursorActive,
  suppressNativeDrag,
  updateIndicator,
} from "./drag-dom";
import { resolveDropContextAtPoint, resolveDropTarget } from "./drop-targeting";
import type { DropTarget } from "./types";
import { writePropertyValueDrop } from "./writeback";

interface DragState {
  document: Document;
  file: TFile;
  generation: number;
  paneContainer: HTMLElement;
  context: PropertyPillContext;
  expectedContentPromise: Promise<string | null>;
  expectedPropertyValues: ReadonlyMap<string, readonly FrontmatterScalar[]> | null;
  indicatorElement: HTMLElement;
  previewElement: HTMLElement;
  pointerId: number;
  pointerType: SupportedPointerType;
  target: DropTarget | null;
}

const TOUCH_MOVE_LISTENER_OPTIONS: AddEventListenerOptions = {
  capture: true,
  passive: false,
};

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
    if (Platform.isMobileApp) {
      return () => undefined;
    }

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
      this.dragState?.document ?? this.pressedPill?.ownerDocument ?? null;

    if (interactionDocument === targetDocument) {
      this.clearInteractionState();
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.initialized || !this.getSettings().enablePropertyValueDrag) {
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
      return;
    }

    const actions = this.transition({
      type: "press",
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
    });

    this.pressedPill = pill;
    this.pressedPointerType = event.pointerType;

    if (event.pointerType === "touch") {
      this.startTouchMoveCapture(pill.ownerDocument);
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

    this.applyActions(actions);
  };

  private readonly handlePointerUpEvent = (event: PointerEvent): void => {
    void this.handlePointerUp(event);
  };

  private readonly handlePointerUp = async (event: PointerEvent): Promise<void> => {
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
      this.interactionState.phase === "dragging" &&
      this.dragState?.pointerType === "touch"
    ) {
      event.preventDefault();
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
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
    if (event.key !== "Escape" || this.interactionState.phase === "idle") {
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

    const targetDocument = context.pill.ownerDocument;
    const targetWindow = targetDocument.defaultView;

    if (targetWindow == null) {
      this.maybeShowDiagnostic("notice.unsupportedContext");
      this.clearInteractionState();
      return false;
    }

    this.restoreNativeDragState ??= suppressNativeDrag(context.pill);
    const previewElement = createPreviewElement(context.pill);
    const indicatorElement = createIndicatorElement(targetDocument);
    targetDocument.body.append(previewElement, indicatorElement);
    context.pill.classList.add("property-order-dragging");
    setDocumentDragCursorActive(targetDocument, true);

    this.dragState = {
      document: targetDocument,
      file: paneContext.file,
      generation: this.lifecycleGeneration,
      paneContainer: paneContext.container,
      context,
      expectedContentPromise: this.readExpectedContent(paneContext.file),
      expectedPropertyValues: getCachedFrontmatterListProperties(this.plugin.app, paneContext.file),
      indicatorElement,
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

  private readExpectedContent(file: TFile): Promise<string | null> {
    return this.plugin.app.vault
      .cachedRead(file)
      .catch(() => null);
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

    const currentPills = getContainerPills(dragState.context.container);

    if (currentPills.length === 0 || !currentPills.includes(sourcePill)) {
      this.applyActions(this.transition({ type: "abort" }));
      return;
    }

    dragState.context = {
      ...dragState.context,
      pills: currentPills,
      sourceIndex: currentPills.indexOf(sourcePill),
    };

    positionPreview(dragState.previewElement, this.pendingDragX, this.pendingDragY);

    const targetContext = resolveDropContextAtPoint(
      dragState.context,
      this.pendingDragX,
      this.pendingDragY,
      this.getSettings().enableCrossPropertyDrag,
      dragState.paneContainer,
    );
    const target =
      targetContext == null
        ? null
        : resolveDropTarget(
            dragState.context,
            targetContext,
            this.pendingDragX,
            this.pendingDragY,
          );
    dragState.target = target;
    updateIndicator(dragState.indicatorElement, target);
  }

  private async finishDrag(pointerId: number): Promise<void> {
    const dragState = this.dragState;

    if (dragState == null) {
      this.transition({ type: "finish-complete", pointerId });
      return;
    }

    const target = dragState.target;

    if (target == null || target.kind === "noop") {
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

      const expectedContent = await dragState.expectedContentPromise;

      if (!this.isDragStateActive(dragState)) {
        return;
      }

      if (!this.isOriginalDocumentActive(dragState)) {
        new Notice(this.t("notice.activeFileChanged"));
        return;
      }

      const writebackResult = await writePropertyValueDrop({
        canWrite: () =>
          this.isDragStateActive(dragState) && this.isOriginalDocumentActive(dragState),
        expectedContent,
        expectedSourceValues:
          dragState.expectedPropertyValues?.get(dragState.context.propertyKey) ?? null,
        expectedTargetValues:
          target.mode === "move"
            ? dragState.expectedPropertyValues?.get(target.context.propertyKey) ?? null
            : null,
        file: dragState.file,
        plugin: this.plugin,
        sourceContext: dragState.context,
        target,
        writebackFormat: this.getSettings().listWritebackFormat,
      });

      if (!this.isDragStateActive(dragState)) {
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

      if (writebackResult.status === "diagnostic") {
        this.maybeShowDiagnostic(writebackResult.messageKey);
        return;
      }

      if (writebackResult.status === "written") {
        applyDomDrop(dragState.context, target);
      }
    } catch (error) {
      if (this.isDragStateActive(dragState)) {
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
    const currentFile = resolveFileFromPaneContainer(this.plugin, dragState.paneContainer);
    return isSameNoteDocument(dragState.file.path, currentFile?.path);
  }

  private isDragStateActive(dragState: DragState): boolean {
    return (
      this.initialized &&
      this.lifecycleGeneration === dragState.generation &&
      this.dragState === dragState &&
      this.isDragSourceConnected(dragState)
    );
  }

  private isDragSourceConnected(dragState: DragState): boolean {
    const { container, pill, propertyElement } = dragState.context;
    const { document: targetDocument, paneContainer } = dragState;

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
      paneContainer.contains(propertyElement)
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
      this.dragState.context.pill.classList.remove("property-order-dragging");
      this.dragState.previewElement.remove();
      this.dragState.indicatorElement.remove();
    }

    if (targetDocument != null) {
      setDocumentDragCursorActive(targetDocument, false);
    }
    this.restoreNativeDragState?.();
    this.restoreNativeDragState = null;

    this.dragState = null;
    this.pressedPill = null;
    this.pressedPointerType = null;
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
