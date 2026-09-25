/** Where a public page (the landing, About, Privacy, Terms) opens. These pages
 *  scroll the document, outside the app shell's own scroll management, so
 *  without this a link from far down the landing would open the next page at
 *  that same depth. A forward navigation lands at the top — or at the section
 *  its #hash names; back/forward keeps the position the browser restores. */
import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { appScrollRoot } from "../utils/scrollRoot.ts";

export function usePageEntryScroll() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const first = useRef(true);

  useLayoutEffect(() => {
    const isFirst = first.current;
    first.current = false;
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      // A fresh load with a #hash: the browser looked for it before React drew it.
      if (navigationType !== "POP" || isFirst) target.scrollIntoView({ block: "start" });
      return;
    }
    if (navigationType !== "POP") appScrollRoot().scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash]);
}
