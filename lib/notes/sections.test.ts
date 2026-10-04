import { describe, expect, it } from "vitest";
import { sectionLabel, sectionNotes } from "./sections";

const now = new Date(2026, 9, 4, 9, 30).getTime(); // 4 Oct 2026, 09:30 local
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe("sectionLabel", () => {
  it("goes by calendar day, not elapsed hours", () => {
    expect(sectionLabel(at(2026, 9, 4, 0), now)).toBe("Today");
    expect(sectionLabel(at(2026, 9, 3, 23), now)).toBe("Yesterday");
    expect(sectionLabel(at(2026, 9, 3, 0), now)).toBe("Yesterday");
  });

  it("buckets the last week and month", () => {
    expect(sectionLabel(at(2026, 9, 1), now)).toBe("Previous 7 days");
    expect(sectionLabel(at(2026, 8, 20), now)).toBe("Previous 30 days");
  });

  it("names older months this year, and years before that", () => {
    expect(sectionLabel(at(2026, 1, 10), now)).toBe(new Date(2026, 1, 10).toLocaleDateString(undefined, { month: "long" }));
    expect(sectionLabel(at(2024, 5, 1), now)).toBe("2024");
  });

  it("treats a future timestamp (clock skew) as today", () => {
    expect(sectionLabel(at(2026, 9, 5), now)).toBe("Today");
  });
});

describe("sectionNotes", () => {
  it("keeps the list order and puts pinned notes in their own section", () => {
    const notes = [
      { id: "p", pinned: true, updatedAt: at(2025, 0, 1) },
      { id: "a", pinned: false, updatedAt: at(2026, 9, 4) },
      { id: "b", pinned: false, updatedAt: at(2026, 9, 4, 8) },
      { id: "c", pinned: false, updatedAt: at(2026, 9, 3) },
    ];
    const sections = sectionNotes(notes, now);
    expect(sections.map((s) => [s.label, s.items.map((n) => n.id)])).toEqual([
      ["Pinned", ["p"]],
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
    ]);
  });

  it("returns nothing for no notes", () => {
    expect(sectionNotes([], now)).toEqual([]);
  });
});

describe("sections in the owner's timezone", () => {
  // 3 Oct 2026, 20:00 UTC = 4 Oct 01:30 in India.
  const utcEvening = Date.UTC(2026, 9, 3, 20, 0);
  const edited = new Date(Date.UTC(2026, 9, 3, 19, 0)).toISOString(); // 4 Oct 00:30 IST

  it("labels by the owner's calendar day, not the server's", () => {
    expect(sectionLabel(edited, utcEvening, { timeZone: "Asia/Kolkata" })).toBe("Today");
    expect(sectionLabel(new Date(Date.UTC(2026, 9, 3, 12)).toISOString(), utcEvening, { timeZone: "Asia/Kolkata" })).toBe("Yesterday");
    expect(sectionLabel(edited, utcEvening, { timeZone: "UTC" })).toBe("Today");
  });

  it("names months in the given locale", () => {
    expect(sectionLabel(new Date(Date.UTC(2026, 1, 10)).toISOString(), utcEvening, { timeZone: "UTC", locale: "en-GB" })).toBe("February");
  });
});
