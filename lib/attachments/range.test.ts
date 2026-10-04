import { describe, expect, it } from "vitest";
import { byteRange } from "./range";
import { sniffAudio } from "./sniff";

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

describe("sniffAudio", () => {
  it("recognises what browsers record", () => {
    expect(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBe("audio/webm");
    expect(sniffAudio(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe("audio/mp4");
    expect(sniffAudio(new Uint8Array([0x4f, 0x67, 0x67, 0x53]))).toBe("audio/ogg");
    expect(sniffAudio(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull(); // "<svg"
  });
});
