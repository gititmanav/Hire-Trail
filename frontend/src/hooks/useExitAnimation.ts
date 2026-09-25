/** Exit motion for overlays that React unmounts outright — dialogs, the
 *  command palette. Call sites render them conditionally (`{open && <X/>}`),
 *  so there is no moment where the element could play an exit before it
 *  disappears. This covers every such overlay from the inside, with no
 *  call-site changes:
 *
 *  Put the returned ref on the overlay's root. As React removes it, an inert,
 *  static copy (a "ghost") takes its place — same parent and position, same
 *  scroll offsets, current form values — plays `exitClass`, then is deleted.
 *  The ghost has no React behind it: it can't be clicked, focused, or read by
 *  screen readers, and it carries no ids.
 *
 *  Why this works: React detaches refs before it removes the DOM, so the node
 *  is still there to copy. Anything that detaches the ref *without* removing
 *  the node (StrictMode's simulated unmount, a Suspense hide) leaves it
 *  attached — the copy is only inserted if the node is really gone by the
 *  next microtask. Skipped for prefers-reduced-motion. */
import { useCallback, useRef } from "react";
import { EXIT_MS, prefersReducedMotion } from "../utils/motion.ts";

interface ExitOptions {
  /** Class on the ghost's root that plays the exit (App.css `.modal-exit`). */
  exitClass: string;
  /** Entrance-animation classes to strip, so the ghost doesn't replay them. */
  entryClasses?: string[];
}

/** Index path from `root` to `node`, to find the same node inside a clone. */
function pathTo(root: Element, node: Element): number[] {
  const path: number[] = [];
  let n: Element | null = node;
  while (n && n !== root) {
    const parent: Element | null = n.parentElement;
    if (!parent) break;
    path.unshift(Array.prototype.indexOf.call(parent.children, n));
    n = parent;
  }
  return path;
}

function follow(root: Element, path: number[]): Element | null {
  let n: Element | null = root;
  for (const i of path) n = n?.children[i] ?? null;
  return n;
}

function leaveGhost(el: HTMLElement, { exitClass, entryClasses = [] }: ExitOptions) {
  if (prefersReducedMotion()) return;
  const parent = el.parentNode;
  const next = el.nextSibling;
  if (!parent) return;
  // Read scroll offsets now — a detached clone has none to copy.
  const scrolled: { path: number[]; top: number; left: number }[] = [];
  for (const n of [el, ...el.querySelectorAll("*")]) {
    if (n.scrollTop || n.scrollLeft) scrolled.push({ path: pathTo(el, n), top: n.scrollTop, left: n.scrollLeft });
  }
  const ghost = el.cloneNode(true) as HTMLElement;
  queueMicrotask(() => {
    if (el.isConnected || !parent.isConnected) return; // not a real removal
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("inert", "");
    ghost.style.pointerEvents = "none";
    // Ids must stay unique for whatever mounts next.
    for (const n of [ghost, ...ghost.querySelectorAll("[id]")]) n.removeAttribute("id");
    for (const c of entryClasses) {
      ghost.classList.remove(c);
      for (const n of ghost.querySelectorAll(`.${c}`)) n.classList.remove(c);
    }
    ghost.classList.add(exitClass);
    parent.insertBefore(ghost, next && next.parentNode === parent ? next : null);
    for (const s of scrolled) {
      const n = s.path.length ? follow(ghost, s.path) : ghost;
      if (n) { n.scrollTop = s.top; n.scrollLeft = s.left; }
    }
    window.setTimeout(() => ghost.remove(), EXIT_MS + 60);
  });
}

/** Returns a stable ref callback for the overlay's root element. */
export function useExitAnimation<T extends HTMLElement = HTMLDivElement>(options: ExitOptions): (el: T | null) => void {
  const current = useRef<T | null>(null);
  const opts = useRef(options);
  opts.current = options;
  return useCallback((el: T | null) => {
    if (el) { current.current = el; return; }
    const prev = current.current;
    current.current = null;
    if (prev) leaveGhost(prev, opts.current);
  }, []);
}

/** The exit every dialog-shaped overlay uses: backdrop fades, panel
 *  ([role=dialog] or [data-modal-panel]) fades + settles down. */
export const MODAL_EXIT: ExitOptions = { exitClass: "modal-exit", entryClasses: ["modal-overlay-in", "animate-in"] };
