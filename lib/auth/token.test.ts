import { describe, expect, it, vi } from "vitest";
import { readToken, safeEqual, sessionKey, signToken, verifyToken } from "./token";

const KEY = sessionKey("s".repeat(40), "correct horse");

describe("session tokens", () => {
  it("round-trips the epoch it was issued under", async () => {
    const token = await signToken(KEY, 3);
    expect(await readToken(token, KEY)).toMatchObject({ epoch: 3 });
  });

  it("is refused once the password changes (R30.3)", async () => {
    const token = await signToken(KEY, 0);
    expect(await verifyToken(token, sessionKey("s".repeat(40), "new password"))).toBe(false);
  });

  it("is refused when the secret changes", async () => {
    const token = await signToken(KEY, 0);
    expect(await verifyToken(token, sessionKey("t".repeat(40), "correct horse"))).toBe(false);
  });

  it("cannot have its epoch or expiry edited", async () => {
    const token = await signToken(KEY, 1);
    const [expiresAt, , signature] = token.split(".");
    expect(await readToken(`${expiresAt}.9.${signature}`, KEY)).toBeNull();
    expect(await readToken(`9999999999.1.${signature}`, KEY)).toBeNull();
  });

  it("expires", async () => {
    vi.useFakeTimers();
    try {
      const token = await signToken(KEY, 0, 60);
      vi.setSystemTime(Date.now() + 61_000);
      expect(await readToken(token, KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([[undefined], [""], ["garbage"], ["123.abc"], ["1.2.3.4"], ["9999999999.sig"]])(
    "refuses %j",
    async (token) => {
      expect(await readToken(token, KEY)).toBeNull();
    },
  );
});

describe("safeEqual", () => {
  it("compares without short-circuiting", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
