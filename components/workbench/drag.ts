/**
 * Dragging tabs and notes between editor groups (PRD §4.81). A drag carries
 * the note and the group it came from (none when it comes from the note
 * list). The browser hides a drag's data until the drop, so the payload is
 * also kept here for drop targets to read while it is under the pointer.
 */

export const TAB_TYPE = "application/x-mdnotes-tab";

export interface DragPayload {
  note: string;
  /** The group the tab is leaving; null for a note dragged from the list. */
  group: string | null;
}

let current: DragPayload | null = null;

export function startDrag(event: React.DragEvent, payload: DragPayload, title: string): void {
  current = payload;
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(TAB_TYPE, JSON.stringify(payload));
  // Shift-dropped into a note's text, it becomes a link to the note.
  event.dataTransfer.setData("text/plain", `[[${title}]]`);
}

export function endDrag(): void {
  current = null;
}

/** The drag under the pointer, if it is one of ours. */
export function currentDrag(event: React.DragEvent): DragPayload | null {
  return event.dataTransfer.types.includes(TAB_TYPE) ? current : null;
}

/** ⌥ (or Ctrl) held on drop copies the tab instead of moving it, as in VS Code. */
export const wantsCopy = (event: React.DragEvent) => event.altKey || event.ctrlKey;
