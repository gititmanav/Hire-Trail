/** The app shell scrolls inside its main card (Layout), not the window — the
 *  header and sidebar stay put and the card is the scroll container. Anything
 *  that reads or sets the page's scroll position goes through here. The
 *  admin shell is built the same way; outside both (landing, settings) it
 *  falls back to the document. */
export const APP_SCROLL_ID = "app-scroll";

export function appScrollRoot(): HTMLElement {
  return document.getElementById(APP_SCROLL_ID)
    ?? (document.scrollingElement as HTMLElement | null)
    ?? document.documentElement;
}
