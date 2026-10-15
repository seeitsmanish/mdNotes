/**
 * The editor grid (PRD §4.81): how groups of tabs are arranged, VS Code
 * style. A layout is a tree — a group, or a row/column of layouts with
 * relative sizes — and every operation returns a new tree. Pure, so it is
 * tested apart from the UI.
 */

export type Axis = "row" | "column";

export type Layout =
  | { kind: "group"; id: string }
  | { kind: "split"; axis: Axis; children: Layout[]; sizes: number[] };

export type Side = "left" | "right" | "up" | "down";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A divider between two neighbours of one split, for dragging. */
export interface Sash {
  /** Child indexes from the root to the split it belongs to. */
  path: number[];
  /** It sits after this child. */
  index: number;
  axis: Axis;
  /** The split's own box, so a drag can be turned into sizes. */
  box: Rect;
  /** Where the line is: x for a row, y for a column. */
  at: number;
  /** Its extent across: y..y+span for a row, x..x+span for a column. */
  from: number;
  span: number;
}

export const MIN_SHARE = 0.1;

export const single = (id: string): Layout => ({ kind: "group", id });

const axisOf = (side: Side): Axis => (side === "left" || side === "right" ? "row" : "column");
const before = (side: Side) => side === "left" || side === "up";

const normalise = (sizes: number[]): number[] => {
  const total = sizes.reduce((sum, size) => sum + size, 0) || 1;
  return sizes.map((size) => size / total);
};

/** Every group id, in reading order (left to right, top to bottom). */
export function groupIds(layout: Layout): string[] {
  if (layout.kind === "group") return [layout.id];
  return layout.children.flatMap(groupIds);
}

export function hasGroup(layout: Layout, id: string): boolean {
  return groupIds(layout).includes(id);
}

/**
 * Put a new group beside `target`. Joins the parent split when it runs the
 * same way, so three columns stay one row of three rather than nesting; the
 * target's space is shared half and half with the newcomer.
 */
export function splitGroup(layout: Layout, target: string, added: string, side: Side): Layout {
  const axis = axisOf(side);
  const fresh: Layout = { kind: "group", id: added };
  const visit = (node: Layout): Layout => {
    if (node.kind === "group") {
      if (node.id !== target) return node;
      return {
        kind: "split",
        axis,
        children: before(side) ? [fresh, node] : [node, fresh],
        sizes: [0.5, 0.5],
      };
    }
    const at = node.children.findIndex((child) => child.kind === "group" && child.id === target);
    if (at !== -1 && node.axis === axis) {
      const share = node.sizes[at]! / 2;
      const children = [...node.children];
      const sizes = [...node.sizes];
      const insert = before(side) ? at : at + 1;
      sizes[at] = share;
      children.splice(insert, 0, fresh);
      sizes.splice(insert, 0, share);
      return { ...node, children, sizes };
    }
    return { ...node, children: node.children.map(visit) };
  };
  return visit(layout);
}

/** Take a group out. Its space goes to its neighbours; a split left with one child is replaced by it. */
export function removeGroup(layout: Layout, id: string): Layout | null {
  const visit = (node: Layout): Layout | null => {
    if (node.kind === "group") return node.id === id ? null : node;
    const kept: Layout[] = [];
    const sizes: number[] = [];
    node.children.forEach((child, index) => {
      const next = visit(child);
      if (next) {
        kept.push(next);
        sizes.push(node.sizes[index]!);
      }
    });
    if (kept.length === 0) return null;
    if (kept.length === 1) return kept[0]!;
    // A child that became a split running the same way is merged into this one.
    const children: Layout[] = [];
    const merged: number[] = [];
    kept.forEach((child, index) => {
      if (child.kind === "split" && child.axis === node.axis) {
        child.children.forEach((grandchild, j) => {
          children.push(grandchild);
          merged.push(sizes[index]! * child.sizes[j]!);
        });
      } else {
        children.push(child);
        merged.push(sizes[index]!);
      }
    });
    return { ...node, children, sizes: normalise(merged) };
  };
  return visit(layout);
}

/** Every group's box in a unit square, and every divider. */
export function measure(layout: Layout): { rects: Map<string, Rect>; sashes: Sash[] } {
  const rects = new Map<string, Rect>();
  const sashes: Sash[] = [];
  const visit = (node: Layout, box: Rect, path: number[]) => {
    if (node.kind === "group") {
      rects.set(node.id, box);
      return;
    }
    let offset = 0;
    node.children.forEach((child, index) => {
      const share = node.sizes[index]!;
      const childBox =
        node.axis === "row"
          ? { x: box.x + offset * box.w, y: box.y, w: share * box.w, h: box.h }
          : { x: box.x, y: box.y + offset * box.h, w: box.w, h: share * box.h };
      offset += share;
      visit(child, childBox, [...path, index]);
      if (index < node.children.length - 1) {
        sashes.push(
          node.axis === "row"
            ? { path, index, axis: "row", box, at: box.x + offset * box.w, from: box.y, span: box.h }
            : { path, index, axis: "column", box, at: box.y + offset * box.h, from: box.x, span: box.w },
        );
      }
    });
  };
  visit(layout, { x: 0, y: 0, w: 1, h: 1 }, []);
  return { rects, sashes };
}

/**
 * Move the divider after child `index` of the split at `path` to `position`
 * (a fraction of the whole grid). Only the two children either side change.
 */
export function moveSash(layout: Layout, path: number[], index: number, position: number): Layout {
  const visit = (node: Layout, box: Rect, depth: number): Layout => {
    if (node.kind === "group") return node;
    if (depth < path.length) {
      const target = path[depth]!;
      let offset = 0;
      const children = node.children.map((child, i) => {
        const share = node.sizes[i]!;
        const childBox =
          node.axis === "row"
            ? { x: box.x + offset * box.w, y: box.y, w: share * box.w, h: box.h }
            : { x: box.x, y: box.y + offset * box.h, w: box.w, h: share * box.h };
        offset += share;
        return i === target ? visit(child, childBox, depth + 1) : child;
      });
      return { ...node, children };
    }
    const start = node.axis === "row" ? box.x : box.y;
    const length = node.axis === "row" ? box.w : box.h;
    const local = (position - start) / length;
    const before = node.sizes.slice(0, index).reduce((sum, size) => sum + size, 0);
    const pair = node.sizes[index]! + node.sizes[index + 1]!;
    const first = Math.min(pair - MIN_SHARE, Math.max(MIN_SHARE, local - before));
    const sizes = [...node.sizes];
    sizes[index] = first;
    sizes[index + 1] = pair - first;
    return { ...node, sizes };
  };
  return visit(layout, { x: 0, y: 0, w: 1, h: 1 }, 0);
}

/** Every split's children the same size (VS Code: double-click a divider). */
export function evenSizes(layout: Layout): Layout {
  if (layout.kind === "group") return layout;
  return {
    ...layout,
    children: layout.children.map(evenSizes),
    sizes: layout.children.map(() => 1 / layout.children.length),
  };
}

/** Rows become columns and columns rows (Toggle Vertical/Horizontal Editor Layout). */
export function flip(layout: Layout): Layout {
  if (layout.kind === "group") return layout;
  return { ...layout, axis: layout.axis === "row" ? "column" : "row", children: layout.children.map(flip) };
}

/** The group next to `id` on that side, judged by where the boxes sit. */
export function neighbour(layout: Layout, id: string, side: Side): string | null {
  const { rects } = measure(layout);
  const from = rects.get(id);
  if (!from) return null;
  const eps = 1e-6;
  let best: { id: string; distance: number; overlap: number } | null = null;
  for (const [other, rect] of rects) {
    if (other === id) continue;
    let distance: number;
    let overlap: number;
    if (side === "left" || side === "right") {
      distance = side === "left" ? from.x - (rect.x + rect.w) : rect.x - (from.x + from.w);
      overlap = Math.min(from.y + from.h, rect.y + rect.h) - Math.max(from.y, rect.y);
    } else {
      distance = side === "up" ? from.y - (rect.y + rect.h) : rect.y - (from.y + from.h);
      overlap = Math.min(from.x + from.w, rect.x + rect.w) - Math.max(from.x, rect.x);
    }
    if (distance < -eps || overlap <= eps) continue;
    if (!best || distance < best.distance - eps || (Math.abs(distance - best.distance) <= eps && overlap > best.overlap)) {
      best = { id: other, distance, overlap };
    }
  }
  return best?.id ?? null;
}

export type Preset = "single" | "columns2" | "columns3" | "rows2" | "rows3" | "grid" | "rowsRight" | "columnsBottom";

export const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "single", label: "Single" },
  { value: "columns2", label: "Two columns" },
  { value: "columns3", label: "Three columns" },
  { value: "rows2", label: "Two rows" },
  { value: "rows3", label: "Three rows" },
  { value: "grid", label: "Grid (2×2)" },
  { value: "rowsRight", label: "Two rows right" },
  { value: "columnsBottom", label: "Two columns bottom" },
];

/** A preset's shape, filled with `ids` in reading order. */
export function presetLayout(preset: Preset, ids: string[]): Layout {
  const g = (i: number): Layout => ({ kind: "group", id: ids[i]! });
  const split = (axis: Axis, children: Layout[]): Layout => ({
    kind: "split",
    axis,
    children,
    sizes: children.map(() => 1 / children.length),
  });
  switch (preset) {
    case "single":
      return g(0);
    case "columns2":
      return split("row", [g(0), g(1)]);
    case "columns3":
      return split("row", [g(0), g(1), g(2)]);
    case "rows2":
      return split("column", [g(0), g(1)]);
    case "rows3":
      return split("column", [g(0), g(1), g(2)]);
    case "grid":
      return split("column", [split("row", [g(0), g(1)]), split("row", [g(2), g(3)])]);
    case "rowsRight":
      return split("row", [g(0), split("column", [g(1), g(2)])]);
    case "columnsBottom":
      return split("column", [split("row", [g(0), g(1)]), g(2)]);
  }
}

export const presetSize = (preset: Preset): number =>
  ({ single: 1, columns2: 2, columns3: 3, rows2: 2, rows3: 3, grid: 4, rowsRight: 3, columnsBottom: 3 })[preset];

/** Accepts only a well-formed tree (stored layouts come back from localStorage). */
export function isLayout(value: unknown): value is Layout {
  if (!value || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  if (node.kind === "group") return typeof node.id === "string";
  if (node.kind !== "split" || (node.axis !== "row" && node.axis !== "column")) return false;
  const { children, sizes } = node;
  return (
    Array.isArray(children) &&
    Array.isArray(sizes) &&
    children.length >= 2 &&
    children.length === sizes.length &&
    sizes.every((size) => typeof size === "number" && size > 0) &&
    children.every(isLayout)
  );
}
