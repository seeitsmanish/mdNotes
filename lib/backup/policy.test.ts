import { describe, expect, it } from "vitest";
import { BACKUP_EVERY_MS, backupDue, trashCutoff } from "./policy";

describe("backupDue", () => {
  const now = 1_800_000_000_000;
  it("is due with no backup, or a week after the last", () => {
    expect(backupDue(null, now)).toBe(true);
    expect(backupDue(new Date(now - BACKUP_EVERY_MS), now)).toBe(true);
    expect(backupDue(new Date(now - BACKUP_EVERY_MS + 60_000), now)).toBe(false);
  });
});

describe("trashCutoff", () => {
  it("is off at 0 and N days back otherwise", () => {
    expect(trashCutoff(0)).toBeNull();
    expect(trashCutoff(-3)).toBeNull();
    expect(trashCutoff(30, 1_000_000_000_000)?.getTime()).toBe(1_000_000_000_000 - 30 * 86_400_000);
  });
});
