import { describe, expect, it } from "vitest";
import { RESYNC_AFTER_MS, shouldAdopt, shouldResync } from "./resync";

describe("shouldAdopt", () => {
  it("takes a newer server version when nothing is unsaved", () => {
    expect(shouldAdopt({ hasUnsaved: false, localVersion: 3, serverVersion: 4 })).toBe(true);
  });

  it("never replaces unsaved text", () => {
    expect(shouldAdopt({ hasUnsaved: true, localVersion: 3, serverVersion: 9 })).toBe(false);
  });

  it("leaves an up-to-date note alone, so the caret does not jump", () => {
    expect(shouldAdopt({ hasUnsaved: false, localVersion: 4, serverVersion: 4 })).toBe(false);
  });

  it("adopts when this client never knew a version", () => {
    expect(shouldAdopt({ hasUnsaved: false, localVersion: undefined, serverVersion: 0 })).toBe(true);
  });
});

describe("shouldResync", () => {
  it("waits for a real absence", () => {
    expect(shouldResync(1000, 1000 + RESYNC_AFTER_MS - 1)).toBe(false);
    expect(shouldResync(1000, 1000 + RESYNC_AFTER_MS)).toBe(true);
    expect(shouldResync(null, 99_999_999)).toBe(false);
  });
});
