import { describe, expect, it } from "vitest";
import { paragraphAround } from "./currentParagraph";

describe("paragraphAround", () => {
  const lines = ["Title", "", "one", "two", "three", "", "four"];
  it("spans the run of non-blank lines", () => {
    expect(paragraphAround(lines, 3)).toEqual([2, 4]);
    expect(paragraphAround(lines, 6)).toEqual([6, 6]);
    expect(paragraphAround(lines, 0)).toEqual([0, 0]);
  });
  it("is just the line on a blank line", () => {
    expect(paragraphAround(lines, 1)).toEqual([1, 1]);
  });
});
