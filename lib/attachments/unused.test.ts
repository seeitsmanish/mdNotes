import { describe, expect, it } from "vitest";
import { findUnused, UNUSED_GRACE_MS } from "./unused";

const now = new Date("2026-10-04T03:00:00Z");
const old = new Date(now.getTime() - UNUSED_GRACE_MS * 2);
const img = (id: string, createdAt = old) => ({ id, size: 1000, createdAt });
const A = "cmusr53c70000ab7dqym3sfwa";
const B = "cmusr53c70000ab7dqym3sfwb";
const C = "cmusr53c70000ab7dqym3sfwc";

describe("findUnused", () => {
  it("keeps images any note refers to, and finds the rest", () => {
    const bodies = [`![x](/api/attachments/${A})`];
    expect(findUnused([img(A), img(B)], bodies, now).map((i) => i.id)).toEqual([B]);
  });

  it("keeps an image only an old version of a note refers to", () => {
    const noteNow = "text without the image";
    const keptVersion = `![x](/api/attachments/${B})`;
    expect(findUnused([img(B)], [noteNow, keptVersion], now)).toEqual([]);
  });

  it("never counts a just-uploaded image as unused", () => {
    expect(findUnused([img(C, new Date(now.getTime() - 60_000))], [], now)).toEqual([]);
  });

  it("finds nothing when nothing is stored", () => {
    expect(findUnused([], ["anything"], now)).toEqual([]);
  });
});
