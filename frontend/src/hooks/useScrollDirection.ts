/** Returns whether the user is scrolling down (hide chrome) vs up (show), with rAF throttling. */
import { useState, useEffect, useRef } from "react";

export function useScrollDirection(threshold = 10) {
  const [visible, setVisible] = useState(true);
  const lastScroll = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const current = window.scrollY;

        if (current <= 0) {
          setVisible(true);
        } else if (current > lastScroll.current + threshold) {
          setVisible(false);
        } else if (current < lastScroll.current - threshold) {
          setVisible(true);
        }

        lastScroll.current = current;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return visible;
}
