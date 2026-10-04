import { describe, expect, it } from "vitest";
import { byteRange } from "./range";

describe("byteRange", () => {
  it("reads open, closed and suffix ranges", () => {
    expect(byteRange("bytes=0-", 1000)).toEqual([0, 999]);
    expect(byteRange("bytes=100-199", 1000)).toEqual([100, 199]);
    expect(byteRange("bytes=900-5000", 1000)).toEqual([900, 999]);
    expect(byteRange("bytes=-100", 1000)).toEqual([900, 999]);
  });
  it("sends the whole file for anything else", () => {
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange("bytes=0-1,5-6", 1000)).toBeNull();
    expect(byteRange("bytes=2000-", 1000)).toBeNull();
    expect(byteRange("items=0-1", 1000)).toBeNull();
  });
});
