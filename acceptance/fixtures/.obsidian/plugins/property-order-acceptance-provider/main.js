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
    this.conditionEvents = [];
    this.saveDelayCleanup = null;
    this.languageTimerCleanup = null;
    this.foreignPointerCleanup = null;
    this.observationTimers = new Map();
    this.observationIds = new WeakMap();
    this.nextObservationId = 1;

    this.addCommand({
      id: "arm-next-settings-save-delay",
      name: "Acceptance: delay next settings save for 20 seconds",
      callback: () => this.armSettingsSaveDelay(),
    });
    for (const [id, delay] of [["capture-settings-geometry", 10_000], ["schedule-readonly-snapshot", 3_000]]) {
      this.addCommand({
        id,
        name: `Acceptance: read UI geometry and state in ${delay / 1000} seconds`,
        callback: () => this.scheduleObservation(delay),
      });
    }
    this.addCommand({
      id: "arm-foreign-pointer-condition",
      name: "Acceptance: inject foreign-window pointer release during next drag",
      callback: () => this.armForeignPointerCondition(),
    });
    this.addCommand({
      id: "export-condition-events",
      name: "Acceptance: export controlled-condition events",
      callback: () => this.exportConditionEvents(),
    });
    for (const language of ["en", "zh-CN"]) {
      this.addCommand({
        id: `schedule-language-${language}`,
        name: `Acceptance: switch language to ${language} in 10 seconds`,
        callback: () => this.scheduleLanguage(language),
      });
    }
    this.register(() => {
      for (const [timer, window] of this.observationTimers) window.clearTimeout(timer);
      this.observationTimers.clear();
      this.foreignPointerCleanup?.();
      this.saveDelayCleanup?.("unloaded");
      this.languageTimerCleanup?.();
    });

    const prepareKeyTypeGrouping = async () => {
      const plugin = this.app.plugins?.getPlugin?.("property-order");
      if (plugin == null) return;
      Object.assign(plugin.propertyOrderSettings, {
        enableNativeKeySuggestionOrder: true,
        groupKeySuggestionsByType: true,
        keySuggestionSortMode: "name",
        pinnedPropertyKeys: ["tags"],
        bottomPropertyKeys: ["key_bottom"],
        hiddenPropertyKeyPatterns: ["key_hidden"],
      });
      await plugin.saveSettings(true, false);
      new Notice("Acceptance provider: key type grouping prepared.");
    };

    const applyGroupedValueSettings = async ({
      assignments,
      customOrders = [],
      notice,
      resetFrequency = false,
    }) => {
      const plugin = this.app.plugins.getPlugin("property-order");
      if (plugin == null) return;
      Object.assign(plugin.propertyOrderSettings, {
        enableNativeValueSuggestionOrder: true,
        valueSuggestionDefaultBehavior: "native",
        valueSuggestionPropertyAssignments: assignments,
        valueSuggestionCustomOrders: customOrders,
        valueSuggestionKeyDisplayOrder: "name",
        valueSuggestionLegacyMigrationPending: false,
      });
      if (resetFrequency) {
        plugin.clearPropertyValueFrequency?.();
      }
      await plugin.saveSettings(false, true);
      new Notice(notice);
    };
    const customStatusOrder = {
      propertyKey: "status",
      pinnedValues: ["planned", "draft"],
      middleValues: [],
      bottomValues: ["archived", "deferred"],
      middleSortMode: "name",
    };
    const prepareValueRules = () =>
      applyGroupedValueSettings({
        assignments: [
          { propertyKey: "status", behavior: "custom" },
          { propertyKey: "priority", behavior: "frequency" },
        ],
        customOrders: [customStatusOrder],
        notice: "Acceptance provider: grouped value behaviors prepared.",
        resetFrequency: true,
      });
    const prepareNoneRule = () =>
      applyGroupedValueSettings({
        assignments: [
          { propertyKey: "status", behavior: "none" },
          { propertyKey: "priority", behavior: "frequency" },
        ],
        customOrders: [customStatusOrder],
        notice: "Acceptance provider: status no-suggestions behavior prepared.",
      });
    const restoreValueRules = () =>
      applyGroupedValueSettings({
        assignments: [
          { propertyKey: "status", behavior: "custom" },
          { propertyKey: "priority", behavior: "frequency" },
        ],
        customOrders: [customStatusOrder],
        notice: "Acceptance provider: grouped value behaviors restored.",
      });
    this.addCommand({
      id: "prepare-key-type-grouping",
      name: "Acceptance: prepare key type grouping",
      callback: prepareKeyTypeGrouping,
    });
    this.addRibbonIcon(
      "list-tree",
      "Acceptance: prepare key type grouping",
      prepareKeyTypeGrouping,
    );

    this.addCommand({
      id: "prepare-value-rules",
      name: "Acceptance: prepare grouped value behaviors",
      callback: prepareValueRules,
    });
    this.addRibbonIcon("list-filter", "Acceptance: prepare grouped value behaviors", prepareValueRules);
    this.addCommand({
      id: "prepare-none-rule",
      name: "Acceptance: prepare status no-suggestions behavior",
      callback: prepareNoneRule,
    });
    this.addRibbonIcon("eye-off", "Acceptance: prepare no-suggestions behavior", prepareNoneRule);
    this.addCommand({
      id: "restore-value-rules",
      name: "Acceptance: restore grouped value behaviors",
      callback: restoreValueRules,
    });
    this.addRibbonIcon("rotate-ccw", "Acceptance: restore grouped value behaviors", restoreValueRules);

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

  recordCondition(event, details = {}) {
    const observation = /settings save (delay (started|released)|completed)|language .* (applied|saved)/u.test(event)
      ? this.readUiObservation() : undefined;
    this.conditionEvents.push({ event, at: Date.now(), observation, ...details });
    new Notice(`Acceptance provider: ${event}`);
  }

  observationId(element) {
    if (element == null) return null;
    if (!this.observationIds.has(element)) this.observationIds.set(element, this.nextObservationId++);
    return this.observationIds.get(element);
  }

  readUiObservation() {
    const fixture = this.resolveConditionFixture();
    if (fixture == null) return null;
    const documents = new Set([fixture.window.document]);
    // Settings can live in a detached host window without a workspace leaf.
    const settingsDocument = this.app.setting?.containerEl?.ownerDocument;
    if (settingsDocument) documents.add(settingsDocument);
    this.app.workspace.iterateAllLeaves?.((leaf) => {
      const document = leaf.view.containerEl?.ownerDocument;
      if (document) documents.add(document);
    });
    const rect = (element) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
    };
    return Array.from(documents, (document) => {
      const window = document.defaultView;
      const bar = document.querySelector('.property-order-settings-tabs[role="tablist"]');
      const activeTab = bar?.querySelector(".property-order-settings-tab.is-active");
      const root = bar?.parentElement;
      const focused = document.activeElement;
      const field = (element) => ({
        nodeId: this.observationId(element),
        tag: element?.tagName,
        id: element?.id,
        className: element?.className,
        value: element?.value,
        selectionStart: element?.selectionStart,
        selectionEnd: element?.selectionEnd,
      });
      const menus = Array.from(document.querySelectorAll(
        ".suggestion-container.mod-property-key, .suggestion.mod-property-key, .menu.mod-property-key",
      )).map((menu) => {
        const candidates = Array.from(menu.querySelectorAll(".suggestion-item, .menu-item"));
        return {
          nodeId: this.observationId(menu),
          candidateCount: candidates.length,
          candidates: candidates.map((candidate) => ({ nodeId: this.observationId(candidate), text: candidate.textContent })),
          headings: Array.from(menu.querySelectorAll(".property-order-suggestion-type-group-label"), (element) => element.textContent),
        };
      });
      return {
        documentId: this.observationId(document),
        title: document.title,
        innerWidth: window?.innerWidth,
        focused: field(focused),
        settingsFields: root ? Array.from(root.querySelectorAll("input, textarea, select"), field) : [],
        selectedProperty: root?.querySelector(".property-order-custom-value-key.is-active")?.textContent ?? null,
        menus,
        tabBar: bar ? {
          direction: window?.getComputedStyle(bar).direction,
          scrollLeft: bar.scrollLeft,
          clientWidth: bar.clientWidth,
          scrollWidth: bar.scrollWidth,
          barRect: rect(bar),
          activeTabRect: rect(activeTab),
          tabs: Array.from(bar.querySelectorAll('[role="tab"]'), (tab) => ({
            text: tab.textContent, ariaSelected: tab.getAttribute("aria-selected"), rect: rect(tab),
          })),
        } : null,
      };
    });
  }

  scheduleObservation(delay) {
    const fixture = this.resolveConditionFixture();
    if (fixture == null) return;
    const timer = fixture.window.setTimeout(() => {
      this.observationTimers.delete(timer);
      this.recordCondition("read-only UI observation", { observation: this.readUiObservation() });
    }, delay);
    this.observationTimers.set(timer, fixture.window);
    this.recordCondition(`read-only UI observation scheduled in ${delay / 1000} seconds`);
  }

  resolveConditionFixture() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!["Property Order.md", "Value Suggestions.md", "Key Suggestions.md"].includes(view?.file?.path)) {
      return null;
    }
    const plugin = this.app.plugins?.getPlugin?.("property-order");
    const window = view.containerEl?.ownerDocument.defaultView;
    return plugin && window ? { plugin, window } : null;
  }

  armSettingsSaveDelay() {
    const fixture = this.resolveConditionFixture();
    if (fixture == null || typeof fixture.plugin.saveData !== "function") return;
    this.saveDelayCleanup?.("rearmed");
    const { plugin, window } = fixture;
    const original = plugin.saveData;
    const hadOwn = Object.prototype.hasOwnProperty.call(plugin, "saveData");
    let release = null;
    let timer = null;
    let used = false;
    const restore = () => {
      if (plugin.saveData !== wrapper) return;
      if (hadOwn) plugin.saveData = original;
      else delete plugin.saveData;
    };
    const cleanup = (reason) => {
      if (timer != null) window.clearTimeout(timer);
      restore();
      release?.();
      release = null;
      if (this.saveDelayCleanup === cleanup) this.saveDelayCleanup = null;
      this.recordCondition(`settings save delay ${reason}`);
    };
    const wrapper = async (...args) => {
      if (used) return original.apply(plugin, args);
      used = true;
      window.clearTimeout(timer);
      this.recordCondition("settings save delay started");
      await new Promise((resolve) => {
        release = resolve;
        timer = window.setTimeout(() => cleanup("released"), 20_000);
      });
      try {
        const result = await original.apply(plugin, args);
        this.recordCondition("settings save completed");
        return result;
      } catch (error) {
        this.recordCondition("settings save failed");
        throw error;
      }
    };
    plugin.saveData = wrapper;
    this.saveDelayCleanup = cleanup;
    timer = window.setTimeout(() => cleanup("expired unused"), ARM_TIMEOUT_MS);
    this.recordCondition("settings save delay armed");
  }

  scheduleLanguage(language) {
    const fixture = this.resolveConditionFixture();
    if (fixture == null) return;
    this.languageTimerCleanup?.();
    const { plugin, window } = fixture;
    const timer = window.setTimeout(() => {
      this.languageTimerCleanup = null;
      // Set a fixture condition through the same settings boundary as the UI.
      // Candidate selection and subsequent menu interaction remain manual.
      this.recordCondition("language before change", { observation: this.readUiObservation() });
      plugin.propertyOrderSettings.language = language;
      this.recordCondition(`language ${language} applied`);
      void plugin.saveSettings(true, true).then(
        () => this.recordCondition(`language ${language} saved`),
        () => this.recordCondition(`language ${language} save failed`),
      );
    }, 10_000);
    this.languageTimerCleanup = () => {
      window.clearTimeout(timer);
      this.languageTimerCleanup = null;
      this.recordCondition("pending language change cancelled");
    };
    this.recordCondition(`language ${language} scheduled`);
  }

  armForeignPointerCondition() {
    this.foreignPointerCleanup?.();
    const fixture = this.resolveFixture();
    if (fixture == null) return;
    const sourceDocument = fixture.document;
    const sourceWindow = sourceDocument.defaultView;
    let targetDocument = null;
    this.app.workspace.iterateAllLeaves?.((leaf) => {
      const candidate = leaf.view.containerEl?.ownerDocument;
      if (candidate && candidate !== sourceDocument && candidate.defaultView) targetDocument ??= candidate;
    });
    if (sourceWindow == null || targetDocument == null) {
      this.recordCondition("foreign pointer refused: second workspace document required");
      return;
    }
    let frame = null;
    let timeout = null;
    let active = true;
    const cleanup = () => {
      active = false;
      sourceDocument.removeEventListener("pointermove", onMove, true);
      if (frame != null) sourceWindow.cancelAnimationFrame(frame);
      if (timeout != null) sourceWindow.clearTimeout(timeout);
      if (this.foreignPointerCleanup === cleanup) this.foreignPointerCleanup = null;
    };
    const onMove = (event) => {
      if (!active || frame != null) return;
      frame = sourceWindow.requestAnimationFrame(() => {
        frame = null;
        if (!active || fixture.view.containerEl.querySelector(".property-order-dragging") == null) return;
        const targetWindow = targetDocument.defaultView;
        if (!targetWindow || targetWindow.closed || typeof targetWindow.PointerEvent !== "function") {
          cleanup();
          this.recordCondition("foreign pointer refused: target window unavailable");
          return;
        }
        cleanup();
        for (const type of ["pointerup", "pointercancel"]) {
          const foreignEvent = new targetWindow.PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            clientX: event.clientX,
            clientY: event.clientY,
          });
          targetDocument.dispatchEvent(foreignEvent);
          this.recordCondition(`foreign ${type} injected`, {
            synthetic: true,
            isTrusted: foreignEvent.isTrusted === true,
            sourceEventTrusted: event.isTrusted === true,
            pointerId: event.pointerId,
            sourceTitle: sourceDocument.title,
            targetTitle: targetDocument.title,
            distinctDocuments: sourceDocument !== targetDocument,
            sourceDragActiveAfter: fixture.view.containerEl.querySelector(".property-order-dragging") != null,
          });
        }
      });
    };
    sourceDocument.addEventListener("pointermove", onMove, true);
    timeout = sourceWindow.setTimeout(() => {
      cleanup();
      this.recordCondition("foreign pointer arm expired unused");
    }, ARM_TIMEOUT_MS);
    this.foreignPointerCleanup = cleanup;
    this.recordCondition("foreign pointer condition armed: synthetic target release only");
  }

  async exportConditionEvents() {
    if (this.resolveConditionFixture() == null) return;
    const path = "Acceptance Conditions.json";
    const kind = "property-order-acceptance-conditions";
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing) {
      let previous;
      try { previous = JSON.parse(await this.app.vault.read(existing)); }
      catch { this.recordCondition("condition export refused: existing file is not a receipt"); return; }
      if (previous.kind !== kind) {
        this.recordCondition("condition export refused: existing file is not a receipt");
        return;
      }
    }
    const content = JSON.stringify({ kind, events: this.conditionEvents }, null, 2) + "\n";
    if (existing) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
    new Notice("Acceptance provider: condition events exported; no acceptance result assigned.");
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
