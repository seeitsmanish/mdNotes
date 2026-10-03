import { describe, expect, it } from "vitest";
import { deriveTitle } from "@/lib/markdown/derive";
import { normaliseTitle } from "@/lib/markdown/wikilink";
import { conflictCopyBody } from "./conflict";

describe("conflictCopyBody", () => {
  it("keeps the stale text whole, below a heading", () => {
    const stale = "# Groceries\n\n- oat milk\n- bread";
    const copy = conflictCopyBody(stale);
    expect(copy.endsWith(stale)).toBe(true);
    expect(deriveTitle(copy)).toBe("Conflicted copy: Groceries");
  });

  it("names an empty or untitled note", () => {
    expect(deriveTitle(conflictCopyBody(""))).toBe("Conflicted copy: Untitled");
  });

  it("never derives the same title as the original, even at the length cap", () => {
    const long = `# ${"word ".repeat(60)}`;
    const original = deriveTitle(long);
    const copy = deriveTitle(conflictCopyBody(long));
    expect(original.endsWith("…")).toBe(true);
    expect(normaliseTitle(copy)).not.toBe(normaliseTitle(original));
  });

  it("does not let a wiki-link to the original resolve to the copy", () => {
    const copy = deriveTitle(conflictCopyBody("Reading list\n\nbooks"));
    expect(normaliseTitle(copy)).not.toBe(normaliseTitle("Reading list"));
  });
});
