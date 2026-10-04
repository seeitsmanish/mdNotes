import { describe, expect, it } from "vitest";
import { relativeTime } from "./time";

describe("relativeTime with a timezone and locale", () => {
  it("dates an old note by the owner's calendar, not the server's", () => {
    const now = Date.UTC(2026, 9, 4, 12);
    const then = new Date(Date.UTC(2026, 8, 3, 21)).toISOString(); // 4 Sep in India, 3 Sep in UTC
    expect(relativeTime(then, now, { timeZone: "Asia/Kolkata", locale: "en-IN" })).toMatch(/^4 Sep/);
    expect(relativeTime(then, now, { timeZone: "UTC", locale: "en-US" })).toBe("Sep 3");
  });

  it("keeps the short relative forms", () => {
    const now = Date.UTC(2026, 9, 4, 12);
    expect(relativeTime(new Date(now - 30_000).toISOString(), now)).toBe("just now");
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
  });
});
