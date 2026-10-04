import { describe, expect, it } from "vitest";
import { isCrossSiteWrite } from "./origin";

const h = (entries: Record<string, string>) => new Headers(entries);

describe("isCrossSiteWrite", () => {
  it("never blocks reads", () => {
    expect(isCrossSiteWrite("GET", h({ origin: "https://evil.example", host: "www.mdnotes.in" }))).toBe(false);
  });

  it("allows a write from our own origin", () => {
    expect(isCrossSiteWrite("PATCH", h({ origin: "https://www.mdnotes.in", host: "www.mdnotes.in", "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it("refuses a write the browser marks cross-site or same-site", () => {
    expect(isCrossSiteWrite("POST", h({ "sec-fetch-site": "cross-site", host: "www.mdnotes.in" }))).toBe(true);
    // A sibling subdomain is same-site to the cookie, but not us.
    expect(isCrossSiteWrite("POST", h({ "sec-fetch-site": "same-site", host: "www.mdnotes.in" }))).toBe(true);
  });

  it("refuses a write whose Origin is another host, null, or garbage", () => {
    expect(isCrossSiteWrite("DELETE", h({ origin: "https://evil.example", host: "www.mdnotes.in" }))).toBe(true);
    expect(isCrossSiteWrite("POST", h({ origin: "null", host: "www.mdnotes.in" }))).toBe(true);
    expect(isCrossSiteWrite("POST", h({ origin: "::::", host: "www.mdnotes.in" }))).toBe(true);
    expect(isCrossSiteWrite("POST", h({ origin: "https://mdnotes.in", host: "www.mdnotes.in" }))).toBe(true);
  });

  it("prefers the forwarded host behind the platform proxy", () => {
    expect(isCrossSiteWrite("POST", h({ origin: "https://www.mdnotes.in", host: "internal:3000", "x-forwarded-host": "www.mdnotes.in" }))).toBe(false);
  });

  it("lets through clients that send neither header (curl, backups)", () => {
    expect(isCrossSiteWrite("POST", h({ host: "www.mdnotes.in" }))).toBe(false);
  });
});
