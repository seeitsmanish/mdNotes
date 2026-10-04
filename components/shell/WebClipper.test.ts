import { describe, expect, it } from "vitest";
import { clipperCode } from "./WebClipper";

describe("clipperCode", () => {
  it("is a bookmarklet that opens this app's share page with the page's details", () => {
    const code = clipperCode("https://www.mdnotes.in");
    expect(code.startsWith("javascript:")).toBe(true);
    expect(code).toContain("https://www.mdnotes.in/share?clip=1&title=");
    expect(code).toContain("encodeURIComponent(location.href)");
    // Parses as a script once the scheme is removed.
    expect(() => new Function(code.slice("javascript:".length))).not.toThrow();
  });
});
