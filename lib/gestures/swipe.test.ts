import { describe, expect, it } from "vitest";
import { dragOffset, lockAxis, settle } from "./swipe";

describe("lockAxis", () => {
  it("waits for a clear direction", () => {
    expect(lockAxis(4, 3)).toBeNull();
    expect(lockAxis(-20, 5)).toBe("x");
    expect(lockAxis(6, 30)).toBe("y");
  });
});

describe("dragOffset", () => {
  it("follows the finger leftward up to the actions", () => {
    expect(dragOffset(0, -50, 144, 360)).toBe(-50);
    expect(dragOffset(0, 40, 144, 360)).toBe(0);
  });

  it("resists past the actions and never leaves the row", () => {
    expect(dragOffset(0, -200, 144, 360)).toBeCloseTo(-(144 + 56 * 0.6));
    expect(dragOffset(0, -2000, 144, 360)).toBe(-360);
  });

  it("continues from an open row", () => {
    expect(dragOffset(-144, 60, 144, 360)).toBe(-84);
  });
});

describe("settle", () => {
  it("opens past half the actions, or on a flick", () => {
    expect(settle(-80, 0, 144, 360, true)).toBe("open");
    expect(settle(-30, -0.8, 144, 360, true)).toBe("open");
    expect(settle(-50, 0, 144, 360, true)).toBe("closed");
  });

  it("full-swipes most of the way across, or on a hard flick past the actions", () => {
    expect(settle(-250, 0, 144, 360, true)).toBe("full");
    expect(settle(-160, -1.5, 144, 360, true)).toBe("full");
  });

  it("never full-swipes where it is not allowed", () => {
    expect(settle(-300, -3, 144, 360, false)).toBe("open");
  });
});
