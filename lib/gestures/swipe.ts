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

/** How far a rightward swipe must travel to pin (PRD §4.67): past this, letting go pins. */
export function leadingThreshold(rowWidth: number): number {
  return Math.min(96, Math.max(64, rowWidth * 0.22));
}

/** The row's offset while swiping right to pin: follows the finger, then resists. */
export function leadingOffset(dx: number, rowWidth: number): number {
  if (dx <= 0) return 0;
  const threshold = leadingThreshold(rowWidth);
  return dx <= threshold ? dx : threshold + (dx - threshold) * 0.35;
}

/** Pull-to-refresh distance for a finger drag of `dy` (PRD §4.67): damped, capped. */
export const PULL_TRIGGER = 64;
export function pullDistance(dy: number): number {
  if (dy <= 0) return 0;
  return Math.min(96, dy * 0.5);
}

/**
 * Whether a touch is the edge swipe back to the list (PRD §4.67): it must
 * start at the left edge, travel right far enough, and stay mostly level.
 */
export const EDGE_WIDTH = 28;
export function edgeBack(startX: number, dx: number, dy: number, width: number): "back" | "stay" {
  if (startX > EDGE_WIDTH) return "stay";
  if (Math.abs(dy) > Math.abs(dx)) return "stay";
  return dx > Math.min(120, width * 0.3) ? "back" : "stay";
}
