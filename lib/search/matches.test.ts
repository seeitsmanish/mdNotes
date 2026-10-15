import { describe, expect, it } from "vitest";
import { findMatches, foldChars, findPhrase, matchFrom } from "./matches";

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

describe("findPhrase (§4.79)", () => {
  it("finds the phrase as typed, not its words separately", () => {
    expect(findPhrase("red apple, apple red, red apple", "red apple")).toEqual([
      { from: 0, to: 9 },
      { from: 22, to: 31 },
    ]);
  });

  it("ignores case and accents, keeping positions in the note", () => {
    const body = "Café and CAFE and cafe";
    expect(findPhrase(body, "cafe").map((r) => body.slice(r.from, r.to))).toEqual(["Café", "CAFE", "cafe"]);
  });

  it("keeps spaces inside the query and finds nothing for a blank one", () => {
    expect(findPhrase("a b ab", " b")).toEqual([{ from: 1, to: 3 }]);
    expect(findPhrase("anything", "   ")).toEqual([]);
  });

  it("does not overlap and stops at the cap", () => {
    expect(findPhrase("aaaa", "aa")).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ]);
    expect(findPhrase("x".repeat(50), "x", 10)).toHaveLength(10);
  });
});

describe("matchFrom", () => {
  const ranges = [
    { from: 2, to: 4 },
    { from: 10, to: 12 },
  ];
  it("lands on the first match at or after the caret, wrapping round", () => {
    expect(matchFrom(ranges, 0)).toBe(0);
    expect(matchFrom(ranges, 2)).toBe(0);
    expect(matchFrom(ranges, 5)).toBe(1);
    expect(matchFrom(ranges, 11)).toBe(0);
    expect(matchFrom([], 3)).toBe(-1);
  });
});
