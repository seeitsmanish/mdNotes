import { beforeEach, describe, expect, it } from "vitest";
import * as W from "@/lib/workbench/workbench";
import { useUiStore } from "./useUiStore";

const store = () => useUiStore.getState();

beforeEach(() => {
  useUiStore.setState({
    selectedNoteId: null,
    wb: W.initialWorkbench(),
    splitAvailable: true,
    mobilePane: "list",
    filter: "all",
  });
});

describe("the store and editor groups (§4.81)", () => {
  it("the selection is always the active group's shown note", () => {
    store().openNote("a", { preview: true });
    expect(store().selectedNoteId).toBe("a");
    store().workbench((wb) => W.split(wb, "g1", "right", { note: "b" }));
    expect(store().selectedNoteId).toBe("b");
    store().workbench((wb) => W.focusGroup(wb, "g1"));
    expect(store().selectedNoteId).toBe("a");
  });

  it("on a wide screen a filter change leaves the notes open", () => {
    store().selectNote("a");
    store().setFilter("archive");
    expect(store().selectedNoteId).toBe("a");
  });

  it("on a phone, back clears the selection but keeps the tabs; a filter shows the list", () => {
    useUiStore.setState({ splitAvailable: false });
    store().selectNote("a");
    expect(store().mobilePane).toBe("editor");
    store().selectNote(null);
    expect(store().selectedNoteId).toBeNull();
    expect(W.activeGroup(store().wb).tabs).toEqual(["a"]);
    store().selectNote("b");
    store().setFilter("archive");
    expect(store().mobilePane).toBe("list");
  });

  it("growing wide shows the active group's note", () => {
    useUiStore.setState({ splitAvailable: false });
    store().selectNote("a");
    store().selectNote(null);
    store().setSplitAvailable(true);
    expect(store().selectedNoteId).toBe("a");
  });

  it("keeps the layout across a reload, checked, without the reopen list", () => {
    store().openNote("a");
    store().workbench((wb) => W.closeTab(W.split(wb, "g1", "down", { note: "b" }), "g2", "b"));
    store().workbench((wb) => W.split(wb, "g1", "right", { note: "c" }));
    const options = useUiStore.persist.getOptions();
    const saved = options.partialize!(useUiStore.getState()) as { wb: W.Workbench };
    expect(saved.wb.closed).toEqual([]);
    const merged = options.merge!(JSON.parse(JSON.stringify(saved)), useUiStore.getState()) as { wb: W.Workbench };
    expect(W.orderedGroups(merged.wb).map((g) => g.tabs)).toEqual([["a"], ["c"]]);
    const broken = options.merge!({ wb: { layout: 7 } }, useUiStore.getState()) as { wb: W.Workbench };
    expect(broken.wb).toEqual(W.initialWorkbench());
  });
});
