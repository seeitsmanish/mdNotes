import { describe, expect, it } from "vitest";
import { evaluate, evaluateLines, formatValue } from "./calc";

const show = (source: string) => {
  const value = evaluate(source);
  return value ? formatValue(value) : null;
};

describe("evaluate", () => {
  it.each([
    ["2 + 3", "5"],
    ["2 + 3 * 4", "14"],
    ["(2 + 3) * 4", "20"],
    ["10 / 4", "2.5"],
    ["2 ^ 10", "1,024"],
    ["2 ^ 3 ^ 2", "512"],
    ["-3 + 5", "2"],
    ["1,200 * 3", "3,600"],
    ["3 x 4", "12"],
    ["3 × 4 ÷ 2", "6"],
    ["18% of 240", "43.2"],
    ["240 * 15%", "36"],
    ["₹1,200 * 3", "₹3,600"],
    ["$19.99 * 3", "$59.97"],
    ["100 - $250", "-$150"],
    ["sqrt(144) + abs(-2)", "14"],
    ["round(10 / 3, 2)", "3.33"],
    ["max(3, 9, 4)", "9"],
    ["0.1 + 0.2", "0.3"],
    ["₹100 / 3", "₹33.33"],
    ["1 / 3", "0.3333"],
    ["1 / 30000", "0.0000333333"],
  ])("%s = %s", (source, expected) => {
    expect(show(source)).toBe(expected);
  });

  it.each([
    ["42"], // nothing to compute
    ["How fast is it"],
    ["a || b"],
    ["2 +"],
    ["(2 + 3"],
    ["1 / 0"],
    ["unknown * 2"],
    ["alert(1)"],
    ["constructor"],
    ["constructor(1) + 1"],
    ["toString(2) * 3"],
    ["__proto__ + 1"],
    [""],
  ])("shows nothing for %j", (source) => {
    expect(show(source)).toBeNull();
  });
});

describe("evaluateLines", () => {
  it("answers lines ending in = and leaves prose alone", () => {
    expect(evaluateLines(["Groceries", "12 * 4.5 =", "Is this right =", "done"])).toEqual([
      { line: 1, text: "54" },
    ]);
  });

  it("defines names top to bottom", () => {
    const lines = ["rent = 1,450", "utilities = 210", "rent + utilities =", "rent * 12 ="];
    expect(evaluateLines(lines)).toEqual([
      { line: 2, text: "1,660" },
      { line: 3, text: "17,400" },
    ]);
  });

  it("does not use a name before it is defined", () => {
    expect(evaluateLines(["price * 2 =", "price = 10", "price * 2 ="])).toEqual([
      { line: 2, text: "20" },
    ]);
  });

  it("totals the block above, resetting at a blank line or heading", () => {
    const lines = [
      "## Trip",
      "flights = ₹18,000",
      "hotel = ₹3,500 * 3",
      "total =",
      "",
      "5 + 5 =",
      "total =",
    ];
    expect(evaluateLines(lines)).toEqual([
      { line: 3, text: "₹28,500" },
      { line: 5, text: "10" },
      { line: 6, text: "10" },
    ]);
  });

  it("treats words before the math as a label", () => {
    expect(evaluateLines(["food: ₹900 * 4 * 2 =", "Tip at 18% of 2,340 =", "Is this right ="])).toEqual([
      { line: 0, text: "₹7,200" },
      { line: 1, text: "421.2" },
    ]);
  });

  it("lets names contain spaces", () => {
    const lines = ["per person = (18400 + 3250 * 4) / 3", "per person =", "Per  Person * 2 ="];
    expect(evaluateLines(lines)).toEqual([
      { line: 1, text: "10,466.6667" },
      { line: 2, text: "20,933.3333" },
    ]);
  });

  it("includes labelled lines in a total", () => {
    expect(evaluateLines(["flights = ₹18,400", "- food: ₹900 * 4 =", "total ="])).toEqual([
      { line: 1, text: "₹3,600" },
      { line: 2, text: "₹22,000" },
    ]);
  });

  it("reads through list, to-do and quote prefixes", () => {
    expect(evaluateLines(["- 2 * 3 =", "1. 10 / 4 =", "- [ ] 5 + 5 =", "> 9 - 1 ="])).toEqual([
      { line: 0, text: "6" },
      { line: 1, text: "2.5" },
      { line: 2, text: "10" },
      { line: 3, text: "8" },
    ]);
  });

  it("ignores code blocks, where = means something else", () => {
    expect(evaluateLines(["```js", "x = 1 + 2", "1 + 2 =", "```", "1 + 2 ="])).toEqual([
      { line: 4, text: "3" },
    ]);
  });
});

describe("cost", () => {
  it("re-reads a 50k-character note well inside one frame", () => {
    const block = ["rent = 1,450", "food = 320 * 4", "rent + food =", "Some prose that is not math at all, just words.", ""];
    const lines: string[] = [];
    while (lines.join("\n").length < 50_000) lines.push(...block);
    // Best of several runs: one slow sample from machine load must not fail
    // the suite (AGENT-LOOP §3, wall-clock assertions).
    let best = Infinity;
    for (let run = 0; run < 7; run += 1) {
      const start = performance.now();
      evaluateLines(lines);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(8);
  });
});
