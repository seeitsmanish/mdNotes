import { describe, expect, it } from "vitest";
import { fold, rank, score, terms } from "./rank";

const note = (
  id: string,
  title: string,
  body: string,
  extra: { pinned?: boolean; updatedAt?: string } = {},
) => ({
  id,
  title,
  body,
  pinned: extra.pinned ?? false,
  updatedAt: extra.updatedAt ?? "2026-01-01T00:00:00.000Z",
});

describe("fold", () => {
  it("lowercases and strips accents so cafe finds Café", () => {
    expect(fold("Café")).toBe("cafe");
    expect(fold("ÀÉÎÕÜ")).toBe("aeiou");
  });

  it("keeps length stable, which snippet offsets rely on", () => {
    for (const value of ["Café résumé", "plain text", "ÀÉÎÕÜ"]) {
      expect(fold(value).length).toBe(value.length);
    }
  });
});

describe("terms", () => {
  it("splits on whitespace and drops empties", () => {
    expect(terms("  Q3   planning ")).toEqual(["q3", "planning"]);
  });

  it("is empty for a blank query", () => {
    expect(terms("   ")).toEqual([]);
  });
});

describe("score", () => {
  it("requires every term, in any order (R11.3)", () => {
    const n = note("a", "Q3 planning", "three bets for the quarter");
    expect(score(n, ["quarter", "q3"])).not.toBeNull();
    expect(score(n, ["q3", "missing"])).toBeNull();
  });

  it("ranks a title match above a body match (R11.1)", () => {
    const titled = score(note("a", "Groceries", "nothing"), ["groceries"])!;
    const bodied = score(note("b", "Other", "buy groceries"), ["groceries"])!;
    expect(titled.score).toBeGreaterThan(bodied.score);
  });

  it("ranks an exact title above a title that merely contains the term", () => {
    const exact = score(note("a", "Groceries", ""), ["groceries"])!;
    const partial = score(note("b", "Groceries and errands", ""), ["groceries"])!;
    expect(exact.score).toBeGreaterThan(partial.score);
  });

  it("ranks an earlier body match above a later one", () => {
    const early = score(note("a", "x", "needle at the start"), ["needle"])!;
    const late = score(note("b", "x", `${"filler ".repeat(100)}needle`), ["needle"])!;
    expect(early.score).toBeGreaterThan(late.score);
  });

  it("finds accented text from an unaccented query (R11.4)", () => {
    expect(score(note("a", "Café notes", "visited the café"), ["cafe"])).not.toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(score(note("a", "x", "y"), [])).toBeNull();
  });
});

describe("snippets (R11.2)", () => {
  it("shows text around the match, not the opening line", () => {
    const body = `${"preamble ".repeat(30)}the needle is here, late in the note`;
    const hit = score(note("a", "x", body), ["needle"])!;
    expect(hit.snippet).toContain("needle");
    expect(hit.snippet.startsWith("…")).toBe(true);
  });

  it("marks the matched range correctly inside the snippet", () => {
    const hit = score(note("a", "x", "buy groceries today"), ["groceries"])!;
    const [from, to] = hit.marks[0]!;
    expect(hit.snippet.slice(from, to).toLowerCase()).toBe("groceries");
  });

  it("marks accented text using the unaccented query", () => {
    const hit = score(note("a", "x", "visited the Café today"), ["cafe"])!;
    const [from, to] = hit.marks[0]!;
    expect(hit.snippet.slice(from, to)).toBe("Café");
  });

  it("marks every occurrence and every term", () => {
    const hit = score(note("a", "x", "alpha beta alpha"), ["alpha", "beta"])!;
    expect(hit.marks.length).toBe(3);
  });

  it("does not ellipsis a short body", () => {
    const hit = score(note("a", "x", "short needle"), ["needle"])!;
    expect(hit.snippet).toBe("short needle");
  });
});

describe("rank", () => {
  it("orders best-first and drops non-matches", () => {
    const results = rank(
      [
        note("body", "Unrelated", "mentions groceries once"),
        note("title", "Groceries", "milk"),
        note("none", "Nothing", "nothing at all"),
      ],
      "groceries",
    );
    expect(results.map((r) => r.id)).toEqual(["title", "body"]);
  });

  it("uses recency only to break a tie", () => {
    const older = note("old", "Same", "same", { updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = note("new", "Same", "same", { updatedAt: "2026-06-01T00:00:00.000Z" });
    expect(rank([older, newer], "same").map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("does not let recency outrank relevance", () => {
    const relevant = note("relevant", "Groceries", "x", { updatedAt: "2020-01-01T00:00:00.000Z" });
    const recent = note("recent", "Other", "groceries somewhere", {
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(rank([relevant, recent], "groceries")[0]?.id).toBe("relevant");
  });

  it("is empty for a blank query", () => {
    expect(rank([note("a", "x", "y")], "   ")).toEqual([]);
  });
});
