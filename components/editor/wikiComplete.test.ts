import { describe, expect, it } from "vitest";
import { rankTitles, wikiQuery } from "./wikiComplete";

describe("wikiQuery", () => {
  it("reads the partial title after an open [[", () => {
    expect(wikiQuery("see [[Goo")).toEqual({ offset: 6, query: "Goo" });
    expect(wikiQuery("[[")).toEqual({ offset: 2, query: "" });
  });

  it("is closed by ]] and does not span brackets", () => {
    expect(wikiQuery("[[Google]] and")).toBeNull();
    expect(wikiQuery("[x](y)")).toBeNull();
    expect(wikiQuery("[[a]b")).toBeNull();
  });
});

describe("rankTitles", () => {
  const titles = ["Google onsite", "Meta", "My Google notes", "Café list", "Meta", ""];

  it("puts prefix matches before matches inside the title", () => {
    expect(rankTitles(titles, "goo")).toEqual(["Google onsite", "My Google notes"]);
  });

  it("ignores accents and case, and drops duplicates and blanks", () => {
    expect(rankTitles(titles, "CAFE")).toEqual(["Café list"]);
    expect(rankTitles(titles, "")).toEqual(["Google onsite", "Meta", "My Google notes", "Café list"]);
  });
});
