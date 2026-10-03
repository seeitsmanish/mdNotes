/**
 * One-at-a-time actions (PRD §4.25).
 *
 * A button that starts a network call could be pressed again before the first
 * call answered — and "New note" pressed three times made three notes. Every
 * such action runs through a gate keyed by what it does: while a key is in
 * flight, another run with that key is ignored, not queued. The gate also
 * reports what is in flight, so the UI can show it, and turns a failure into
 * a report instead of a silent unhandled rejection.
 *
 * Pure: no React, no DOM. The shell wraps it in state.
 */

export interface Gate {
  /**
   * Run `action` under `key` unless that key is already running. Resolves to
   * the action's result, or undefined when it was skipped or failed.
   */
  run<T>(key: string, action: () => Promise<T>): Promise<T | undefined>;
  has(key: string): boolean;
  /** Keys currently in flight. */
  keys(): string[];
}

export function createGate(options: {
  onChange?: (keys: string[]) => void;
  onError?: (key: string, error: unknown) => void;
} = {}): Gate {
  const inFlight = new Set<string>();
  const changed = () => options.onChange?.([...inFlight]);

  return {
    async run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
      if (inFlight.has(key)) return undefined;
      inFlight.add(key);
      changed();
      try {
        return await action();
      } catch (error) {
        options.onError?.(key, error);
        return undefined;
      } finally {
        inFlight.delete(key);
        changed();
      }
    },
    has: (key) => inFlight.has(key),
    keys: () => [...inFlight],
  };
}
