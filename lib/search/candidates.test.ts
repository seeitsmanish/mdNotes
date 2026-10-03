import { describe, expect, it } from "vitest";
import { mergeCandidates } from "./candidates";
import { rank } from "./rank";

const note = (id: string, title: string, body: string, minutesAgo = 0) => ({
  id,
  title,
  body,
  pinned: false,
  updatedAt: new Date(Date.UTC(2026, 9, 3) - minutesAgo * 60_000),
});

describe("mergeCandidates", () => {
  it("keeps every title match even when body matches fill the cap", () => {
    const titled = [note("t", "Zebra", "# Zebra\n\nthe one you want", 99_999)];
    const mentions = Array.from({ length: 500 }, (_, i) =>
      note(`b${i}`, `Filler ${i}`, `Filler ${i}\n\nmentions zebra`, i),
    );
    const merged = mergeCandidates(titled, mentions);
    expect(merged).toHaveLength(501);
    expect(rank(merged, "zebra")[0]?.id).toBe("t");
  });

  it("lists a note found both ways once", () => {
    const both = note("x", "Zebra", "Zebra zebra");
    expect(mergeCandidates([both], [both, note("y", "Other", "zebra")]).map((n) => n.id)).toEqual([
      "x",
      "y",
    ]);
  });
});
