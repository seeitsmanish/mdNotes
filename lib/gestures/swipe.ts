/**
 * The decisions behind swipe-to-reveal on list rows (PRD §4.52), kept pure so
 * they can be tested without a touchscreen.
 */

/** Pixels of movement before a touch commits to being a swipe or a scroll. */
export const LOCK_DISTANCE = 10;

/** Which way a touch is going, once it has moved far enough to tell. */
export function lockAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/**
 * The row's offset while dragging. Leftward only (actions sit on the right);
 * past the action buttons it keeps following but with resistance, like iOS.
 */
export function dragOffset(start: number, dx: number, actionsWidth: number, rowWidth: number): number {
  const raw = Math.min(0, start + dx);
  if (raw >= -actionsWidth) return raw;
  const extra = -raw - actionsWidth;
  const limit = Math.max(0, rowWidth - actionsWidth);
  return -(actionsWidth + Math.min(limit, extra * 0.6));
}

/**
 * Where the row settles when the finger lifts: open on the actions, closed,
 * or — swiped most of the way across, and only where allowed — the full-swipe
 * action. A quick flick counts as more than its distance.
 */
export function settle(
  offset: number,
  velocity: number,
  actionsWidth: number,
  rowWidth: number,
  allowFull: boolean,
): "open" | "closed" | "full" {
  if (allowFull && (offset < -rowWidth * 0.6 || (offset < -actionsWidth && velocity < -1.2))) return "full";
  if (offset < -actionsWidth / 2 || velocity < -0.5) return "open";
  return "closed";
}
