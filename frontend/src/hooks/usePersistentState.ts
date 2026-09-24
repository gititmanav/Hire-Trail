/** useState backed by localStorage, validated on read so a stale or
 *  hand-edited value can never put the UI in an impossible state. */
import { useCallback, useState } from "react";

export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (v: unknown) => v is T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      let parsed: unknown = raw; // pre-JSON values were stored as bare strings
      try { parsed = JSON.parse(raw); } catch { /* keep the raw string */ }
      return isValid(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode / quota */ }
  }, [key]);
  return [value, set];
}

/** Guard factory for string unions: `oneOf(["a", "b"] as const)`. */
export function oneOf<T extends string>(allowed: readonly T[]) {
  return (v: unknown): v is T => typeof v === "string" && (allowed as readonly string[]).includes(v);
}

export const isBoolean = (v: unknown): v is boolean => typeof v === "boolean";
