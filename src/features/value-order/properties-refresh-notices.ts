import { Notice } from "obsidian";
import type { TranslationKey } from "../../shared/i18n";
import type { PropertiesRefreshRecoveryContext, PropertiesRefreshRetryResult } from "./value-edit-session";

interface PropertiesRefreshNoticeState {
  document: Document;
  notice: Notice;
  releaseButton: () => void;
}

/** Owns only pane-local recovery messages and their event-listener lifetime. */
export class PropertiesRefreshNotices {
  private readonly propertiesRefreshNotices = new Map<HTMLElement, PropertiesRefreshNoticeState>();

  constructor(
    private readonly t: (key: TranslationKey) => string,
    private readonly retry: (context: PropertiesRefreshRecoveryContext) => Promise<PropertiesRefreshRetryResult>,
  ) {}

  show(context: PropertiesRefreshRecoveryContext): void {
    this.clear(context.paneContainer);
    const notice = new Notice(this.t("notice.propertiesRefreshNeeded"), 0);
    const button = notice.messageEl.createEl("button", {
      cls: ["mod-cta", "property-order-notice-action"],
      text: this.t("notice.propertiesRefreshAction"),
    });
    button.type = "button";

    const handleClick = (): void => {
      button.disabled = true;
      void this.retry(context)
        .then((result) => {
          if (
            this.propertiesRefreshNotices.get(context.paneContainer)?.notice !== notice
          ) {
            return;
          }

          if (result === "refreshed") {
            this.clear(context.paneContainer);
            new Notice(this.t("notice.propertiesRefreshSucceeded"));
            return;
          }

          const messageKey =
            result === "diverged"
              ? "notice.writebackDiverged"
              : result === "stale"
                ? "notice.activeFileChanged"
                : "notice.propertiesRefreshFailed";
          this.releasePropertiesRefreshButton(context.paneContainer, notice);
          notice.setMessage(this.t(messageKey));
        })
        .catch((error: unknown) => {
          console.error("Property Order: failed to retry the Properties refresh", error);

          if (
            this.propertiesRefreshNotices.get(context.paneContainer)?.notice === notice
          ) {
            this.releasePropertiesRefreshButton(context.paneContainer, notice);
            notice.setMessage(this.t("notice.propertiesRefreshFailed"));
          }
        });
    };

    button.addEventListener("click", handleClick, { once: true });
    this.propertiesRefreshNotices.set(context.paneContainer, {
      document: context.document,
      notice,
      releaseButton: () => button.removeEventListener("click", handleClick),
    });
  }

  private releasePropertiesRefreshButton(
    paneContainer: HTMLElement,
    notice: Notice,
  ): void {
    const state = this.propertiesRefreshNotices.get(paneContainer);

    if (state?.notice === notice) {
      state.releaseButton();
    }
  }

  clear(paneContainer: HTMLElement): void {
    const state = this.propertiesRefreshNotices.get(paneContainer);
    this.propertiesRefreshNotices.delete(paneContainer);

    if (state == null) {
      return;
    }

    this.cleanup(state.releaseButton);
    this.cleanup(() => state.notice.hide());
  }

  clearForDocument(targetDocument: Document): void {
    for (const [paneContainer, state] of this.propertiesRefreshNotices) {
      if (state.document === targetDocument) {
        this.clear(paneContainer);
      }
    }
  }

  pruneDisconnected(): void {
    for (const paneContainer of Array.from(this.propertiesRefreshNotices.keys())) {
      if (!paneContainer.isConnected) {
        this.clear(paneContainer);
      }
    }
  }

  clearAll(): void {
    for (const paneContainer of Array.from(this.propertiesRefreshNotices.keys())) {
      this.clear(paneContainer);
    }
  }


  private cleanup(release: () => void): void {
    try { release(); } catch (error) {
      console.error("Property Order: failed to release a Properties notice", error);
    }
  }
}
