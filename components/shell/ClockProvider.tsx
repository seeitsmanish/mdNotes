"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { CLOCK_COOKIE, type Clock, encodeClockCookie } from "@/lib/clock";

/**
 * Hands the note list a clock that matches the server's render during
 * hydration, then the browser's own — and ticks every 30s, so "just now" and
 * "Today" stay true while the app sits open (PRD R38.6).
 */

let snapshot: Clock | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function read(): Clock {
  const { timeZone, locale } = Intl.DateTimeFormat().resolvedOptions();
  return { now: Date.now(), timeZone, locale };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    // Tell the server how to render dates for this browser next time.
    const { timeZone, locale } = getSnapshot();
    document.cookie = `${CLOCK_COOKIE}=${encodeClockCookie(timeZone ?? "UTC", locale ?? "en")}; path=/; max-age=31536000; samesite=lax`;
    timer = setInterval(() => {
      snapshot = read();
      for (const notify of listeners) notify();
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): Clock {
  snapshot ??= read();
  return snapshot;
}

const ClockContext = createContext<Clock>({ now: 0 });

export function ClockProvider({ initial, children }: { initial: Clock; children: React.ReactNode }) {
  const clock = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export function useClock(): Clock {
  return useContext(ClockContext);
}
