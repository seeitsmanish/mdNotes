import { describe, expect, it } from "vitest";
import { groupIds } from "./layout";
import * as W from "./workbench";

const start = () => W.initialWorkbench();
const tabsOf = (wb: W.Workbench) => W.orderedGroups(wb).map((g) => g.tabs.join(","));

describe("opening", () => {
  it("opens in the active group; a preview replaces the last preview", () => {
    let wb = W.openNote(start(), "a", { preview: true });
    wb = W.openNote(wb, "b", { preview: true });
    expect(tabsOf(wb)).toEqual(["b"]);
    wb = W.openNote(wb, "c");
    expect(tabsOf(wb)).toEqual(["b,c"]);
    expect(W.shownNote(wb)).toBe("c");
  });

  it("opens beside, in a new group, when given a side", () => {
    const wb = W.openNote(W.openNote(start(), "a"), "b", { side: "right" });
    expect(tabsOf(wb)).toEqual(["a", "b"]);
    expect(wb.active).toBe("g2");
  });

  it("skips a locked group, making one if every group is locked", () => {
    let wb = W.openNote(start(), "a");
    wb = W.toggleLock(wb, "g1");
    wb = W.openNote(wb, "b");
    expect(tabsOf(wb)).toEqual(["a", "b"]);
    expect(wb.active).toBe("g2");
  });

  it("allows the same note in two groups (Split Editor copies it)", () => {
    const wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "a" });
    expect(tabsOf(wb)).toEqual(["a", "a"]);
    expect(W.visibleNotes(wb)).toEqual(["a"]);
  });
});

describe("closing", () => {
  it("closes an emptied group, but never the last one", () => {
    let wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" });
    wb = W.closeTab(wb, "g2", "b");
    expect(groupIds(wb.layout)).toEqual(["g1"]);
    wb = W.closeTab(wb, "g1", "a");
    expect(groupIds(wb.layout)).toEqual(["g1"]);
    expect(W.shownNote(wb)).toBeNull();
  });

  it("remembers closed tabs and reopens them in their group, newest first", () => {
    let wb = W.openNote(W.openNote(start(), "a"), "b");
    wb = W.closeTab(wb, "g1", "b");
    wb = W.closeTab(wb, "g1", "a");
    wb = W.reopenClosed(wb);
    expect(W.shownNote(wb)).toBe("a");
    wb = W.reopenClosed(wb);
    expect(W.shownNote(wb)).toBe("b");
    expect(W.reopenClosed(wb)).toEqual(wb);
  });

  it("skips notes that can no longer open when reopening", () => {
    let wb = W.openNote(W.openNote(start(), "a"), "b");
    wb = W.closeTab(W.closeTab(wb, "g1", "b"), "g1", "a");
    expect(W.shownNote(W.reopenClosed(wb, (n) => n !== "a"))).toBe("b");
  });

  it("a deleted note leaves every group and the reopen list", () => {
    let wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "a" });
    wb = W.openNote(wb, "b");
    wb = W.closeEverywhere(wb, "a");
    expect(tabsOf(wb)).toEqual(["b"]);
    expect(wb.closed).toEqual([]);
  });
});

describe("moving tabs between groups", () => {
  it("moves a tab, closing the group it leaves empty", () => {
    let wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" });
    wb = W.moveTab(wb, "g2", "b", "g1", { index: 0 });
    expect(tabsOf(wb)).toEqual(["b,a"]);
  });

  it("copies with ⌥ held, keeping the original", () => {
    let wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" });
    wb = W.moveTab(wb, "g2", "b", "g1", { copy: true });
    expect(tabsOf(wb)).toEqual(["a,b", "b"]);
  });

  it("sends a tab to the side, splitting when nothing is there", () => {
    let wb = W.openNote(W.openNote(start(), "a"), "b");
    wb = W.sendTab(wb, "g1", "b", "down");
    expect(tabsOf(wb)).toEqual(["a", "b"]);
    wb = W.sendTab(wb, "g2", "b", "up");
    expect(tabsOf(wb)).toEqual(["a,b"]);
  });
});

describe("groups", () => {
  it("joins a group into its neighbour", () => {
    const wb = W.joinGroup(W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" }), "g2");
    expect(tabsOf(wb)).toEqual(["a,b"]);
  });

  it("focuses the n-th group, making one past the last", () => {
    let wb = W.openNote(start(), "a");
    wb = W.focusGroupAt(wb, 2);
    expect(groupIds(wb.layout)).toEqual(["g1", "g2"]);
    expect(wb.active).toBe("g2");
    wb = W.focusGroupAt(wb, 1);
    expect(wb.active).toBe("g1");
  });

  it("maximises a group and shows all again when another is focused", () => {
    let wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" });
    wb = W.toggleMaximize(wb, "g1");
    expect(wb.maximized).toBe("g1");
    expect(W.visibleNotes(wb)).toEqual(["a"]);
    expect(W.focusGroup(wb, "g2").maximized).toBeNull();
  });

  it("applies a preset, merging extra groups and making missing ones", () => {
    let wb = W.split(W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" }), "g2", "right", { note: "c" });
    wb = W.applyPreset(wb, "columns2");
    expect(tabsOf(wb)).toEqual(["a", "b,c"]);
    wb = W.applyPreset(wb, "grid");
    expect(groupIds(wb.layout)).toHaveLength(4);
  });

  it("steps through tabs and picks the n-th, 9 being the last", () => {
    let wb = W.openNote(W.openNote(W.openNote(start(), "a"), "b"), "c");
    wb = W.step(wb, 1);
    expect(W.shownNote(wb)).toBe("a");
    wb = W.tabAt(wb, 9);
    expect(W.shownNote(wb)).toBe("c");
    wb = W.tabAt(wb, 2);
    expect(W.shownNote(wb)).toBe("b");
  });

  it("typing in a preview keeps it in every group", () => {
    let wb = W.openNote(start(), "a", { preview: true });
    wb = W.keepEverywhere(wb, "a");
    expect(W.activeGroup(wb).preview).toBeNull();
  });
});

describe("restore", () => {
  it("round-trips a stored workbench and rejects a broken one", () => {
    const wb = W.split(W.openNote(start(), "a"), "g1", "down", { note: "b" });
    const back = W.restore(JSON.parse(JSON.stringify(wb)));
    expect(tabsOf(back)).toEqual(["a", "b"]);
    expect(back.seq).toBe(2);
    expect(W.restore({ layout: { kind: "group", id: "g9" }, groups: {} })).toEqual(W.initialWorkbench());
    expect(W.restore("nonsense")).toEqual(W.initialWorkbench());
  });
});

describe("drag and drop", () => {
  it("dropping in the middle moves into the group; on an edge it splits", () => {
    let wb = W.openNote(W.openNote(start(), "a"), "b");
    wb = W.dropTab(wb, "g1", "b", "g1", "right");
    expect(tabsOf(wb)).toEqual(["a", "b"]);
    wb = W.dropTab(wb, "g2", "b", "g1", null);
    expect(tabsOf(wb)).toEqual(["a,b"]);
  });

  it("an edge drop from another group moves the tab, closing an emptied group", () => {
    let wb = W.split(W.openNote(start(), "a"), "g1", "right", { note: "b" });
    wb = W.dropTab(wb, "g2", "b", "g1", "down");
    expect(tabsOf(wb)).toEqual(["a", "b"]);
    expect(groupIds(wb.layout)).toHaveLength(2);
    expect(wb.groups[wb.active]!.tabs).toEqual(["b"]);
  });

  it("⌥ copies, and a note from the list opens where it lands", () => {
    let wb = W.openNote(start(), "a");
    wb = W.dropTab(wb, "g1", "a", "g1", "right", true);
    expect(tabsOf(wb)).toEqual(["a", "a"]);
    wb = W.dropTab(wb, null, "z", "g1", "down");
    expect(tabsOf(wb)).toEqual(["a", "z", "a"]);
  });

  it("opens to the side, reusing the group on the right", () => {
    let wb = W.openToSide(W.openNote(start(), "a"), "b");
    expect(tabsOf(wb)).toEqual(["a", "b"]);
    wb = W.focusGroup(wb, "g1");
    wb = W.openToSide(wb, "c");
    expect(tabsOf(wb)).toEqual(["a", "b,c"]);
  });
});
