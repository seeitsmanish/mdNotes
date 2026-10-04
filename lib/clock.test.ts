import { describe, expect, it } from "vitest";
import { dayNumber, encodeClockCookie, parseClockCookie } from "./clock";

describe("clock cookie", () => {
  it("round-trips a real timezone and locale", () => {
    expect(parseClockCookie(encodeClockCookie("Asia/Kolkata", "en-IN"))).toEqual({ timeZone: "Asia/Kolkata", locale: "en-IN" });
  });

  it("drops values Intl rejects", () => {
    expect(parseClockCookie(encodeClockCookie("Mars/Olympus", "not a locale!!"))).toEqual({ timeZone: undefined, locale: undefined });
    expect(parseClockCookie("%E0%A4%A")).toEqual({});
    expect(parseClockCookie(undefined)).toEqual({});
  });
});

describe("dayNumber", () => {
  it("counts calendar days in the given zone", () => {
    const t = Date.UTC(2026, 9, 3, 20, 0);
    expect(dayNumber(t, "Asia/Kolkata") - dayNumber(t, "UTC")).toBe(1);
    expect(dayNumber(t, "America/Los_Angeles") - dayNumber(t, "UTC")).toBe(0);
  });
});
