import { describe, expect, it } from "vitest";
import { pushRecent, recentNotes } from "./recent";

describe("recent notes", () => {
  it("moves a reopened note to the front and caps the list", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
  });

  it("lists existing notes in recency order, skipping the open one and deleted ones", () => {
    const notes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(recentNotes(["c", "x", "a", "b"], notes, "c").map((n) => n.id)).toEqual(["a", "b"]);
  });
});
