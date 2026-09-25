/** React bindings for the scroll engine. */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { onScrolled, onTone, prefersReducedMotion, registerScene, type ProgressFn, type SceneMode, type Tone } from "./scroll.ts";

/** Drive a scene from scroll. `onProgress` may change every render — the
 *  latest one is always called, and it should write to the DOM directly. */
export function useScene(
  ref: RefObject<HTMLElement>,
  mode: SceneMode,
  onProgress: ProgressFn,
  stageRef?: RefObject<HTMLElement>,
) {
  const fn = useRef(onProgress);
  fn.current = onProgress;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerScene(el, {
      mode,
      stage: stageRef?.current ?? null,
      onProgress: (p, px, span) => fn.current(p, px, span),
    });
  }, [ref, mode, stageRef]);
}

/** The tone under the header — changes only at chapter boundaries. */
export function useTone(): Tone {
  const [tone, setTone] = useState<Tone>("dark");
  useEffect(() => onTone(setTone), []);
  return tone;
}

export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onScrolled(setScrolled), []);
  return scrolled;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
