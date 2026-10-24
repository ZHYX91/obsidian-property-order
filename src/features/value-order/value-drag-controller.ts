import {
  Notice,
  Platform,
  type Editor,
  type EventRef,
  type Plugin,
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
} from "../../core/frontmatter";
import { t, type TranslationKey } from "../../shared/i18n";
import type { PropertyOrderSettings } from "../../shared/types";
import {
  blurFocusedPropertyEditor,
  findPropertyListContextByKey,
  getContainerPills,
  isPropertyPillTarget,
  resolveDraggablePropertyPill,
  resolveListTypeMismatchContext,
  resolvePropertyContainerContext,
  getVisiblePropertyListContexts,
  resolvePropertyPillContext,
} from "../../obsidian/properties-dom";
import { getCachedFrontmatterStorageKinds } from "../../obsidian/metadata";
import {
  isCurrentFileIdentity,
  resolvePaneFileContext,
} from "../../obsidian/pane-context";
import {
  announceDragStatus,
  autoScrollDragContainer,
  createDragStatusElement,
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
import {
  writePropertyValueDrop,
} from "./writeback";
import { addMobileReorderMenuItem } from "./mobile-reorder-menu";
import { PropertyValueReconciler } from "./property-value-reconciler";
import { isSourceContextAlignedWithContent, isTargetContextAlignedWithContent } from "./property-list-alignment";
import type { KeyboardReorderDraft } from "./keyboard-reorder";
import type { ValueEditSession } from "./value-edit-session";

interface DragState extends ValueEditSession {
  expectedStorageKinds: ReturnType<typeof getCachedFrontmatterStorageKinds>;
  indicatorElement: HTMLElement;
  invalidTarget: InvalidDropTarget | null;
  previewElement: HTMLElement;
  statusElement: HTMLElement;
  pointerId: number;
  pointerType: SupportedPointerType;
  target: DropTarget | null;
}

interface TrailingClickSuppression {
  clientX: number;
  clientY: number;
  document: Document;
  timeoutId: number;
  window: Window;
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
  private trailingClickSuppression: TrailingClickSuppression | null = null;
  private mobileArmedPill: HTMLElement | null = null;
  private mobileArmTimeoutId: number | null = null;
  private mobileArmWindow: Window | null = null;
  private mobileDirectPointerId: number | null = null;
  private pendingDragX: number | null = null;
  private pendingDragY: number | null = null;
  private lastDiagnosticAt = 0;
  private initialized = false;
  private lifecycleGeneration = 0;
  private userFocusIntentGeneration = 0;
  private readonly reconciliation: PropertyValueReconciler;
  private editSession: ValueEditSession | null = null;
  private keyboardDraft: object | null = null;
  private readonly registeredDocumentCleanups = new Map<Document, () => void>();
  private readonly registeredEventCleanups: Array<() => void> = [];
  private readonly plugin: Plugin;
  private readonly getSettings: () => PropertyOrderSettings;

  constructor(plugin: Plugin, getSettings: () => PropertyOrderSettings) {
    this.plugin = plugin;
    this.getSettings = getSettings;
    this.reconciliation = new PropertyValueReconciler({
      plugin,
      t: (key) => this.t(key),
      isLifecycleCurrent: (generation) => this.initialized && this.lifecycleGeneration === generation,
      isOwned: (session) => this.isEditSessionOwned(session),
      isOriginalDocumentActive: (session) => this.isOriginalDocumentActive(session),
      focusAfterCommit: (session, target) => this.restoreEditorFocusAfterCommit(session, target),
    });
  }

  initialize(): () => void {
    if (this.initialized) {
      return this.dispose;
    }

    this.initialized = true;
    this.lifecycleGeneration += 1;
    try {
      this.registerDocumentEvents(document);
      this.plugin.app.workspace.iterateAllLeaves((leaf) => {
        this.registerDocumentEvents(leaf.view.containerEl.ownerDocument);
      });
      const windowOpenRef = this.plugin.app.workspace.on(
        "window-open",
        (_workspaceWindow, targetWindow) => {
          this.registerDocumentEvents(targetWindow.document);
        },
      );
      this.registerControllerEvent(windowOpenRef, () => {
        this.plugin.app.workspace.offref(windowOpenRef);
      });
      const windowCloseRef = this.plugin.app.workspace.on(
        "window-close",
        (_workspaceWindow, targetWindow) => {
          this.unregisterDocumentEvents(targetWindow.document);
        },
      );
      this.registerControllerEvent(windowCloseRef, () => {
        this.plugin.app.workspace.offref(windowCloseRef);
      });
      const layoutChangeRef = this.plugin.app.workspace.on("layout-change", () => {
        this.reconciliation.pruneDisconnected();
      });
      this.registerControllerEvent(layoutChangeRef, () => {
        this.plugin.app.workspace.offref(layoutChangeRef);
      });
      const editorChangeRef = this.plugin.app.workspace.on("editor-change", (editor) => {
        this.reconciliation.handleEditorChange(editor);
      });
      this.registerControllerEvent(editorChangeRef, () => {
        this.plugin.app.workspace.offref(editorChangeRef);
      });
    } catch (error) {
      this.dispose();
      throw error;
    }

    return this.dispose;
  }

  prepareKeyboardReorder(paneElement: HTMLElement): KeyboardReorderDraft | null {
    if (!this.initialized || this.editSession !== null) return null;
    const pane = resolvePaneFileContext(this.plugin, paneElement);
    const expectedContent = pane === null ? null : this.readExpectedContent(pane.editor);
    if (pane === null || expectedContent === null) return null;
    const contexts = getVisiblePropertyListContexts(pane.container)
      .filter((context) => isTargetContextAlignedWithContent(context, expectedContent));
    const properties = contexts.map((context) => ({
      key: context.propertyKey,
      values: getFrontmatterTextListPropertyValues(expectedContent, context.propertyKey) ?? [],
      canSource: isSourceContextAlignedWithContent(context, expectedContent),
    }));
    if (!properties.some((property) => property.canSource && property.values.length > 0)) {
      new Notice(this.t("keyboard.unavailable"));
      return null;
    }
    const token = {};
    const generation = this.lifecycleGeneration;
    const originalPath = pane.file.path;
    this.keyboardDraft = token;
    let submitted = false;
    return {
      properties,
      cancel: () => { if (this.keyboardDraft === token) this.keyboardDraft = null; },
      submit: async (request) => {
        if (submitted) return false;
        submitted = true;
        if (!this.initialized || this.lifecycleGeneration !== generation || this.keyboardDraft !== token) return false;
        this.keyboardDraft = null;
        const currentPane = resolvePaneFileContext(this.plugin, pane.container);
        if (currentPane?.file !== pane.file || currentPane.view !== pane.view ||
            currentPane.editor !== pane.editor || !isCurrentFileIdentity(this.plugin, pane.file, originalPath)) {
          new Notice(this.t("notice.activeFileChanged"));
          return false;
        }
        if (this.readExpectedContent(pane.editor) !== expectedContent || this.editSession !== null) {
          new Notice(this.t("notice.contentChanged"));
          return false;
        }
        const source = contexts.find((context) => context.propertyKey === request.sourceProperty);
        const values = properties.find((property) => property.key === request.sourceProperty);
        if (source === undefined || values?.canSource !== true || !Number.isInteger(request.sourceIndex) ||
            request.sourceIndex < 0 || request.sourceIndex >= values.values.length) return false;
        const pill = source.editorKind === "list-type-mismatch" ? source.container : source.pills[request.sourceIndex];
        if (pill === undefined) return false;
        const sourceContext = resolvePropertyPillContext(pill);
        if (sourceContext === null) return false;
        const destination = request.action === "move"
          ? contexts.find((context) => context.propertyKey === request.targetProperty)
          : source;
        if (destination === undefined || (request.action === "move" && destination === source) ||
            (request.action === "up" && request.sourceIndex === 0) ||
            (request.action === "down" && request.sourceIndex === values.values.length - 1)) return false;
        const session: ValueEditSession = {
          context: sourceContext,
          document: pane.container.ownerDocument,
          editor: pane.editor,
          expectedContent,
          file: pane.file,
          originalPath,
          focusOwnerAtStart: pane.container.ownerDocument.activeElement,
          focusIntentGeneration: this.userFocusIntentGeneration,
          generation,
          paneContainer: pane.container,
          paneView: pane.view,
          restoreEditorFocus: false,
        };
        this.editSession = session;
        return this.commitValueEdit(session, {
          context: destination,
          kind: "drop",
          mode: request.action === "move" ? "move" : "reorder",
          slot: request.action === "move" ? "append" : request.sourceIndex + (request.action === "up" ? -1 : 2),
        });
      },
    };
  }

  private registerControllerEvent(eventRef: EventRef, release: () => void): void {
    this.registeredEventCleanups.push(release);
    this.plugin.registerEvent(eventRef);
  }

  dispose = (): void => {
    if (
      !this.initialized &&
      this.registeredDocumentCleanups.size === 0 &&
      this.registeredEventCleanups.length === 0
    ) {
      return;
    }

    this.initialized = false;
    this.lifecycleGeneration += 1;

    try {
      this.clearInteractionState();
    } catch (error) {
      console.error("Property Order: failed to clear a drag interaction", error);
    }

    try {
      this.clearTrailingClickSuppression();
      this.reconciliation.dispose();
      this.editSession = null;
      this.keyboardDraft = null;
    } catch (error) {
      console.error("Property Order: failed to clear post-drag recovery state", error);
    } finally {
      const documentCleanups = Array.from(
        this.registeredDocumentCleanups.values(),
      ).reverse();
      this.registeredDocumentCleanups.clear();

      for (const cleanup of documentCleanups) {
        try {
          cleanup();
        } catch (error) {
          console.error("Property Order: failed to release a drag document resource", error);
        }
      }

      const eventCleanups = this.registeredEventCleanups.splice(0).reverse();

      for (const cleanup of eventCleanups) {
        try {
          cleanup();
        } catch (error) {
          console.error("Property Order: failed to release a drag host event", error);
        }
      }
    }
  };

  private registerDocumentEvents(targetDocument: Document): void {
    if (!this.initialized || this.registeredDocumentCleanups.has(targetDocument)) {
      return;
    }

    const targetWindow = targetDocument.defaultView;

    const handleWindowBlur = (): void => {
      this.userFocusIntentGeneration += 1;
      this.clearInteractionForDocument(targetDocument);
    };

    const cleanups: Array<() => void> = [];
    let disposed = false;

    const cleanup = (): void => {
      if (disposed) {
        return;
      }

      disposed = true;

      for (const release of cleanups.reverse()) {
        try {
          release();
        } catch (error) {
          console.error("Property Order: failed to release a drag document listener", error);
        }
      }

      if (this.registeredDocumentCleanups.get(targetDocument) === cleanup) {
        this.registeredDocumentCleanups.delete(targetDocument);
      }
    };

    // The owner must be discoverable by controller/plugin rollback before the
    // first host listener is attached. A later attachment failure can then
    // release every listener that was already installed on this document.
    this.registeredDocumentCleanups.set(targetDocument, cleanup);

    try {
      const registerDocumentEvent = <K extends keyof DocumentEventMap>(
        type: K,
        listener: (event: DocumentEventMap[K]) => void,
      ): void => {
        targetDocument.addEventListener(type, listener as EventListener, true);
        cleanups.push(() =>
          targetDocument.removeEventListener(type, listener as EventListener, true),
        );
      };

      registerDocumentEvent("pointerdown", this.handlePointerDown);
      registerDocumentEvent("pointermove", this.handlePointerMove);
      registerDocumentEvent("pointerup", this.handlePointerUpEvent);
      registerDocumentEvent("pointercancel", this.handlePointerCancel);
      registerDocumentEvent("click", this.handleTrailingClick);
      registerDocumentEvent("contextmenu", this.handleContextMenu);
      registerDocumentEvent("dragstart", this.handleNativeDragStart);
      registerDocumentEvent("drop", this.handleNativeDrop);
      registerDocumentEvent("keydown", this.handleKeyDown);

      if (targetWindow != null) {
        targetWindow.addEventListener("blur", handleWindowBlur);
        cleanups.push(() => targetWindow.removeEventListener("blur", handleWindowBlur));
      }
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  private unregisterDocumentEvents(targetDocument: Document): void {
    try {
      this.clearInteractionForDocument(targetDocument);
      this.reconciliation.clearForDocument(targetDocument);
      if (this.editSession?.document === targetDocument) this.editSession = null;
    } finally {
      this.registeredDocumentCleanups.get(targetDocument)?.();
    }
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

    if (this.trailingClickSuppression?.document === targetDocument) {
      this.clearTrailingClickSuppression();
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.userFocusIntentGeneration += 1;

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
    if (!this.isPointerEventFromInteractionDocument(event)) {
      return;
    }

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
    if (!this.isPointerEventFromInteractionDocument(event)) {
      return;
    }

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
      const targetDocument = event.currentTarget as Document | null;

      if (targetDocument != null) {
        this.armTrailingClickSuppression(
          targetDocument,
          event.clientX,
          event.clientY,
        );
      }

      this.clearTouchMoveCapture();
      await this.finishDrag(event.pointerId);
    }

    this.applyActions(actions.filter((action) => action.type !== "finish-drag"));
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (!this.isPointerEventFromInteractionDocument(event)) {
      return;
    }

    this.applyActions(this.transition({ type: "cancel", pointerId: event.pointerId }));
  };

  private isPointerEventFromInteractionDocument(event: PointerEvent): boolean {
    const interactionDocument =
      this.dragState?.document ?? this.pressedPill?.ownerDocument;

    return interactionDocument == null || event.currentTarget === interactionDocument;
  }

  private readonly handleTrailingClick = (event: MouseEvent): void => {
    const suppression = this.trailingClickSuppression;

    if (
      suppression == null ||
      event.currentTarget !== suppression.document ||
      Math.abs(event.clientX - suppression.clientX) > 4 ||
      Math.abs(event.clientY - suppression.clientY) > 4
    ) {
      return;
    }

    this.clearTrailingClickSuppression();
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    if (
      (this.mobileDirectPointerId != null &&
        this.interactionState.phase === "pressing") ||
      (this.interactionState.phase === "dragging" &&
        this.dragState?.pointerType === "touch")
    ) {
      event.preventDefault();
      if (this.mobileDirectPointerId != null) {
        event.stopPropagation();
      }
    }
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    if (this.mobileDirectPointerId != null) {
      event.preventDefault();
      event.stopPropagation();
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
    const timeoutId = this.mobileArmTimeoutId;
    const targetWindow = this.mobileArmWindow;
    this.mobileArmTimeoutId = null;
    this.mobileArmWindow = null;

    if (timeoutId != null) {
      this.runInteractionCleanup(() => targetWindow?.clearTimeout(timeoutId));
    }
  }

  private clearMobileArmState(): void {
    const armedPill = this.mobileArmedPill;
    this.mobileArmedPill = null;
    this.clearMobileArmTimer();

    if (armedPill != null) {
      this.runInteractionCleanup(() => {
        armedPill.classList.remove(MOBILE_REORDER_ARMED_CLASS);
      });
    }
  }

  private startTouchMoveCapture(targetDocument: Document): void {
    this.clearTouchMoveCapture();
    this.touchMoveDocument = targetDocument;
    targetDocument.addEventListener(
      "touchstart",
      this.handleTouchStart,
      TOUCH_MOVE_LISTENER_OPTIONS,
    );
    targetDocument.addEventListener(
      "touchmove",
      this.handleTouchMove,
      TOUCH_MOVE_LISTENER_OPTIONS,
    );
  }

  private clearTouchMoveCapture(): void {
    const targetDocument = this.touchMoveDocument;
    this.touchMoveDocument = null;

    if (targetDocument != null) {
      this.runInteractionCleanup(() => {
        targetDocument.removeEventListener(
          "touchstart",
          this.handleTouchStart,
          TOUCH_MOVE_LISTENER_OPTIONS,
        );
      });
      this.runInteractionCleanup(() => {
        targetDocument.removeEventListener(
          "touchmove",
          this.handleTouchMove,
          TOUCH_MOVE_LISTENER_OPTIONS,
        );
      });
    }
  }

  private armTrailingClickSuppression(
    targetDocument: Document,
    clientX: number,
    clientY: number,
  ): void {
    this.clearTrailingClickSuppression();
    const targetWindow = targetDocument.defaultView;

    if (targetWindow == null) {
      return;
    }

    const suppression: TrailingClickSuppression = {
      clientX,
      clientY,
      document: targetDocument,
      timeoutId: 0,
      window: targetWindow,
    };
    suppression.timeoutId = targetWindow.setTimeout(() => {
      if (this.trailingClickSuppression === suppression) {
        this.trailingClickSuppression = null;
      }
    }, 0);
    this.trailingClickSuppression = suppression;
  }

  private clearTrailingClickSuppression(): void {
    const suppression = this.trailingClickSuppression;
    this.trailingClickSuppression = null;

    if (suppression != null) {
      this.runInteractionCleanup(() =>
        suppression.window.clearTimeout(suppression.timeoutId),
      );
    }
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
    if (event.key === "Tab" || event.key === "F6") {
      this.userFocusIntentGeneration += 1;
    }

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
      !isSourceContextAlignedWithContent(context, expectedContent)
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

    const focusOwnerAtStart = targetDocument.activeElement;
    blurFocusedPropertyEditor(context.propertyElement);

    this.restoreNativeDragState ??= suppressNativeDrag(context.pill);
    this.clearMobileArmState();
    const previewElement = createPreviewElement(context.pill);
    const indicatorElement = createIndicatorElement(targetDocument.body);
    const statusElement = createDragStatusElement(targetDocument.body);
    announceDragStatus(statusElement, this.t("a11y.dragStarted"));
    targetDocument.body.append(previewElement);
    context.pill.classList.add("property-order-dragging");
    setDocumentDragCursorActive(targetDocument, true);

    this.dragState = {
      document: targetDocument,
      editor: paneContext.editor,
      expectedContent,
      file: paneContext.file,
      originalPath: paneContext.file.path,
      focusOwnerAtStart,
      focusIntentGeneration: this.userFocusIntentGeneration,
      generation: this.lifecycleGeneration,
      paneContainer: paneContext.container,
      paneView: paneContext.view,
      context,
      expectedStorageKinds: getCachedFrontmatterStorageKinds(this.plugin.app, paneContext.file),
      indicatorElement,
      invalidTarget: null,
      previewElement,
      statusElement,
      pointerId,
      pointerType: pressedPointerType,
      target: null,
    };
    this.editSession = this.dragState;
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

    const didAutoScroll = autoScrollDragContainer(
      dragState.paneContainer,
      this.pendingDragX,
      this.pendingDragY,
    );
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
    announceDragStatus(
      dragState.statusElement,
      target?.kind === "drop"
        ? this.t(
            target.mode === "move"
              ? "a11y.dragMoveTarget"
              : "a11y.dragReorderTarget",
          ).replace("{property}", () => target.context.propertyKey)
        : invalidTarget != null
          ? this.t("a11y.dragInvalidTarget")
          : this.t("a11y.dragNoTarget"),
    );

    if (didAutoScroll) {
      this.scheduleDragUpdate();
    }
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
        this.isEditSessionActive(dragState) &&
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

    await this.commitValueEdit(dragState, target);
  }

  private async commitValueEdit(dragState: ValueEditSession, target: DropTarget): Promise<boolean> {
    try {
      if (!this.isEditSessionActive(dragState)) {
        return false;
      }

      if (!this.isOriginalDocumentActive(dragState)) {
        new Notice(this.t("notice.activeFileChanged"));
        return false;
      }

      const currentContent = dragState.editor.getValue();

      if (
        !isSourceContextAlignedWithContent(dragState.context, currentContent) ||
        !isTargetContextAlignedWithContent(target.context, currentContent)
      ) {
        new Notice(this.t("notice.propertiesOutOfSync"));
        return false;
      }

      for (const propertyElement of new Set([
        dragState.context.propertyElement,
        target.context.propertyElement,
      ])) {
        blurFocusedPropertyEditor(propertyElement);
      }

      const writebackResult = await writePropertyValueDrop({
        canFinalize: () => this.isOriginalDocumentActive(dragState),
        canWrite: () =>
          this.isEditReadyForWrite(dragState, target),
        editor: dragState.editor,
        expectedContent: dragState.expectedContent,
        sourceContext: dragState.context,
        target,
        view: dragState.paneView,
        writebackFormat: this.getSettings().listWritebackFormat,
      });

      if (!this.isEditSessionOwned(dragState)) {
        return false;
      }

      if (writebackResult.status === "persistence-failed") {
        if (this.isOriginalDocumentActive(dragState)) {
          this.restoreEditorFocusAfterCommit(dragState, target);
          this.reconciliation.track(dragState, writebackResult);
        }
        new Notice(this.t("notice.persistenceFailed"));
        return true;
      }

      if (!this.isOriginalDocumentActive(dragState)) {
        new Notice(this.t("notice.activeFileChanged"));
        return false;
      }

      if (writebackResult.status === "conflict") {
        new Notice(this.t("notice.contentChanged"));
        return false;
      }

      if (writebackResult.status === "aborted") {
        return false;
      }

      if (writebackResult.status === "diagnostic") {
        this.maybeShowDiagnostic(writebackResult.messageKey);
        return false;
      }

      if (writebackResult.status === "failed") {
        new Notice(this.t("notice.reorderFailed"));
        return false;
      }

      if (writebackResult.status === "diverged") {
        new Notice(this.t("notice.writebackDiverged"));
        return false;
      }

      if (writebackResult.status === "written") {
        await this.reconciliation.finalize(dragState, target, writebackResult);
        this.reconciliation.track(dragState, writebackResult);
        return true;
      }
      return false;
    } catch (error) {
      if (this.isEditSessionOwned(dragState)) {
        console.error("Property Order: failed to write frontmatter", error);
        new Notice(this.t("notice.reorderFailed"));
      }
      return false;
    } finally {
      if (this.editSession === dragState) this.editSession = null;
      if (this.dragState === dragState) {
        this.clearInteractionState();
      }
    }
  }

  private restoreEditorFocusAfterCommit(dragState: ValueEditSession, target: DropTarget): void {
    if (
      dragState.restoreEditorFocus === false ||
      !this.isEditSessionOwned(dragState) ||
      !this.isOriginalDocumentActive(dragState) ||
      this.userFocusIntentGeneration !== dragState.focusIntentGeneration
    ) {
      return;
    }

    try {
      if (dragState.editor.hasFocus()) {
        return;
      }
    } catch (error) {
      console.warn("Property Order: failed to inspect the Markdown editor focus", error);
    }

    if (!this.canRestoreEditorFocus(dragState, target)) {
      return;
    }

    try {
      dragState.editor.focus();
    } catch (error) {
      console.warn("Property Order: failed to restore the Markdown editor focus", error);
    }
  }

  private canRestoreEditorFocus(dragState: ValueEditSession, target: DropTarget): boolean {
    const activeElement = dragState.document.activeElement;

    if (
      activeElement == null ||
      activeElement === dragState.document.body ||
      activeElement === dragState.document.documentElement ||
      activeElement === dragState.focusOwnerAtStart ||
      !activeElement.isConnected
    ) {
      return true;
    }

    const affectedPropertyElements = new Set<HTMLElement>([
      dragState.context.propertyElement,
      target.context.propertyElement,
    ]);

    for (const propertyKey of new Set([
      dragState.context.propertyKey,
      target.context.propertyKey,
    ])) {
      const propertyElement = findPropertyListContextByKey(
        dragState.paneContainer,
        propertyKey,
      )?.propertyElement;

      if (propertyElement != null) {
        affectedPropertyElements.add(propertyElement);
      }
    }

    return Array.from(affectedPropertyElements).some((propertyElement) =>
      propertyElement.contains(activeElement),
    );
  }

  private isOriginalDocumentActive(dragState: ValueEditSession): boolean {
    const currentPaneContext = resolvePaneFileContext(this.plugin, dragState.paneContainer);
    return (
      currentPaneContext?.view === dragState.paneView &&
      currentPaneContext?.editor === dragState.editor &&
      currentPaneContext.file === dragState.file &&
      isCurrentFileIdentity(this.plugin, dragState.file, dragState.originalPath)
    );
  }

  private isEditReadyForWrite(dragState: ValueEditSession, target: DropTarget): boolean {
    if (
      !this.isEditSessionActive(dragState) ||
      !this.isOriginalDocumentActive(dragState) ||
      !this.isTargetContextCurrent(dragState, target)
    ) {
      return false;
    }

    const currentContent = this.readExpectedContent(dragState.editor);

    return (
      currentContent != null &&
      isSourceContextAlignedWithContent(dragState.context, currentContent) &&
      isTargetContextAlignedWithContent(target.context, currentContent)
    );
  }

  private isEditSessionOwned(dragState: ValueEditSession): boolean {
    return (
      this.initialized &&
      this.lifecycleGeneration === dragState.generation &&
      this.editSession === dragState
    );
  }

  private isEditSessionActive(dragState: ValueEditSession): boolean {
    return this.isEditSessionOwned(dragState) && this.isSourceContextCurrent(dragState);
  }

  private isTargetContextCurrent(dragState: ValueEditSession, target: DropTarget): boolean {
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

  private isSourceContextCurrent(dragState: ValueEditSession): boolean {
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
    const restoreNativeDragState = this.restoreNativeDragState;
    this.restoreNativeDragState = null;
    this.pressedPill = null;
    this.pressedPointerType = null;
    this.mobileDirectPointerId = null;
    this.clearMobileArmState();

    if (restoreNativeDragState != null) {
      this.runInteractionCleanup(restoreNativeDragState);
    }
  }

  private clearInteractionState(): void {
    this.clearTouchLongPressTimer();
    this.clearTouchMoveCapture();

    const dragUpdateRafId = this.dragUpdateRafId;
    const dragUpdateWindow = this.dragUpdateWindow;
    this.dragUpdateRafId = null;
    this.dragUpdateWindow = null;

    if (dragUpdateRafId != null) {
      this.runInteractionCleanup(() => {
        dragUpdateWindow?.cancelAnimationFrame(dragUpdateRafId);
      });
    }

    this.pendingDragX = null;
    this.pendingDragY = null;

    const dragState = this.dragState;
    const restoreNativeDragState = this.restoreNativeDragState;
    this.dragState = null;
    if (this.editSession === dragState) this.editSession = null;
    this.restoreNativeDragState = null;
    this.pressedPill = null;
    this.pressedPointerType = null;
    this.mobileDirectPointerId = null;
    this.interactionState = createIdleDragInteractionState();

    if (dragState != null) {
      this.runInteractionCleanup(() => {
        updateInvalidDropTarget(dragState.document, dragState.invalidTarget, null);
      });
      this.runInteractionCleanup(() => {
        dragState.context.pill.classList.remove("property-order-dragging");
      });
      this.runInteractionCleanup(() => dragState.previewElement.remove());
      this.runInteractionCleanup(() => dragState.indicatorElement.remove());
      this.runInteractionCleanup(() => dragState.statusElement.remove());
      this.runInteractionCleanup(() => {
        setDocumentDragCursorActive(dragState.document, false);
      });
    }

    if (restoreNativeDragState != null) {
      this.runInteractionCleanup(restoreNativeDragState);
    }

    this.clearMobileArmState();
  }

  private runInteractionCleanup(cleanup: () => void): void {
    try {
      cleanup();
    } catch (error) {
      console.error("Property Order: failed to release a drag interaction resource", error);
    }
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
    const timeoutId = this.touchLongPressTimeoutId;
    const targetWindow = this.touchLongPressWindow;
    this.touchLongPressTimeoutId = null;
    this.touchLongPressWindow = null;

    if (timeoutId != null) {
      this.runInteractionCleanup(() => targetWindow?.clearTimeout(timeoutId));
    }
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
