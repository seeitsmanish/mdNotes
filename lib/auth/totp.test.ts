import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, codeAt, hashRecovery, newRecoveryCodes, newSecret, verifyCode } from "./totp";

// RFC 6238's SHA-1 test key, "12345678901234567890".
const RFC = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(codeAt(RFC, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(codeAt(RFC, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(codeAt(RFC, Math.floor(1234567890 / 30), 8)).toBe("89005924");
  });

  it("round-trips base32", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
    expect(newSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the current and neighbouring codes, refuses replays", () => {
    const secret = newSecret();
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    expect(verifyCode(secret, codeAt(secret, step), 0, now)).toBe(step);
    expect(verifyCode(secret, codeAt(secret, step - 1), 0, now)).toBe(step - 1);
    expect(verifyCode(secret, codeAt(secret, step - 3), 0, now)).toBeNull();
    expect(verifyCode(secret, codeAt(secret, step), step, now)).toBeNull();
    expect(verifyCode(secret, "12345", 0, now)).toBeNull();
  });

  it("makes ten distinct recovery codes and hashes them loosely", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
    expect(hashRecovery(` ${codes[0]!.toUpperCase()} `)).toBe(hashRecovery(codes[0]!));
  });
});
