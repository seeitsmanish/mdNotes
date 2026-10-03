import { describe, expect, it } from "vitest";
import { classify, decide, isMarkdownPath } from "./import";

/**
 * These rules decide whether a file becomes a note or disappears. A silent drop
 * is the failure that matters, so every skip has to be deliberate and named.
 */
describe("isMarkdownPath", () => {
  it("accepts the markdown extensions", () => {
    for (const path of ["a.md", "a.markdown", "a.mdown", "a.txt", "A.MD"]) {
      expect(isMarkdownPath(path)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const path of ["a.png", "a.pdf", "a.md.zip", "noextension"]) {
      expect(isMarkdownPath(path)).toBe(false);
    }
  });
});

describe("classify", () => {
  it("accepts an ordinary markdown file", () => {
    expect(classify("notes/Reading list.md", "# Reading list", 14)).toBeNull();
  });

  it("skips macOS and Windows metadata", () => {
    expect(classify("__MACOSX/a.md", "x", 1)).toBe("metadata");
    expect(classify("folder/__MACOSX/a.md", "x", 1)).toBe("metadata");
    expect(classify("folder/._a.md", "x", 1)).toBe("metadata");
    expect(classify(".DS_Store", "x", 1)).toBe("metadata");
    expect(classify("Thumbs.db", "x", 1)).toBe("metadata");
  });

  it("skips non-markdown", () => {
    expect(classify("image.png", "x", 1)).toBe("not-markdown");
  });

  it("skips empty and whitespace-only files rather than making blank notes", () => {
    expect(classify("a.md", "", 0)).toBe("empty");
    expect(classify("a.md", "   \n\t ", 6)).toBe("empty");
  });

  it("skips a file over the per-file cap", () => {
    expect(classify("a.md", "content", 5 * 1024 * 1024)).toBe("too-large");
  });

  it("checks metadata before extension, so ._notes.md is metadata not markdown", () => {
    expect(classify("._notes.md", "# real looking", 14)).toBe("metadata");
  });
});

describe("decide", () => {
  it("splits a mixed upload and explains every omission", () => {
    const result = decide([
      { path: "Groceries.md", body: "- milk", byteLength: 6 },
      { path: "__MACOSX/Groceries.md", body: "junk", byteLength: 4 },
      { path: "photo.png", body: "binary", byteLength: 6 },
      { path: "blank.md", body: "  ", byteLength: 2 },
    ]);

    expect(result.accepted.map((f) => f.path)).toEqual(["Groceries.md"]);
    expect(result.skipped).toEqual([
      { path: "__MACOSX/Groceries.md", reason: "metadata" },
      { path: "photo.png", reason: "not-markdown" },
      { path: "blank.md", reason: "empty" },
    ]);
  });

  it("accounts for every input file", () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: i % 2 ? `note${i}.md` : `file${i}.png`,
      body: "content",
      byteLength: 7,
    }));
    const { accepted, skipped } = decide(files);
    expect(accepted.length + skipped.length).toBe(files.length);
  });

  it("preserves the body byte-for-byte", () => {
    const body = "# Title\n\n\ttabbed\n\ntrailing spaces   \n";
    expect(decide([{ path: "a.md", body, byteLength: body.length }]).accepted[0]?.body).toBe(body);
  });
});
