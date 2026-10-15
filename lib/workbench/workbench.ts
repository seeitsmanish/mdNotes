/**
 * The editor area as a whole (PRD §4.81): groups of tabs arranged in a grid,
 * one of them active. Every action is a pure function from one state to the
 * next; the UI store only holds the result.
 */

import * as G from "./group";
import type { Group } from "./group";
import {
  evenSizes,
  flip,
  groupIds,
  hasGroup,
  isLayout,
  type Layout,
  moveSash,
  neighbour,
  type Preset,
  presetLayout,
  presetSize,
  removeGroup,
  type Side,
  single,
  splitGroup,
} from "./layout";

export interface Workbench {
  groups: Record<string, Group>;
  layout: Layout;
  active: string;
  /** Groups most recently active first, for where focus goes when one closes. */
  groupMru: string[];
  /** A group shown alone, the rest hidden (Maximize Group). */
  maximized: string | null;
  /** Recently closed tabs, newest first (Reopen Closed Editor). */
  closed: Array<{ note: string; group: string }>;
  /** For naming new groups g1, g2, … */
  seq: number;
}

export const CLOSED_LIMIT = 20;

export function initialWorkbench(): Workbench {
  return {
    groups: { g1: G.emptyGroup("g1") },
    layout: single("g1"),
    active: "g1",
    groupMru: ["g1"],
    maximized: null,
    closed: [],
    seq: 1,
  };
}

export const activeGroup = (wb: Workbench): Group => wb.groups[wb.active]!;
export const shownNote = (wb: Workbench): string | null => activeGroup(wb).active;

/** Groups in reading order. */
export const orderedGroups = (wb: Workbench): Group[] => groupIds(wb.layout).map((id) => wb.groups[id]!);

const setGroup = (wb: Workbench, group: Group): Workbench => ({ ...wb, groups: { ...wb.groups, [group.id]: group } });

export function focusGroup(wb: Workbench, id: string): Workbench {
  if (!wb.groups[id] || wb.active === id) return wb;
  return {
    ...wb,
    active: id,
    groupMru: [id, ...wb.groupMru.filter((g) => g !== id)],
    // Focusing another group while one is maximised shows them all again.
    maximized: wb.maximized && wb.maximized !== id ? null : wb.maximized,
  };
}

function newGroup(wb: Workbench, beside: string, side: Side): { wb: Workbench; id: string } {
  const id = `g${wb.seq + 1}`;
  return {
    id,
    wb: {
      ...wb,
      seq: wb.seq + 1,
      groups: { ...wb.groups, [id]: G.emptyGroup(id) },
      layout: splitGroup(wb.layout, beside, id, side),
      maximized: null,
    },
  };
}

/** Where a note opened "here" goes: the target, unless it is locked. */
function unlockedTarget(wb: Workbench, target: string): { wb: Workbench; id: string } {
  if (!wb.groups[target]!.locked) return { wb, id: target };
  const other = wb.groupMru.find((id) => wb.groups[id] && !wb.groups[id]!.locked);
  if (other) return { wb, id: other };
  return newGroup(wb, target, "right");
}

/**
 * Open a note: in `group` (default the active one) or in a new group on
 * `side` of it, as a preview or kept, at `index` if dropped there.
 */
export function openNote(
  wb: Workbench,
  note: string,
  options: { group?: string; side?: Side; preview?: boolean; index?: number } = {},
): Workbench {
  let next = wb;
  let target = options.group && wb.groups[options.group] ? options.group : wb.active;
  if (options.side) {
    ({ wb: next, id: target } = newGroup(next, target, options.side));
  } else if (!options.group) {
    ({ wb: next, id: target } = unlockedTarget(next, target));
  }
  next = setGroup(next, G.open(next.groups[target]!, note, { preview: options.preview, index: options.index }));
  return focusGroup({ ...next, active: next.active }, target);
}

export function activateTab(wb: Workbench, group: string, note: string): Workbench {
  const g = wb.groups[group];
  if (!g) return wb;
  return focusGroup(setGroup(wb, G.activate(g, note)), group);
}

/** Remove a group from the grid. Its tabs close; the last group is only emptied. */
export function closeGroup(wb: Workbench, id: string): Workbench {
  if (!wb.groups[id]) return wb;
  const layout = removeGroup(wb.layout, id);
  if (!layout) return setGroup(wb, G.closeAll(wb.groups[id]!, true));
  const groups = { ...wb.groups };
  delete groups[id];
  const groupMru = wb.groupMru.filter((g) => g !== id && groups[g]);
  const active = wb.active === id ? (groupMru[0] ?? groupIds(layout)[0]!) : wb.active;
  return { ...wb, groups, layout, groupMru, active, maximized: wb.maximized === id ? null : wb.maximized };
}

/** After tabs close: a group left empty goes, unless it is the only one (VS Code's closeEmptyGroups). */
function dropIfEmpty(wb: Workbench, id: string): Workbench {
  const g = wb.groups[id];
  if (!g || g.tabs.length > 0 || groupIds(wb.layout).length === 1) return wb;
  return closeGroup(wb, id);
}

const remember = (wb: Workbench, closed: Array<{ note: string; group: string }>): Workbench => ({
  ...wb,
  closed: [...closed.reverse(), ...wb.closed].slice(0, CLOSED_LIMIT),
});

/** Run a group operation that closes tabs, remembering them for Reopen. */
function closing(wb: Workbench, id: string, op: (g: Group) => Group): Workbench {
  const g = wb.groups[id];
  if (!g) return wb;
  const after = op(g);
  const gone = g.tabs.filter((t) => !after.tabs.includes(t)).map((note) => ({ note, group: id }));
  return dropIfEmpty(remember(setGroup(wb, after), gone), id);
}

export const closeTab = (wb: Workbench, group: string, note: string) => closing(wb, group, (g) => G.close(g, note));
export const closeOthers = (wb: Workbench, group: string, note: string) =>
  closing(wb, group, (g) => G.closeOthers(g, note));
export const closeToRight = (wb: Workbench, group: string, note: string) =>
  closing(wb, group, (g) => G.closeToRight(g, note));
export const closeAllInGroup = (wb: Workbench, group: string) => closing(wb, group, (g) => G.closeAll(g));

/** Close every tab in every group, pinned ones kept (Close All Editors). */
export function closeAllGroups(wb: Workbench): Workbench {
  return groupIds(wb.layout).reduce((acc, id) => closeAllInGroup(acc, id), wb);
}

/** A trashed or deleted note: its tabs close everywhere, not offered for Reopen. */
export function closeEverywhere(wb: Workbench, note: string): Workbench {
  let next: Workbench = { ...wb, closed: wb.closed.filter((c) => c.note !== note) };
  for (const id of groupIds(wb.layout)) {
    const g = next.groups[id];
    if (g?.tabs.includes(note)) next = dropIfEmpty(setGroup(next, G.close(g, note)), id);
  }
  return next;
}

/** Reopen the most recently closed tab, in its group if that is still there. */
export function reopenClosed(wb: Workbench, isOpenable: (note: string) => boolean = () => true): Workbench {
  const [first, ...rest] = wb.closed.filter((c) => isOpenable(c.note));
  if (!first) return wb;
  const next = { ...wb, closed: rest };
  return openNote(next, first.note, { group: next.groups[first.group] ? first.group : undefined });
}

/**
 * Drag a tab to another group (or a copy, with ⌥ held). Into the same group
 * it is a reorder. Its old group closes if left empty.
 */
export function moveTab(
  wb: Workbench,
  from: string,
  note: string,
  to: string,
  options: { index?: number; copy?: boolean } = {},
): Workbench {
  const source = wb.groups[from];
  const target = wb.groups[to];
  if (!source || !target) return wb;
  if (from === to) {
    if (options.index === undefined) return activateTab(wb, from, note);
    return focusGroup(setGroup(wb, G.activate(G.move(source, note, options.index), note)), from);
  }
  let next = setGroup(wb, G.open(target, note, { index: options.index }));
  const wasPinned = source.pinned.includes(note);
  if (wasPinned) next = setGroup(next, G.pin(next.groups[to]!, note));
  if (!options.copy) next = dropIfEmpty(setGroup(next, G.close(next.groups[from]!, note)), from);
  return focusGroup(next, to);
}

/**
 * Split: a new group on `side` of `group`. With a note, it opens there —
 * copied (Split Editor) or moved (dragging a tab to an edge). Empty
 * otherwise.
 */
export function split(
  wb: Workbench,
  group: string,
  side: Side,
  options: { note?: string; move?: boolean } = {},
): Workbench {
  if (!wb.groups[group]) return wb;
  const { wb: withGroup, id } = newGroup(wb, group, side);
  let next = withGroup;
  if (options.note) {
    next = setGroup(next, G.open(next.groups[id]!, options.note));
    if (options.move) {
      next = setGroup(next, G.close(next.groups[group]!, options.note));
      // A group emptied by moving its only tab out goes, as in VS Code.
      next = dropIfEmpty(next, group);
    }
  }
  return focusGroup(next, id);
}

/** Move or copy a tab to the group on `side`, making one if there is none. */
export function sendTab(wb: Workbench, from: string, note: string, side: Side, copy = false): Workbench {
  const other = neighbour(wb.layout, from, side);
  if (other) return moveTab(wb, from, note, other, { copy });
  return split(wb, from, side, { note, move: !copy });
}

/**
 * A tab dropped on a group (PRD §4.81): in the middle it joins the group, on
 * an edge it splits that side. ⌥ held copies instead of moving. A note
 * dragged in from the list (`from` null) just opens there.
 */
export function dropTab(
  wb: Workbench,
  from: string | null,
  note: string,
  to: string,
  side: Side | null,
  copy = false,
): Workbench {
  if (!wb.groups[to]) return wb;
  if (!side) {
    if (from === null) return openNote(wb, note, { group: to });
    return moveTab(wb, from, note, to, { copy });
  }
  if (from === null) return split(wb, to, side, { note });
  if (from === to) return split(wb, to, side, { note, move: !copy });
  let next = split(wb, to, side, { note });
  const newId = next.active;
  if (!copy && next.groups[from]) {
    next = dropIfEmpty(setGroup(next, G.close(next.groups[from]!, note)), from);
  }
  return focusGroup(next, newId);
}

/** Open to the Side: the group to the right of the active one, made if needed. */
export function openToSide(wb: Workbench, note: string): Workbench {
  const right = neighbour(wb.layout, wb.active, "right");
  if (right) return openNote(wb, note, { group: right });
  return split(wb, wb.active, "right", { note });
}

/** The next or previous group in reading order (Move Editor into Next Group). */
export function adjacentGroup(wb: Workbench, from: string, offset: 1 | -1): string | null {
  const ids = groupIds(wb.layout);
  const at = ids.indexOf(from);
  return ids[at + offset] ?? null;
}

/** Join with Next Group: its tabs go to the next group (else the previous) and it closes. */
export function joinGroup(wb: Workbench, id: string): Workbench {
  const target = adjacentGroup(wb, id, 1) ?? adjacentGroup(wb, id, -1);
  const source = wb.groups[id];
  if (!target || !source) return wb;
  let into = wb.groups[target]!;
  for (const note of source.tabs) {
    into = G.open(into, note);
    if (source.pinned.includes(note)) into = G.pin(into, note);
  }
  if (source.active) into = G.activate(into, source.active);
  const next = closeGroup(setGroup(wb, into), id);
  return focusGroup(next, target);
}

/** Join All Groups: everything into the active group. */
export function joinAll(wb: Workbench): Workbench {
  let into = activeGroup(wb);
  for (const g of orderedGroups(wb)) {
    if (g.id === into.id) continue;
    for (const note of g.tabs) into = G.open(into, note);
  }
  if (activeGroup(wb).active) into = G.activate(into, activeGroup(wb).active!);
  return { ...wb, groups: { [into.id]: into }, layout: single(into.id), groupMru: [into.id], maximized: null };
}

/**
 * Focus the n-th group (1-based). One past the last makes a new group to the
 * right, as VS Code's "Focus Third Editor Group" does with only two.
 */
export function focusGroupAt(wb: Workbench, n: number): Workbench {
  const ids = groupIds(wb.layout);
  if (n <= ids.length) return focusGroup(wb, ids[n - 1]!);
  const last = ids[ids.length - 1]!;
  const lastGroup = wb.groups[last]!;
  return split(wb, last, "right", { note: lastGroup.active ?? undefined });
}

export function focusSide(wb: Workbench, side: Side): Workbench {
  const other = neighbour(wb.layout, wb.active, side);
  return other ? focusGroup(wb, other) : wb;
}

const mapGroup = (wb: Workbench, id: string, op: (g: Group) => Group): Workbench =>
  wb.groups[id] ? setGroup(wb, op(wb.groups[id]!)) : wb;

export const pinTab = (wb: Workbench, group: string, note: string) => mapGroup(wb, group, (g) => G.pin(g, note));
export const unpinTab = (wb: Workbench, group: string, note: string) => mapGroup(wb, group, (g) => G.unpin(g, note));
export const keepTab = (wb: Workbench, group: string, note: string) => mapGroup(wb, group, (g) => G.keep(g, note));
export const toggleLock = (wb: Workbench, group: string) => mapGroup(wb, group, (g) => ({ ...g, locked: !g.locked }));

/** Typing in a preview keeps it, wherever it is open. */
export function keepEverywhere(wb: Workbench, note: string): Workbench {
  let next = wb;
  for (const g of Object.values(wb.groups)) if (g.preview === note) next = setGroup(next, G.keep(g, note));
  return next;
}

/** Next or previous tab in the active group. */
export function step(wb: Workbench, offset: number): Workbench {
  const target = G.stepTab(activeGroup(wb), offset);
  return target ? activateTab(wb, wb.active, target) : wb;
}

/** The n-th tab of the active group; 9 is always the last (VS Code's ⌃1…⌃9). */
export function tabAt(wb: Workbench, n: number): Workbench {
  const tabs = activeGroup(wb).tabs;
  const note = n >= 9 ? tabs[tabs.length - 1] : tabs[n - 1];
  return note ? activateTab(wb, wb.active, note) : wb;
}

export function toggleMaximize(wb: Workbench, id = wb.active): Workbench {
  if (groupIds(wb.layout).length < 2) return wb;
  return { ...focusGroup(wb, id), maximized: wb.maximized === id ? null : id };
}

export const even = (wb: Workbench): Workbench => ({ ...wb, layout: evenSizes(wb.layout) });
export const flipLayout = (wb: Workbench): Workbench => ({ ...wb, layout: flip(wb.layout) });
export const resize = (wb: Workbench, path: number[], index: number, at: number): Workbench => ({
  ...wb,
  layout: moveSash(wb.layout, path, index, at),
});

/**
 * Apply a layout preset. Existing groups fill it in order; groups beyond its
 * size are joined into the last one; missing groups are made empty.
 */
export function applyPreset(wb: Workbench, preset: Preset): Workbench {
  const size = presetSize(preset);
  let next = wb;
  let ids = groupIds(next.layout);
  while (ids.length > size) {
    const extra = ids[ids.length - 1]!;
    const into = next.groups[ids[size - 1]!]!;
    let merged = into;
    for (const note of next.groups[extra]!.tabs) merged = G.open(merged, note);
    if (into.active) merged = G.activate(merged, into.active);
    const groups = { ...next.groups, [merged.id]: merged };
    delete groups[extra];
    next = { ...next, groups, groupMru: next.groupMru.filter((g) => g !== extra) };
    ids = ids.slice(0, -1);
  }
  let seq = next.seq;
  const groups = { ...next.groups };
  while (ids.length < size) {
    seq += 1;
    const id = `g${seq}`;
    groups[id] = G.emptyGroup(id);
    ids = [...ids, id];
  }
  const active = groups[next.active] ? next.active : ids[0]!;
  return {
    ...next,
    seq,
    groups,
    layout: presetLayout(preset, ids),
    active,
    groupMru: [active, ...ids.filter((id) => id !== active)],
    maximized: null,
  };
}

/** Every note open in a tab anywhere. */
export function openNotes(wb: Workbench): string[] {
  return [...new Set(Object.values(wb.groups).flatMap((g) => g.tabs))];
}

/** Each group's shown note — what has to be loaded to draw the grid. */
export function visibleNotes(wb: Workbench): string[] {
  const groups = wb.maximized ? [wb.groups[wb.maximized]!] : orderedGroups(wb);
  return [...new Set(groups.map((g) => g.active).filter((x): x is string => x !== null))];
}

/** A stored workbench, checked; anything malformed starts fresh. */
export function restore(value: unknown): Workbench {
  const fresh = initialWorkbench();
  if (!value || typeof value !== "object") return fresh;
  const wb = value as Partial<Workbench>;
  if (!isLayout(wb.layout) || !wb.groups || typeof wb.groups !== "object") return fresh;
  const ids = groupIds(wb.layout);
  if (new Set(ids).size !== ids.length) return fresh;
  const groups: Record<string, Group> = {};
  for (const id of ids) {
    const g = (wb.groups as Record<string, unknown>)[id];
    if (!G.isGroup(g) || g.id !== id) return fresh;
    groups[id] = g;
  }
  const active = typeof wb.active === "string" && groups[wb.active] ? wb.active : ids[0]!;
  const seq = Math.max(
    typeof wb.seq === "number" ? wb.seq : 0,
    ...ids.map((id) => Number(id.slice(1)) || 0),
  );
  return {
    groups,
    layout: wb.layout,
    active,
    groupMru: [active, ...ids.filter((id) => id !== active)],
    maximized: null,
    closed: [],
    seq,
  };
}

export { hasGroup };
