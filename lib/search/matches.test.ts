import { describe, expect, it } from "vitest";
import { findMatches, foldChars } from "./matches";

describe("foldChars", () => {
  it("keeps the note's length so positions line up", () => {
    for (const s of ["Café Ünïcode", "Straße", "İstanbul", "emoji 😀 ok"]) {
      expect(foldChars(s)).toHaveLength(s.length);
    }
    expect(foldChars("Café")).toBe("cafe");
  });
});

describe("findMatches", () => {
  it("finds every term, ignoring case and accents", () => {
    const body = "Café at noon. Another CAFE later.";
    expect(findMatches(body, "cafe")).toEqual([
      { from: 0, to: 4 },
      { from: 22, to: 26 },
    ]);
  });

  it("matches each word of a multi-word search and merges overlaps", () => {
    const body = "rate limiter design";
    expect(findMatches(body, "limit rate")).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 10 },
    ]);
    expect(findMatches("aaaa", "aa a")).toEqual([{ from: 0, to: 4 }]);
  });

  it("returns nothing for an empty search", () => {
    expect(findMatches("anything", "   ")).toEqual([]);
  });

  it("caps the work on a huge note", () => {
    expect(findMatches("a".repeat(10_000), "a", 50)).toHaveLength(1);
    expect(findMatches("ab ".repeat(10_000), "ab", 50)).toHaveLength(50);
  });

  it("lands on the right text after an emoji", () => {
    const body = "😀 find me";
    const [hit] = findMatches(body, "find");
    expect(body.slice(hit!.from, hit!.to)).toBe("find");
  });
});
