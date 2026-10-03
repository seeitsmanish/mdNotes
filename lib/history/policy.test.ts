import { describe, expect, it } from "vitest";
import { SNAPSHOT_INTERVAL_MS, snapshotReason } from "./policy";

const now = new Date("2026-10-04T02:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const long = "x".repeat(1000);

describe("snapshotReason", () => {
  it("keeps the first version of a note that has never had one", () => {
    expect(snapshotReason({ previous: "draft", next: "draft 2", lastRevisionAt: null, now })).toBe("interval");
  });

  it("does not keep a copy on every keystroke", () => {
    expect(snapshotReason({ previous: "a", next: "ab", lastRevisionAt: ago(30_000), now })).toBeNull();
  });

  it("keeps one again once the interval has passed", () => {
    expect(
      snapshotReason({ previous: "a", next: "ab", lastRevisionAt: ago(SNAPSHOT_INTERVAL_MS), now }),
    ).toBe("interval");
  });

  it("always keeps the text before a save that removes most of a note", () => {
    expect(snapshotReason({ previous: long, next: "", lastRevisionAt: ago(1000), now })).toBe("big-cut");
    expect(snapshotReason({ previous: long, next: long.slice(0, 400), lastRevisionAt: ago(1000), now })).toBe("big-cut");
  });

  it("does not treat trimming a short note as a big cut", () => {
    expect(snapshotReason({ previous: "short note", next: "", lastRevisionAt: ago(1000), now })).toBeNull();
  });

  it("keeps nothing when nothing changed or the note was empty", () => {
    expect(snapshotReason({ previous: long, next: long, lastRevisionAt: null, now })).toBeNull();
    expect(snapshotReason({ previous: "  \n", next: "new", lastRevisionAt: null, now })).toBeNull();
  });
});
