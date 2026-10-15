/**
 * One editor group's tabs (PRD §4.81), following VS Code:
 *
 * - A note opened with a single click is a *preview*: shown in italics, and
 *   replaced by the next note opened that way, so browsing does not leave a
 *   trail of tabs. Editing it, double-clicking its tab, or "Keep Open" makes
 *   it a normal tab.
 * - *Pinned* tabs sit first, are never replaced, and survive Close Others,
 *   Close to the Right and Close All.
 * - Closing the shown tab shows the one used most recently before it.
 */

export interface Group {
  id: string;
  tabs: string[];
  active: string | null;
  /** The preview tab, if one is open. */
  preview: string | null;
  /** Pinned tabs, always the first `pinned.length` of `tabs`, in that order. */
  pinned: string[];
  /** New notes open in another group instead (Lock Group). */
  locked: boolean;
  /** Most recently shown first. */
  mru: string[];
}

export const emptyGroup = (id: string): Group => ({
  id,
  tabs: [],
  active: null,
  preview: null,
  pinned: [],
  locked: false,
  mru: [],
});

const touch = (mru: string[], id: string) => [id, ...mru.filter((x) => x !== id)];

/** Show a tab already in the group. */
export function activate(group: Group, id: string): Group {
  if (!group.tabs.includes(id)) return group;
  return { ...group, active: id, mru: touch(group.mru, id) };
}

/**
 * Open `id` here. Already open: show it (and, unless opened as a preview,
 * keep it). Otherwise it takes the preview's place when opened as a preview
 * and one exists, else goes after the shown tab — or at `index` when given
 * (a drop), never among the pinned.
 */
export function open(group: Group, id: string, options: { preview?: boolean; index?: number } = {}): Group {
  const preview = options.preview ?? false;
  if (group.tabs.includes(id)) {
    const shown = activate(group, id);
    return !preview && group.preview === id ? { ...shown, preview: null } : shown;
  }
  const tabs = [...group.tabs];
  let nextPreview = group.preview;
  if (preview && group.preview && tabs.includes(group.preview) && options.index === undefined) {
    tabs[tabs.indexOf(group.preview)] = id;
    nextPreview = id;
  } else {
    const after = group.active ? tabs.indexOf(group.active) + 1 : tabs.length;
    const wanted = options.index ?? after;
    tabs.splice(Math.max(group.pinned.length, Math.min(wanted, tabs.length)), 0, id);
    if (preview) {
      // Only one preview: a previous one, kept by this open, becomes a normal tab.
      nextPreview = id;
    }
  }
  const mru = touch(group.mru.filter((x) => tabs.includes(x)), id);
  return { ...group, tabs, active: id, preview: nextPreview, mru };
}

/** Close `id`. The shown tab is replaced by the one used before it. */
export function close(group: Group, id: string): Group {
  if (!group.tabs.includes(id)) return group;
  const tabs = group.tabs.filter((x) => x !== id);
  const mru = group.mru.filter((x) => x !== id && tabs.includes(x));
  let active = group.active;
  if (active === id) {
    const at = group.tabs.indexOf(id);
    active = mru[0] ?? tabs[at] ?? tabs[at - 1] ?? null;
  }
  return {
    ...group,
    tabs,
    active,
    mru,
    preview: group.preview === id ? null : group.preview,
    pinned: group.pinned.filter((x) => x !== id),
  };
}

const closeMany = (group: Group, ids: string[]) => ids.reduce(close, group);

/** Close Others: everything but `id` and the pinned. */
export function closeOthers(group: Group, id: string): Group {
  return activate(closeMany(group, group.tabs.filter((x) => x !== id && !group.pinned.includes(x))), id);
}

/** Close to the Right: unpinned tabs after `id`. */
export function closeToRight(group: Group, id: string): Group {
  const at = group.tabs.indexOf(id);
  if (at === -1) return group;
  return closeMany(group, group.tabs.slice(at + 1).filter((x) => !group.pinned.includes(x)));
}

/** Close All: every tab but the pinned ones — unless `includingPinned`. */
export function closeAll(group: Group, includingPinned = false): Group {
  return closeMany(group, includingPinned ? group.tabs : group.tabs.filter((x) => !group.pinned.includes(x)));
}

/** Keep Open: the preview becomes a normal tab. */
export function keep(group: Group, id: string): Group {
  return group.preview === id ? { ...group, preview: null } : group;
}

/** Pin: moves to the end of the pinned tabs, and stops being a preview. */
export function pin(group: Group, id: string): Group {
  if (!group.tabs.includes(id) || group.pinned.includes(id)) return group;
  const pinned = [...group.pinned, id];
  const rest = group.tabs.filter((x) => !pinned.includes(x));
  return { ...keep(group, id), pinned, tabs: [...pinned, ...rest] };
}

/** Unpin: moves to just after the pinned tabs. */
export function unpin(group: Group, id: string): Group {
  if (!group.pinned.includes(id)) return group;
  const pinned = group.pinned.filter((x) => x !== id);
  const rest = group.tabs.filter((x) => !group.pinned.includes(x));
  return { ...group, pinned, tabs: [...pinned, id, ...rest] };
}

/** Drag within the strip: pinned tabs stay among the pinned, others after them. */
export function move(group: Group, id: string, index: number): Group {
  const from = group.tabs.indexOf(id);
  if (from === -1) return group;
  const tabs = group.tabs.filter((x) => x !== id);
  const isPinned = group.pinned.includes(id);
  const low = isPinned ? 0 : group.pinned.length - 0;
  const high = isPinned ? group.pinned.length - 1 : tabs.length;
  const target = index > from ? index - 1 : index;
  tabs.splice(Math.max(isPinned ? 0 : low, Math.min(target, high)), 0, id);
  const pinned = tabs.filter((x) => group.pinned.includes(x));
  return { ...group, tabs, pinned };
}

/** The tab `offset` places from the shown one, wrapping (next/previous editor). */
export function stepTab(group: Group, offset: number): string | null {
  if (group.tabs.length === 0) return null;
  const at = group.active ? group.tabs.indexOf(group.active) : -1;
  const count = group.tabs.length;
  return group.tabs[(((at + offset) % count) + count) % count]!;
}

/** Accepts only a well-formed stored group. */
export function isGroup(value: unknown): value is Group {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
  return (
    typeof g.id === "string" &&
    strings(g.tabs) &&
    strings(g.pinned) &&
    strings(g.mru) &&
    (g.active === null || typeof g.active === "string") &&
    (g.preview === null || typeof g.preview === "string") &&
    typeof g.locked === "boolean"
  );
}
