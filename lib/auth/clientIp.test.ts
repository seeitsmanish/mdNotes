import { describe, expect, it } from "vitest";
import { clientIp } from "./clientIp";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to one shared bucket", () => {
    expect(clientIp(h({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("refuses anything that is not an address", () => {
    expect(clientIp(h({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(clientIp(h({ "x-forwarded-for": "x".repeat(500) }))).toBe("unknown");
  });
});
