import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("finds nothing gone between identical texts", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual({ goneNow: [false, false], removed: 0, added: 0, compared: true });
  });

  it("marks the lines an edit removed, and counts what it added", () => {
    const earlier = "# Plan\nbuy milk\ncall mum\nbook flights";
    const now = "# Plan\ncall mum\nbook flights\npack";
    expect(diffLines(earlier, now)).toEqual({
      goneNow: [false, true, false, false],
      removed: 1,
      added: 1,
      compared: true,
    });
  });

  it("sees a select-all-delete as every line gone", () => {
    const d = diffLines("one\ntwo\nthree", "");
    expect(d.removed).toBe(3);
    expect(d.goneNow).toEqual([true, true, true]);
  });

  it("treats a changed line as one removed and one added", () => {
    expect(diffLines("hello world", "hello there")).toMatchObject({ removed: 1, added: 1 });
  });

  it("gives up gracefully on texts too large to compare", () => {
    const big = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join("\n");
    expect(diffLines(big, `${big}\nmore`).compared).toBe(false);
  });
});
