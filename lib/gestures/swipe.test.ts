import { describe, expect, it } from "vitest";
import {
  dragOffset,
  edgeBack,
  leadingOffset,
  leadingThreshold,
  lockAxis,
  PULL_TRIGGER,
  pullDistance,
  settle,
} from "./swipe";

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

describe("swipe right to pin (PRD §4.67)", () => {
  it("follows the finger up to the threshold, then resists", () => {
    const t = leadingThreshold(360);
    expect(t).toBe(79.2);
    expect(leadingOffset(40, 360)).toBe(40);
    expect(leadingOffset(t + 100, 360)).toBeCloseTo(t + 35);
    expect(leadingOffset(-20, 360)).toBe(0);
  });

  it("keeps the threshold within reach on any width", () => {
    expect(leadingThreshold(200)).toBe(64);
    expect(leadingThreshold(1000)).toBe(96);
  });
});

describe("pull to refresh", () => {
  it("is damped and capped", () => {
    expect(pullDistance(-10)).toBe(0);
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(1000)).toBe(96);
    expect(pullDistance(140) >= PULL_TRIGGER).toBe(true);
  });
});

describe("edge swipe back", () => {
  it("needs the left edge, enough travel and a level path", () => {
    expect(edgeBack(10, 130, 10, 390)).toBe("back");
    expect(edgeBack(60, 200, 0, 390)).toBe("stay");
    expect(edgeBack(10, 60, 0, 390)).toBe("stay");
    expect(edgeBack(10, 130, 160, 390)).toBe("stay");
  });
});
