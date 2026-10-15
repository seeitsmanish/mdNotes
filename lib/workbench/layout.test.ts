import { describe, expect, it } from "vitest";
import {
  evenSizes,
  flip,
  groupIds,
  isLayout,
  type Layout,
  measure,
  moveSash,
  neighbour,
  presetLayout,
  removeGroup,
  single,
  splitGroup,
} from "./layout";

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("splitGroup", () => {
  it("splits a lone group into two columns, the new one on the chosen side", () => {
    expect(splitGroup(single("a"), "a", "b", "right")).toEqual({
      kind: "split",
      axis: "row",
      children: [single("a"), single("b")],
      sizes: [0.5, 0.5],
    });
    expect(groupIds(splitGroup(single("a"), "a", "b", "up"))).toEqual(["b", "a"]);
  });

  it("joins a row going the same way instead of nesting, sharing the target's space", () => {
    const two = splitGroup(single("a"), "a", "b", "right");
    const three = splitGroup(two, "b", "c", "right");
    expect(three.kind === "split" && three.children.length).toBe(3);
    expect(three.kind === "split" && three.sizes).toEqual([0.5, 0.25, 0.25]);
  });

  it("nests when splitting across the row", () => {
    const layout = splitGroup(splitGroup(single("a"), "a", "b", "right"), "b", "c", "down");
    expect(groupIds(layout)).toEqual(["a", "b", "c"]);
    const { rects } = measure(layout);
    expect(rects.get("c")).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });
});

describe("removeGroup", () => {
  it("gives the space back and unwraps a split left with one child", () => {
    const layout = splitGroup(single("a"), "a", "b", "right");
    expect(removeGroup(layout, "b")).toEqual(single("a"));
    expect(removeGroup(single("a"), "a")).toBeNull();
  });

  it("re-normalises sizes and merges a same-way child into its parent", () => {
    // a | (b / c)  → remove b → a | c
    const layout = splitGroup(splitGroup(single("a"), "a", "b", "right"), "b", "c", "down");
    const after = removeGroup(layout, "b")!;
    expect(after).toEqual({ kind: "split", axis: "row", children: [single("a"), single("c")], sizes: [0.5, 0.5] });
    // a | b | c with one removed: sizes still add up to 1
    const row = removeGroup(presetLayout("columns3", ["a", "b", "c"]), "b")!;
    expect(row.kind === "split" && row.sizes.reduce((s, x) => s + x, 0)).toBeCloseTo(1);
  });
});

describe("measure and moveSash", () => {
  it("lists one divider between each pair of neighbours", () => {
    expect(measure(presetLayout("grid", ["a", "b", "c", "d"])).sashes).toHaveLength(3);
  });

  it("moves only the two neighbours of a divider, and not past the minimum", () => {
    const layout = presetLayout("columns3", ["a", "b", "c"]);
    const moved = moveSash(layout, [], 0, 0.5) as Extract<Layout, { kind: "split" }>;
    expect(close(moved.sizes[0]!, 0.5)).toBe(true);
    expect(close(moved.sizes[1]!, 1 / 6)).toBe(true);
    expect(close(moved.sizes[2]!, 1 / 3)).toBe(true);
    const squeezed = moveSash(layout, [], 0, 0.99) as Extract<Layout, { kind: "split" }>;
    expect(close(squeezed.sizes[1]!, 0.1)).toBe(true);
  });

  it("moves a divider inside a nested split in grid coordinates", () => {
    // a | (b / c): the b/c divider at y=0.5, moved to 0.75
    const layout = splitGroup(splitGroup(single("a"), "a", "b", "right"), "b", "c", "down");
    const moved = moveSash(layout, [1], 0, 0.75);
    expect(measure(moved).rects.get("c")).toEqual({ x: 0.5, y: 0.75, w: 0.5, h: 0.25 });
  });
});

describe("neighbour", () => {
  const grid = presetLayout("grid", ["a", "b", "c", "d"]);
  it("finds the group on each side, and none past the edge", () => {
    expect(neighbour(grid, "a", "right")).toBe("b");
    expect(neighbour(grid, "a", "down")).toBe("c");
    expect(neighbour(grid, "d", "left")).toBe("c");
    expect(neighbour(grid, "d", "up")).toBe("b");
    expect(neighbour(grid, "a", "left")).toBeNull();
  });
  it("prefers the most overlapping one when several touch", () => {
    const layout = presetLayout("rowsRight", ["a", "b", "c"]);
    expect(neighbour(layout, "b", "left")).toBe("a");
    expect(["b", "c"]).toContain(neighbour(layout, "a", "right"));
  });
});

describe("evenSizes, flip, presets, isLayout", () => {
  it("evens and flips every level", () => {
    const moved = moveSash(presetLayout("columns2", ["a", "b"]), [], 0, 0.8);
    expect(evenSizes(moved)).toEqual(presetLayout("columns2", ["a", "b"]));
    expect(flip(presetLayout("columns2", ["a", "b"]))).toEqual(presetLayout("rows2", ["a", "b"]));
  });

  it("builds each preset with its groups in reading order", () => {
    expect(groupIds(presetLayout("grid", ["a", "b", "c", "d"]))).toEqual(["a", "b", "c", "d"]);
    expect(groupIds(presetLayout("columnsBottom", ["a", "b", "c"]))).toEqual(["a", "b", "c"]);
  });

  it("accepts only well-formed stored layouts", () => {
    expect(isLayout(presetLayout("grid", ["a", "b", "c", "d"]))).toBe(true);
    expect(isLayout({ kind: "split", axis: "row", children: [single("a")], sizes: [1] })).toBe(false);
    expect(isLayout({ kind: "group" })).toBe(false);
    expect(isLayout(null)).toBe(false);
  });
});
