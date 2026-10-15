import { describe, expect, it } from "vitest";
import {
  activate,
  close,
  closeAll,
  closeOthers,
  closeToRight,
  emptyGroup,
  type Group,
  isGroup,
  keep,
  move,
  open,
  pin,
  stepTab,
  unpin,
} from "./group";

const g = (tabs: string[], active: string | null, extra: Partial<Group> = {}): Group => ({
  ...emptyGroup("g1"),
  tabs,
  active,
  mru: active ? [active, ...tabs.filter((t) => t !== active)] : [...tabs],
  ...extra,
});

describe("preview tabs", () => {
  it("a preview replaces the previous preview instead of adding a tab", () => {
    let group = open(emptyGroup("g1"), "a", { preview: true });
    group = open(group, "b", { preview: true });
    expect(group.tabs).toEqual(["b"]);
    expect(group.preview).toBe("b");
  });

  it("opening for keeps adds a tab beside the shown one and leaves the preview alone", () => {
    let group = open(emptyGroup("g1"), "a");
    group = open(group, "b", { preview: true });
    group = open(group, "c");
    expect(group.tabs).toEqual(["a", "b", "c"]);
    expect(group.preview).toBe("b");
  });

  it("opening the preview again for keeps, or Keep Open, makes it normal", () => {
    const group = open(emptyGroup("g1"), "a", { preview: true });
    expect(open(group, "a").preview).toBeNull();
    expect(keep(group, "a").preview).toBeNull();
    expect(open(group, "a", { preview: true }).preview).toBe("a");
  });
});

describe("close", () => {
  it("shows the tab used most recently before the closed one", () => {
    let group = open(emptyGroup("g1"), "a");
    group = open(group, "b");
    group = open(group, "c");
    group = activate(group, "a");
    group = activate(group, "c");
    expect(close(group, "c").active).toBe("a");
  });

  it("Close Others, to the Right and All spare pinned tabs", () => {
    const group = pin(g(["a", "b", "c", "d"], "c"), "d");
    expect(group.tabs).toEqual(["d", "a", "b", "c"]);
    expect(closeOthers(group, "b").tabs).toEqual(["d", "b"]);
    expect(closeToRight(group, "a").tabs).toEqual(["d", "a"]);
    expect(closeAll(group).tabs).toEqual(["d"]);
    expect(closeAll(group, true).tabs).toEqual([]);
    expect(closeAll(group, true).active).toBeNull();
  });
});

describe("pin, unpin, move", () => {
  it("pinned tabs go first; unpinning puts a tab straight after them", () => {
    let group = pin(g(["a", "b", "c"], "a"), "c");
    group = pin(group, "b");
    expect(group.tabs).toEqual(["c", "b", "a"]);
    expect(unpin(group, "c").tabs).toEqual(["b", "c", "a"]);
  });

  it("new tabs never open among the pinned", () => {
    const group = pin(g(["a", "b"], "a"), "b");
    expect(open(group, "c", { index: 0 }).tabs).toEqual(["b", "c", "a"]);
  });

  it("drags stay on their own side of the pinned line", () => {
    const group = pin(g(["a", "b", "c"], "a"), "a");
    expect(move(group, "c", 0).tabs).toEqual(["a", "c", "b"]);
    expect(move(group, "b", 3).tabs).toEqual(["a", "c", "b"]);
    expect(move(group, "a", 3).tabs).toEqual(["a", "b", "c"]);
  });
});

describe("stepTab and isGroup", () => {
  it("steps through tabs, wrapping round", () => {
    const group = g(["a", "b", "c"], "c");
    expect(stepTab(group, 1)).toBe("a");
    expect(stepTab(group, -1)).toBe("b");
    expect(stepTab(emptyGroup("x"), 1)).toBeNull();
  });

  it("checks stored groups", () => {
    expect(isGroup(g(["a"], "a"))).toBe(true);
    expect(isGroup({ id: "g1", tabs: [1] })).toBe(false);
  });
});
