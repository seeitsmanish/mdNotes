import { describe, expect, it } from "vitest";
import { blockAt, moveBlock } from "./blocks";

const doc = [
  "# Groceries", // 0
  "", // 1
  "- Milk", // 2
  "- Eggs", // 3
  "  - free range", // 4
  "  - a dozen", // 5
  "- Bread", // 6
  "", // 7
  "A paragraph that", // 8
  "wraps onto two lines.", // 9
  "", // 10
  "```js", // 11
  "const a = 1;", // 12
  "```", // 13
];

describe("blockAt", () => {
  it("takes a list item with its nested items", () => {
    expect(blockAt(doc, 3)).toEqual([3, 5]);
    expect(blockAt(doc, 2)).toEqual([2, 2]);
    expect(blockAt(doc, 4)).toEqual([4, 4]);
  });
  it("takes a heading alone, a whole paragraph, a whole fence", () => {
    expect(blockAt(doc, 0)).toEqual([0, 0]);
    expect(blockAt(doc, 9)).toEqual([8, 9]);
    expect(blockAt(doc, 12)).toEqual([11, 13]);
  });
  it("picks up nothing on a blank line", () => {
    expect(blockAt(doc, 1)).toBeNull();
  });
});

describe("moveBlock", () => {
  it("moves an item with its children below a later item", () => {
    const moved = moveBlock(doc, [3, 5], 7)!;
    expect(moved.lines.slice(2, 7)).toEqual(["- Milk", "- Bread", "- Eggs", "  - free range", "  - a dozen"]);
    expect(moved.start).toBe(4);
  });
  it("moves a block up", () => {
    const moved = moveBlock(doc, [6, 6], 2)!;
    expect(moved.lines.slice(2, 7)).toEqual(["- Bread", "- Milk", "- Eggs", "  - free range", "  - a dozen"]);
    expect(moved.start).toBe(2);
  });
  it("is a no-op when dropped on itself", () => {
    expect(moveBlock(doc, [3, 5], 4)).toBeNull();
    expect(moveBlock(doc, [3, 5], 6)).toBeNull();
  });
  it("keeps every line", () => {
    const moved = moveBlock(doc, [8, 9], 0)!;
    expect([...moved.lines].sort()).toEqual([...doc].sort());
  });
});
