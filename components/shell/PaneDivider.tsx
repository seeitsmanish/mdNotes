"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Draggable pane edge (PRD R1.5). Also a keyboard-resizable separator, since
 * every control in the shell has to be reachable without a mouse (R1.6).
 */

interface PaneDividerProps {
  width: number;
  min: number;
  max: number;
  label: string;
  onResize: (width: number) => void;
}

export function PaneDivider({ width, min, max, label, onResize }: PaneDividerProps) {
  const dragging = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = { startX: event.clientX, startWidth: width };
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragging.current;
      if (!drag) return;
      onResize(drag.startWidth + (event.clientX - drag.startX));
    },
    [onResize],
  );

  const stop = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = null;
  }, []);

  // A drag that leaves the window should not leave the divider stuck to it.
  useEffect(() => {
    const clear = () => {
      dragging.current = null;
    };
    window.addEventListener("blur", clear);
    return () => window.removeEventListener("blur", clear);
  }, []);

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onResize(width - 16);
        else if (event.key === "ArrowRight") onResize(width + 16);
        else return;
        event.preventDefault();
      }}
      className="group relative w-px flex-none cursor-col-resize bg-border focus:outline-none"
    >
      {/* A 1px target is unhittable, so widen the hit area without the pixels. */}
      <span className="absolute inset-y-0 -left-1 -right-1 block group-hover:bg-brand/30 group-focus-visible:bg-brand/50" />
    </div>
  );
}
