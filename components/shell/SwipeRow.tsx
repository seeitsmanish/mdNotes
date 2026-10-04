"use client";

import { useEffect, useRef, useState } from "react";
import { dragOffset, lockAxis, settle } from "@/lib/gestures/swipe";

/**
 * A list row that swipes right-to-left to reveal actions, as on iOS (PRD
 * §4.52). Touch only: a mouse never drags it, and desktop keeps its hover
 * buttons. Vertical movement is left to the browser (touch-action: pan-y), so
 * the list still scrolls; a touch that turns horizontal becomes a swipe.
 */
export function SwipeRow({
  open,
  onOpenChange,
  actions,
  actionsWidth,
  onFullSwipe,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered behind the row, on its right. */
  actions: React.ReactNode;
  actionsWidth: number;
  /** Swiping most of the way across runs this (iOS's full-swipe delete). */
  onFullSwipe?: () => void;
  children: React.ReactNode;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const gesture = useRef<{
    x: number;
    y: number;
    start: number;
    axis: "x" | "y" | null;
    lastX: number;
    lastT: number;
    velocity: number;
    moved: boolean;
  } | null>(null);

  // Follow the parent's idea of which row is open (only one at a time).
  useEffect(() => {
    if (!dragging && !leaving) setOffset(open ? -actionsWidth : 0);
  }, [open, actionsWidth, dragging, leaving]);

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    const t = event.touches[0]!;
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      start: open ? -actionsWidth : 0,
      axis: null,
      lastX: t.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = event.touches[0]!;
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    g.axis ??= lockAxis(dx, dy);
    if (g.axis !== "x") return;
    g.moved = true;
    const dt = Math.max(1, event.timeStamp - g.lastT);
    g.velocity = (t.clientX - g.lastX) / dt;
    g.lastX = t.clientX;
    g.lastT = event.timeStamp;
    if (!dragging) {
      setDragging(true);
      if (!open) onOpenChange(true); // claim "the open row" so others close
    }
    setOffset(dragOffset(g.start, dx, actionsWidth, row.current?.offsetWidth ?? 360));
  };

  const onTouchEnd = () => {
    const g = gesture.current;
    if (!g || g.axis !== "x") {
      gesture.current = g && g.axis === null ? g : null;
      return;
    }
    const width = row.current?.offsetWidth ?? 360;
    const outcome = settle(offset, g.velocity, actionsWidth, width, Boolean(onFullSwipe));
    setDragging(false);
    if (outcome === "full" && onFullSwipe) {
      setLeaving(true);
      setOffset(-width);
      // Let the slide-out play, then act; the list refresh removes the row.
      setTimeout(() => {
        onFullSwipe();
        setLeaving(false);
        onOpenChange(false);
      }, 180);
    } else {
      onOpenChange(outcome === "open");
      setOffset(outcome === "open" ? -actionsWidth : 0);
    }
  };

  // A swipe is not a tap; and a tap on an open row closes it.
  const onClickCapture = (event: React.MouseEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.moved || (open && offset !== 0)) {
      event.preventDefault();
      event.stopPropagation();
      if (!g?.moved) onOpenChange(false);
    }
  };

  const revealed = offset < 0;
  return (
    <div ref={row} className="ursa-swipe relative overflow-hidden rounded-lg" data-open={open ? "" : undefined}>
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: Math.max(actionsWidth, -offset), visibility: revealed ? "visible" : "hidden" }}
        aria-hidden={!open}
      >
        {actions}
      </div>
      <div
        className="relative bg-list"
        style={{
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: dragging ? "none" : "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          touchAction: "pan-y",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}

/** One revealed action: a full-height coloured button with an icon and label. */
export function SwipeAction({
  label,
  icon,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "neutral" | "danger" | "brand";
  onClick: () => void;
  disabled?: boolean;
}) {
  const colours =
    tone === "danger"
      ? "bg-[#e5484d] text-white"
      : tone === "brand"
        ? "bg-brand text-canvas"
        : "bg-[#8e8e93] text-white";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 text-[0.72rem] font-medium active:brightness-90 disabled:opacity-60 [&_svg]:size-5 ${colours}`}
    >
      {icon}
      {label}
    </button>
  );
}
