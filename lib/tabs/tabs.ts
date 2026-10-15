/**
 * Tabs and split view (PRD §4.80): which notes each pane has open, and which
 * one it shows. Pure, so the rules are tested apart from the UI.
 *
 * One note is open in one place only. Two editors on the same text would each
 * save their own copy over the other's, so opening a note that already has a
 * tab goes to that tab, wherever it is.
 */

export interface TabSet {
  ids: string[];
  active: string | null;
}

export const EMPTY_TABS: TabSet = { ids: [], active: null };

/**
 * Show `id` in this set. Already open: switch to it. Otherwise it replaces
 * the tab being shown, like following a link in a browser tab — or, with
 * `newTab`, opens beside it.
 */
export function openTab(tabs: TabSet, id: string, newTab = false): TabSet {
  if (tabs.ids.includes(id)) return { ids: tabs.ids, active: id };
  const at = tabs.active === null ? -1 : tabs.ids.indexOf(tabs.active);
  if (at === -1) return { ids: [...tabs.ids, id], active: id };
  const ids = [...tabs.ids];
  if (newTab) ids.splice(at + 1, 0, id);
  else ids[at] = id;
  return { ids, active: id };
}

/** Close `id`. Closing the shown tab shows its right-hand neighbour, else the left. */
export function closeTab(tabs: TabSet, id: string): TabSet {
  const at = tabs.ids.indexOf(id);
  if (at === -1) return tabs;
  const ids = tabs.ids.filter((tab) => tab !== id);
  if (tabs.active !== id) return { ids, active: tabs.active };
  return { ids, active: ids[at] ?? ids[at - 1] ?? null };
}

/** Move a tab to a new position in its strip (drag to reorder). */
export function moveTab(tabs: TabSet, id: string, to: number): TabSet {
  const from = tabs.ids.indexOf(id);
  if (from === -1) return tabs;
  const ids = tabs.ids.filter((tab) => tab !== id);
  ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id);
  return { ids, active: tabs.active };
}

/** Closing the split: its tabs join the main pane's, after them, without repeats. */
export function mergeTabs(main: TabSet, other: TabSet): TabSet {
  const ids = [...main.ids, ...other.ids.filter((id) => !main.ids.includes(id))];
  return { ids, active: main.active ?? other.active };
}
