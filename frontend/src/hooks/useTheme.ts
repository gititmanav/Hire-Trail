/**
 * `dark` class on `<html>`, persisted in localStorage; toggle uses a clip-path circle reveal.
 */
import { useState, useEffect, useCallback, useRef } from "react";

export function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("hiretrail-theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("hiretrail-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("hiretrail-theme", "light");
    }
  }, [dark]);

  const toggle = useCallback((e?: React.MouseEvent) => {
    const x = e ? e.clientX : window.innerWidth - 60;
    const y = e ? e.clientY : 30;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999; pointer-events: none;
      background: ${dark ? "#f0f2f5" : "#111827"};
      clip-path: circle(0px at ${x}px ${y}px);
      transition: clip-path 0.4s ease-out;
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;
    });

    setTimeout(() => {
      setDark((d) => !d);
      setTimeout(() => {
        overlay.remove();
      }, 50);
    }, 400);
  }, [dark]);

  return { dark, toggle };
}
