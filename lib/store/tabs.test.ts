import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./useUiStore";

const store = () => useUiStore.getState();

beforeEach(() => {
  useUiStore.setState({
    selectedNoteId: null,
    mainTabs: [],
    split: null,
    focusedPane: "main",
    splitAvailable: true,
    mobilePane: "list",
  });
});

describe("tabs and split routing (§4.80)", () => {
  it("a plain open replaces the shown note, so one tab stays one tab", () => {
    store().selectNote("a");
    store().selectNote("b");
    expect(store().mainTabs).toEqual(["b"]);
    expect(store().selectedNoteId).toBe("b");
  });

  it("a new tab opens beside, and opening it again just switches", () => {
    store().selectNote("a");
    store().openNote("b", { newTab: true });
    store().selectNote("a");
    expect(store().mainTabs).toEqual(["a", "b"]);
    expect(store().selectedNoteId).toBe("a");
  });

  it("opens into the split while it is the focused pane", () => {
    store().selectNote("a");
    store().openSplit("right");
    store().selectNote("b");
    expect(store().selectedNoteId).toBe("a");
    expect(store().split?.tabs).toEqual({ ids: ["b"], active: "b" });
  });

  it("never opens a note in both panes: it goes to where it already is", () => {
    store().selectNote("a");
    store().openSplit("down");
    store().selectNote("a");
    expect(store().split?.tabs.ids).toEqual([]);
    expect(store().focusedPane).toBe("main");
    store().openNote("b", { pane: "split" });
    store().setFocusedPane("main");
    store().selectNote("b");
    expect(store().selectedNoteId).toBe("a");
    expect(store().focusedPane).toBe("split");
  });

  it("closing the split keeps its tabs in the main pane", () => {
    store().selectNote("a");
    store().openSplit("right");
    store().selectNote("b");
    store().closeSplit();
    expect(store().split).toBeNull();
    expect(store().mainTabs).toEqual(["a", "b"]);
    expect(store().selectedNoteId).toBe("a");
  });

  it("a trashed note's tabs close everywhere, showing the next tab", () => {
    store().selectNote("a");
    store().openNote("b", { newTab: true });
    store().selectNote("a");
    store().closeEverywhere("a");
    expect(store().mainTabs).toEqual(["b"]);
    expect(store().selectedNoteId).toBe("b");
  });

  it("without room for a split, everything opens in the main pane", () => {
    store().selectNote("a");
    store().openSplit("right");
    store().setSplitAvailable(false);
    store().selectNote("b");
    expect(store().selectedNoteId).toBe("b");
  });

  it("changing the filter drops a lone tab, so the next note replaces it", () => {
    store().selectNote("a");
    store().setFilter("archive");
    store().selectNote("b");
    expect(store().mainTabs).toEqual(["b"]);
    store().setFilter("all");
  });

  it("keeps the split ratio between 20% and 80%", () => {
    store().openSplit("right");
    store().setSplitRatio(0.95);
    expect(store().split?.ratio).toBe(0.8);
    store().setSplitRatio(0.05);
    expect(store().split?.ratio).toBe(0.2);
  });
});
