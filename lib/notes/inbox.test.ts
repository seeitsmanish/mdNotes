import { describe, expect, it } from "vitest";
import { appendEntry, INBOX_START, inboxEntry } from "./inbox";

describe("inboxEntry", () => {
  it("is a bullet with the time", () => {
    expect(inboxEntry("Buy milk", "4 Oct, 13:05")).toBe("- Buy milk _(4 Oct, 13:05)_");
  });
  it("indents further lines under the bullet", () => {
    expect(inboxEntry("Idea\nmore detail\n\nend", "")).toBe("- Idea\n  more detail\n\n  end");
  });
  it("keeps markdown out of the stamp", () => {
    expect(inboxEntry("x", "*13:05*_[a]")).toBe("- x _(13:05a)_");
  });
});

describe("appendEntry", () => {
  it("starts an Inbox when there is none", () => {
    expect(appendEntry("", "- one")).toBe(`${INBOX_START.trimEnd()}\n\n- one\n`);
  });
  it("adds to the list without a blank line between entries", () => {
    const once = appendEntry("", "- one _(1)_");
    expect(appendEntry(once, "- two _(2)_")).toBe(`${INBOX_START.trimEnd()}\n\n- one _(1)_\n- two _(2)_\n`);
  });
});
