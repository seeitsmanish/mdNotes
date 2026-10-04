import { describe, expect, it } from "vitest";
import { extractTitle, fetchableUrl, isBlockedAddress } from "./pageTitle";

describe("isBlockedAddress", () => {
  it("refuses private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["93.184.216.34", "1.1.1.1", "172.32.0.1", "2606:4700::1111"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("refuses anything that is not an address", () => {
    expect(isBlockedAddress("example.com")).toBe(true);
  });
});

describe("fetchableUrl", () => {
  it("accepts ordinary web links", () => {
    expect(fetchableUrl("https://example.com/a?b=1")?.hostname).toBe("example.com");
    expect(fetchableUrl("http://example.com:80/")).not.toBeNull();
  });

  it("refuses other schemes, odd ports, credentials and internal hosts", () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com", "https://example.com:8443/", "https://user:pw@example.com", "http://localhost/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest", "http://db.internal/", "not a url"]) {
      expect(fetchableUrl(url), url).toBeNull();
    }
  });
});

describe("extractTitle", () => {
  it("prefers og:title, decodes entities and tidies whitespace", () => {
    const html = `<head><title>Fallback</title><meta property="og:title" content="Bear &amp; Friends &#8211; FAQ"></head>`;
    expect(extractTitle(html)).toBe("Bear & Friends – FAQ");
  });

  it("falls back to <title>", () => {
    expect(extractTitle("<title>\n  Hello\n  world </title>")).toBe("Hello world");
  });

  it("returns null when there is no title", () => {
    expect(extractTitle("<p>nothing</p>")).toBeNull();
    expect(extractTitle("<title>   </title>")).toBeNull();
  });
});
