import { describe, expect, it } from "vitest";
import { createNamer, safeStem } from "./filename";

describe("safeStem", () => {
  it("keeps an ordinary title", () => {
    expect(safeStem("Reading list")).toBe("Reading list");
  });

  it("strips characters that are illegal on Windows", () => {
    expect(safeStem('Q3: plans <draft> "v2" / final')).toBe("Q3 plans draft v2 final");
  });

  it("never lets a title escape the directory", () => {
    expect(safeStem("../../etc/passwd")).toBe("etc passwd");
    expect(safeStem("..")).toBe("Untitled");
  });

  it("strips control characters", () => {
    expect(safeStem("a\u0000b\u001fc")).toBe("a b c");
  });

  it("falls back for an empty or punctuation-only title", () => {
    expect(safeStem("")).toBe("Untitled");
    expect(safeStem("   ")).toBe("Untitled");
    expect(safeStem("///")).toBe("Untitled");
  });

  it("avoids Windows reserved device names", () => {
    for (const name of ["CON", "nul", "COM1", "lpt9"]) {
      expect(safeStem(name)).toBe("Untitled");
    }
  });

  it("drops trailing dots and spaces, which Windows silently removes", () => {
    expect(safeStem("Notes...")).toBe("Notes");
    expect(safeStem("Notes   ")).toBe("Notes");
  });

  it("truncates a very long title", () => {
    expect(safeStem("x".repeat(500)).length).toBeLessThanOrEqual(80);
  });
});

describe("createNamer", () => {
  it("appends .md", () => {
    expect(createNamer()("Groceries")).toBe("Groceries.md");
  });

  it("de-duplicates collisions instead of overwriting", () => {
    const name = createNamer();
    expect(name("Groceries")).toBe("Groceries.md");
    expect(name("Groceries")).toBe("Groceries 2.md");
    expect(name("Groceries")).toBe("Groceries 3.md");
  });

  it("treats case-different titles as colliding, as macOS and Windows do", () => {
    const name = createNamer();
    expect(name("Groceries")).toBe("Groceries.md");
    expect(name("GROCERIES")).toBe("GROCERIES 2.md");
  });

  it("de-duplicates titles that only differ by illegal characters", () => {
    const name = createNamer();
    expect(name("a/b")).toBe("a b.md");
    expect(name("a:b")).toBe("a b 2.md");
  });

  it("de-duplicates untitled notes", () => {
    const name = createNamer();
    expect(name("")).toBe("Untitled.md");
    expect(name("")).toBe("Untitled 2.md");
  });
});
