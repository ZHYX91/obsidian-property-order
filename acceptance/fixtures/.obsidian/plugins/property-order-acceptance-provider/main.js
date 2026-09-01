"use strict";

const { MarkdownView, Notice, Plugin } = require("obsidian");

const FIXTURE_PATH = "Property Order.md";
const SOURCE_PROPERTY = "po_source";
const CONFLICT_PROPERTY = "po_target";
const CONFLICT_VALUE = "po_target: [blocked]";
const ARM_TIMEOUT_MS = 30_000;

module.exports = class PropertyOrderAcceptanceProvider extends Plugin {
  onload() {
    this.conflictCleanup = null;

    this.addCommand({
      id: "open-first-source-value-menu",
      name: "Acceptance: open first source value menu",
      checkCallback: (checking) => {
        const target = this.resolveFirstSourceValue();
        if (target == null) return false;
        if (!checking) this.openNativeContextMenu(target);
        return true;
      },
    });

    this.addCommand({
      id: "arm-next-drag-conflict",
      name: "Acceptance: change target during next drag",
      callback: () => this.armActiveFixtureConflict(),
    });

    this.addRibbonIcon(
      "shield-alert",
      "Acceptance: change target during next drag",
      () => this.armActiveFixtureConflict(),
    );

    this.register(() => this.clearConflictArm());
  }

  resolveFixture() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file?.path !== FIXTURE_PATH || view.containerEl == null || view.editor == null) {
      return null;
    }
    return { document: view.containerEl.ownerDocument, editor: view.editor, view };
  }

  resolveFirstSourceValue() {
    const fixture = this.resolveFixture();
    if (fixture == null) return null;
    const rows = Array.from(
      fixture.view.containerEl.querySelectorAll(".metadata-container .metadata-property"),
    ).filter((row) => this.readPropertyKey(row) === SOURCE_PROPERTY);
    if (rows.length !== 1) return null;
    const pills = rows[0].querySelectorAll(".multi-select-container .multi-select-pill");
    return pills.length > 0 ? pills[0] : null;
  }

  readPropertyKey(row) {
    const input = row.querySelector(
      ".metadata-property-key input, .metadata-property-key textarea",
    );
    const visible = input?.value ?? row.getAttribute("data-property-key") ?? "";
    return visible.trim();
  }

  openNativeContextMenu(pill) {
    const target = pill.querySelector(".multi-select-pill-content") ?? pill;
    const targetWindow = pill.ownerDocument.defaultView;
    if (targetWindow == null) {
      new Notice("Acceptance provider: fixture window is unavailable.");
      return;
    }
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new targetWindow.MouseEvent("contextmenu", {
      bubbles: true,
      button: 2,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      composed: true,
      view: targetWindow,
    }));
  }

  armActiveFixtureConflict() {
    const fixture = this.resolveFixture();
    if (fixture == null) {
      new Notice("Acceptance provider: Property Order fixture is unavailable.");
      return;
    }
    this.armNextDragConflict(fixture);
  }

  armNextDragConflict(fixture) {
    this.clearConflictArm();
    let active = true;
    let timeoutId = null;
    const handlePointerMove = () => {
      if (!active) return;
      if (fixture.view.containerEl.querySelector(".property-order-dragging") == null) return;
      this.clearConflictArm();
      const content = fixture.editor.getValue();
      const matches = Array.from(content.matchAll(/^po_target:[^\r\n]*$/gmu));
      if (matches.length !== 1 || matches[0].index == null) {
        new Notice("Acceptance provider: target fixture is not unique.");
        return;
      }
      const match = matches[0][0];
      const start = matches[0].index;
      const nextContent = content.slice(0, start) + CONFLICT_VALUE +
        content.slice(start + match.length);
      fixture.view.setViewData(nextContent, false);
      fixture.view.requestSave();
      new Notice("Acceptance provider: concurrent target change injected.");
    };
    fixture.document.addEventListener("pointermove", handlePointerMove, true);
    timeoutId = fixture.document.defaultView?.setTimeout(() => {
      this.clearConflictArm();
      new Notice("Acceptance provider: concurrent change arm expired.");
    }, ARM_TIMEOUT_MS) ?? null;
    this.conflictCleanup = () => {
      active = false;
      fixture.document.removeEventListener("pointermove", handlePointerMove, true);
      if (timeoutId != null) fixture.document.defaultView?.clearTimeout(timeoutId);
    };
    new Notice(`Acceptance provider: ${CONFLICT_PROPERTY} will change during the next drag.`);
  }

  clearConflictArm() {
    const cleanup = this.conflictCleanup;
    this.conflictCleanup = null;
    cleanup?.();
  }
};
