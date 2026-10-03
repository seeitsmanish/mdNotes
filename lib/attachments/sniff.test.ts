import { describe, expect, it } from "vitest";
import { ATTACHMENT_ID, sniffImage } from "./sniff";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("sniffImage", () => {
  it.each([
    [bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png"],
    [bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    [bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), "image/gif"],
    [bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50), "image/webp"],
  ])("recognises %s", (input, mime) => {
    expect(sniffImage(input)).toBe(mime);
  });

  it.each([
    ["an SVG, which can carry script", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["HTML", new TextEncoder().encode("<!doctype html><script>alert(1)</script>")],
    ["a RIFF that is not WebP (WAV)", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)],
    ["an empty file", bytes()],
    ["a PDF", new TextEncoder().encode("%PDF-1.7")],
  ])("refuses %s", (_label, input) => {
    expect(sniffImage(input)).toBeNull();
  });
});

describe("ATTACHMENT_ID", () => {
  it("accepts a cuid and refuses path tricks", () => {
    expect(ATTACHMENT_ID.test("cmusr53c70000ab7dqym3sfww")).toBe(true);
    expect(ATTACHMENT_ID.test("../../etc/passwd")).toBe(false);
    expect(ATTACHMENT_ID.test("abc")).toBe(false);
  });
});
