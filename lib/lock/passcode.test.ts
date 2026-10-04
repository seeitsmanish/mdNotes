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
    const token = unlockToken(stored, SECRET, "all", now);
    expect(validUnlock(token, stored, SECRET, undefined, now + 1000)).toBe(true);
    expect(validUnlock(token, stored, SECRET, undefined, now + UNLOCK_MINUTES * 60_000 + 1)).toBe(false);
  });

  it("dies when the passcode changes, or the token is tampered with", async () => {
    const stored = await hashPasscode("2468");
    const token = unlockToken(stored, SECRET, "all");
    expect(validUnlock(token, await hashPasscode("2468"), SECRET)).toBe(false);
    const [expiry, scope, print, sig] = token.split(".");
    expect(validUnlock(`${Number(expiry) + 999999}.${scope}.${print}.${sig}`, stored, SECRET)).toBe(false);
    expect(validUnlock(token, stored, "y".repeat(40))).toBe(false);
    expect(validUnlock(undefined, stored, SECRET)).toBe(false);
    expect(validUnlock(token, null, SECRET)).toBe(false);
  });
});

describe("unlock scope (PRD R69.7)", () => {
  it("opens only the note it was made for", async () => {
    const stored = await hashPasscode("2468");
    const token = unlockToken(stored, SECRET, "cmnoteaaaa1111");
    expect(validUnlock(token, stored, SECRET, "cmnoteaaaa1111")).toBe(true);
    expect(validUnlock(token, stored, SECRET, "cmnotebbbb2222")).toBe(false);
    // Not enough for "everything" (export).
    expect(validUnlock(token, stored, SECRET)).toBe(false);
  });

  it("cannot be widened by editing the scope", async () => {
    const stored = await hashPasscode("2468");
    const [expiry, , print, sig] = unlockToken(stored, SECRET, "cmnoteaaaa1111").split(".");
    expect(validUnlock(`${expiry}.all.${print}.${sig}`, stored, SECRET)).toBe(false);
  });
});

