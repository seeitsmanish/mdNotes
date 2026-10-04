import { describe, expect, it } from "vitest";
import { hashPasscode, unlockToken, UNLOCK_MINUTES, validUnlock, verifyPasscode } from "./passcode";

const SECRET = "x".repeat(40);

describe("passcode", () => {
  it("verifies the right passcode and refuses others", async () => {
    const stored = await hashPasscode("2468");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPasscode("2468", stored)).toBe(true);
    expect(await verifyPasscode("2469", stored)).toBe(false);
    expect(await verifyPasscode("2468", "garbage")).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPasscode("2468")).not.toBe(await hashPasscode("2468"));
  });
});

describe("unlock cookie", () => {
  it("is valid until it expires", async () => {
    const stored = await hashPasscode("2468");
    const now = 1_000_000;
    const token = unlockToken(stored, SECRET, now);
    expect(validUnlock(token, stored, SECRET, now + 1000)).toBe(true);
    expect(validUnlock(token, stored, SECRET, now + UNLOCK_MINUTES * 60_000 + 1)).toBe(false);
  });

  it("dies when the passcode changes, or the token is tampered with", async () => {
    const stored = await hashPasscode("2468");
    const token = unlockToken(stored, SECRET);
    expect(validUnlock(token, await hashPasscode("2468"), SECRET)).toBe(false);
    const [expiry, print, sig] = token.split(".");
    expect(validUnlock(`${Number(expiry) + 999999}.${print}.${sig}`, stored, SECRET)).toBe(false);
    expect(validUnlock(token, stored, "y".repeat(40))).toBe(false);
    expect(validUnlock(undefined, stored, SECRET)).toBe(false);
    expect(validUnlock(token, null, SECRET)).toBe(false);
  });
});
