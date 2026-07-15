import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stopped changing for `delayMs` milliseconds.
 * Used for search-as-you-type — we don't want to hit the DB on every
 * keystroke, but a 200–300ms debounce feels instantaneous while cutting
 * request volume by ~5×.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
