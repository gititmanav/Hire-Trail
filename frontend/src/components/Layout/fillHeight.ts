/** Views that own their height (the calendar, the Desk) ask the shell for it:
 *  the main card becomes a flex column and the page never scrolls — the view
 *  fills the card and scrolls inside itself. Set in a layout effect, so the
 *  first paint is already right. */
import { createContext, useContext, useLayoutEffect } from "react";

export const FillHeightContext = createContext<(delta: 1 | -1) => void>(() => {});

export function useFillHeight(on: boolean) {
  const claim = useContext(FillHeightContext);
  useLayoutEffect(() => {
    if (!on) return;
    claim(1);
    return () => claim(-1);
  }, [on, claim]);
}
