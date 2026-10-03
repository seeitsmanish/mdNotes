import { describe, expect, it } from "vitest";
import { safeExternalUrl, safeNextPath } from "./urls";

const ORIGIN = "https://ursa.example";

describe("safeNextPath", () => {
  it("keeps a same-origin path with its query and hash", () => {
    expect(safeNextPath("/notes?q=a#x", ORIGIN)).toBe("/notes?q=a#x");
  });

  it.each([
    ["//evil.example"],
    ["/\\evil.example"], // the bypass that reached production
    ["/\\/evil.example"],
    ["/\t/evil.example"],
    ["https://evil.example"],
    ["javascript:alert(1)"],
    ["evil.example"],
    [""],
  ])("refuses %j", (next) => {
    expect(safeNextPath(next, ORIGIN)).toBe("/");
  });

  it("falls back to / when there is no next", () => {
    expect(safeNextPath(null, ORIGIN)).toBe("/");
    expect(safeNextPath(undefined, ORIGIN)).toBe("/");
  });
});

describe("safeExternalUrl", () => {
  it.each([
    ["https://example.com/a?b=c", "https://example.com/a?b=c"],
    ["http://example.com", "http://example.com/"],
    ["mailto:me@example.com", "mailto:me@example.com"],
    ["www.example.com", "https://www.example.com/"],
    ["  https://example.com  ", "https://example.com/"],
  ])("opens %j", (href, expected) => {
    expect(safeExternalUrl(href)).toBe(expected);
  });

  it.each([
    ["javascript:alert(document.domain)"],
    ["JaVaScRiPt:alert(1)"],
    [" javascript:alert(1)"],
    ["java\tscript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["vbscript:msgbox(1)"],
    ["file:///etc/passwd"],
    ["/relative/path"],
    [""],
  ])("refuses %j", (href) => {
    expect(safeExternalUrl(href)).toBeNull();
  });
});
