/** Single-key page shortcuts with the app's shared rules baked in: never while
 *  typing, never with a modifier, never while a dialog/menu layer is open,
 *  never while a global "g …" / "n …" sequence is waiting for its second key. */
import { useEffect, useRef } from "react";
import { layerCount } from "../components/ui/layers.ts";
import { isShortcutSequencePending } from "../components/GlobalShortcuts/GlobalShortcuts.tsx";

export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

/** `handlers` maps `KeyboardEvent.key` → action. Return `false` from an action
 *  to let the key through (not handled). */
export function usePageShortcuts(handlers: Record<string, (e: KeyboardEvent) => void | false>, enabled = true) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(document.activeElement)) return;
      if (layerCount() > 0 || isShortcutSequencePending()) return;
      const fn = ref.current[e.key];
      if (!fn) return;
      if (fn(e) !== false) e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
