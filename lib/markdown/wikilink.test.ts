import { describe, expect, it } from "vitest";
import { extractWikiLinks, linksTo, normaliseTitle } from "./wikilink";

describe("normaliseTitle", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(normaliseTitle("  Reading List  ")).toBe("reading list");
  });

  it("collapses internal whitespace, so a double space still matches", () => {
    expect(normaliseTitle("Q3   planning")).toBe("q3 planning");
  });
});

describe("extractWikiLinks", () => {
  it("finds a link", () => {
    expect(extractWikiLinks("see [[Reading list]] later")).toEqual(["Reading list"]);
  });

  it("finds several and keeps first-seen order", () => {
    expect(extractWikiLinks("[[B]] then [[A]] then [[B]]")).toEqual(["B", "A"]);
  });

  it("dedupes case-variant links to the first spelling seen", () => {
    expect(extractWikiLinks("[[Notes]] and [[notes]]")).toEqual(["Notes"]);
  });

  it("ignores links inside inline code (R10.4)", () => {
    expect(extractWikiLinks("`[[Not a link]]` but [[Real]]")).toEqual(["Real"]);
  });

  it("ignores links inside a fenced block (R10.4)", () => {
    const doc = ["```md", "[[Inside fence]]", "```", "", "[[Outside]]"].join("\n");
    expect(extractWikiLinks(doc)).toEqual(["Outside"]);
  });

  it("ignores an unterminated fence's contents", () => {
    expect(extractWikiLinks("```\n[[Inside]]")).toEqual([]);
  });

  it("rejects an empty or whitespace-only target", () => {
    expect(extractWikiLinks("[[]] [[   ]]")).toEqual([]);
  });

  it("does not let a target span lines", () => {
    expect(extractWikiLinks("[[one\ntwo]]")).toEqual([]);
  });

  it("is not confused by a normal markdown link", () => {
    expect(extractWikiLinks("[label](https://example.com)")).toEqual([]);
  });

  it("trims the target", () => {
    expect(extractWikiLinks("[[  Padded  ]]")).toEqual(["Padded"]);
  });
});

describe("linksTo", () => {
  it("matches regardless of case and spacing", () => {
    expect(linksTo("see [[Reading  List]]", "reading list")).toBe(true);
  });

  it("does not match a different note", () => {
    expect(linksTo("see [[Reading list]]", "Groceries")).toBe(false);
  });

  it("does not match a link that only appears inside code", () => {
    expect(linksTo("`[[Groceries]]`", "Groceries")).toBe(false);
  });

  it("is false for an empty title", () => {
    expect(linksTo("[[x]]", "")).toBe(false);
  });
});
