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
