import { describe, expect, it } from "vitest";
import { parseNotePatch } from "./patch";

describe("parseNotePatch", () => {
  it("accepts a body with the version it was edited from", () => {
    expect(parseNotePatch({ body: "x", baseVersion: 3 })).toEqual({
      ok: true,
      patch: { body: "x", baseVersion: 3 },
    });
  });

  it("treats a body without a version as an unconditional save (R18.6)", () => {
    expect(parseNotePatch({ body: "x" })).toEqual({ ok: true, patch: { body: "x" } });
    expect(parseNotePatch({ body: "x", baseVersion: null })).toEqual({
      ok: true,
      patch: { body: "x" },
    });
  });

  it("drops a version sent without a body, so pinning cannot conflict", () => {
    expect(parseNotePatch({ pinned: true, baseVersion: 2 })).toEqual({
      ok: true,
      patch: { pinned: true },
    });
  });

  it("accepts version 0, which every new note starts at", () => {
    expect(parseNotePatch({ body: "", baseVersion: 0 })).toEqual({
      ok: true,
      patch: { body: "", baseVersion: 0 },
    });
  });

  it.each([
    [{ baseVersion: -1, body: "x" }],
    [{ baseVersion: 1.5, body: "x" }],
    [{ baseVersion: "3", body: "x" }],
    [{ baseVersion: Number.MAX_SAFE_INTEGER + 1, body: "x" }],
    [{ body: 42 }],
    [{ pinned: "yes" }],
    [null],
    [[]],
    ["body"],
  ])("rejects %j", (payload) => {
    expect(parseNotePatch(payload).ok).toBe(false);
  });
});

describe("parseNotePatch labels (PRD §4.65)", () => {
  it("accepts archive, colour and template flags", () => {
    expect(parseNotePatch({ archived: true, color: "blue", template: false })).toEqual({
      ok: true,
      patch: { archived: true, color: "blue", template: false },
    });
    expect(parseNotePatch({ color: null })).toEqual({ ok: true, patch: { color: null } });
  });

  it.each([[{ archived: "yes" }], [{ color: "#ff0000" }], [{ color: "pink" }], [{ template: 1 }]])(
    "rejects %j",
    (payload) => {
      expect(parseNotePatch(payload).ok).toBe(false);
    },
  );
});

describe("parseNotePatch lock (PRD §4.69)", () => {
  it("accepts a boolean lock and nothing else", () => {
    expect(parseNotePatch({ locked: true })).toEqual({ ok: true, patch: { locked: true } });
    expect(parseNotePatch({ locked: "yes" }).ok).toBe(false);
  });
});
