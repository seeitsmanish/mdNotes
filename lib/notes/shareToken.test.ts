import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SHARE_TOKEN } from "./shareToken";

describe("SHARE_TOKEN", () => {
  it("matches the tokens the server makes", () => {
    for (let i = 0; i < 50; i += 1) expect(SHARE_TOKEN.test(randomBytes(16).toString("base64url"))).toBe(true);
  });
  it("refuses anything else before touching the database", () => {
    for (const bad of ["", "short", "a".repeat(23), "../../etc/passwd", "abc def ghi jkl mno pq"]) expect(SHARE_TOKEN.test(bad)).toBe(false);
  });
});
