import { Menu } from "obsidian";

export interface MobileReorderMenuOptions {
  event: MouseEvent;
  onSelect: () => void;
  title: string;
}

/**
 * Extends the menu already associated with this context-menu event. It never
 * renders or mutates a look-alike menu, and fails open when the host cannot
 * provide a shared menu instance.
 */
export function addMobileReorderMenuItem({
  event,
  onSelect,
  title,
}: MobileReorderMenuOptions): boolean {
  if (typeof Menu.forEvent !== "function") {
    return false;
  }

  try {
    Menu.forEvent(event).addItem((item) => {
      item
        .setTitle(title)
        .setIcon("move")
        .onClick(onSelect);
    });
    return true;
  } catch (error) {
    console.debug("Property Order: native property value menu is unavailable", error);
    return false;
  }
}
