import { describe, expect, it } from "vitest";
import { closeTab, EMPTY_TABS, mergeTabs, moveTab, openTab } from "./tabs";

describe("openTab", () => {
  it("opens the first note as a tab", () => {
    expect(openTab(EMPTY_TABS, "a")).toEqual({ ids: ["a"], active: "a" });
  });

  it("replaces the shown tab, like following a link", () => {
    expect(openTab({ ids: ["a", "b"], active: "a" }, "c")).toEqual({ ids: ["c", "b"], active: "c" });
  });

  it("opens beside the shown tab when asked for a new tab", () => {
    expect(openTab({ ids: ["a", "b"], active: "a" }, "c", true)).toEqual({ ids: ["a", "c", "b"], active: "c" });
  });

  it("switches to a note that already has a tab instead of opening it twice", () => {
    expect(openTab({ ids: ["a", "b"], active: "a" }, "b", true)).toEqual({ ids: ["a", "b"], active: "b" });
  });

  it("appends when nothing is shown", () => {
    expect(openTab({ ids: ["a"], active: null }, "b")).toEqual({ ids: ["a", "b"], active: "b" });
  });
});

describe("closeTab", () => {
  const tabs = { ids: ["a", "b", "c"], active: "b" };
  it("shows the right-hand neighbour after closing the shown tab", () => {
    expect(closeTab(tabs, "b")).toEqual({ ids: ["a", "c"], active: "c" });
  });
  it("falls back to the left at the end of the strip", () => {
    expect(closeTab({ ids: ["a", "b"], active: "b" }, "b")).toEqual({ ids: ["a"], active: "a" });
  });
  it("keeps the shown tab when closing another", () => {
    expect(closeTab(tabs, "a")).toEqual({ ids: ["b", "c"], active: "b" });
  });
  it("shows nothing after the last tab closes, and ignores unknown ids", () => {
    expect(closeTab({ ids: ["a"], active: "a" }, "a")).toEqual({ ids: [], active: null });
    expect(closeTab(tabs, "z")).toBe(tabs);
  });
});

describe("moveTab and mergeTabs", () => {
  it("reorders a tab, clamped to the strip", () => {
    expect(moveTab({ ids: ["a", "b", "c"], active: "a" }, "a", 2).ids).toEqual(["b", "c", "a"]);
    expect(moveTab({ ids: ["a", "b", "c"], active: "a" }, "c", -5).ids).toEqual(["c", "a", "b"]);
  });
  it("adds the split's tabs after the main pane's, without repeats", () => {
    expect(mergeTabs({ ids: ["a", "b"], active: "a" }, { ids: ["b", "c"], active: "c" })).toEqual({
      ids: ["a", "b", "c"],
      active: "a",
    });
    expect(mergeTabs({ ids: [], active: null }, { ids: ["c"], active: "c" })).toEqual({ ids: ["c"], active: "c" });
  });
});
