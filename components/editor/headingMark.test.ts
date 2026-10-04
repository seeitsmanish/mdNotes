import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { headingMarkEnd } from "./decorations";

const doc = Text.of(["# Title", "##   Spaced", "## Closed ##", "plain"]);
const line = (n: number) => doc.line(n);

describe("headingMarkEnd", () => {
  it("takes the space after an opening mark", () => {
    expect(headingMarkEnd(doc, "HeaderMark", line(1).from, line(1).from + 1)).toBe(line(1).from + 2);
  });

  it("takes every space, so the text starts flush", () => {
    const l = line(2);
    expect(headingMarkEnd(doc, "HeaderMark", l.from, l.from + 2)).toBe(l.from + 5);
  });

  it("leaves a closing mark alone", () => {
    const l = line(3);
    expect(headingMarkEnd(doc, "HeaderMark", l.to - 2, l.to)).toBe(l.to);
  });

  it("leaves other marks alone", () => {
    expect(headingMarkEnd(doc, "EmphasisMark", line(4).from, line(4).from + 1)).toBe(line(4).from + 1);
  });
});
