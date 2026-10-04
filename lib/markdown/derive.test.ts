import { describe, expect, it } from "vitest";
import { deriveExcerpt, deriveTitle, displayTitle } from "./derive";

describe("deriveTitle", () => {
  it("uses the first heading when the note opens with one", () => {
    expect(deriveTitle("# Meeting notes\n\nbody")).toBe("Meeting notes");
  });

  it("falls back to the first non-empty line", () => {
    expect(deriveTitle("\n\nGroceries\n- oat milk")).toBe("Groceries");
  });

  it("strips markup so the row shows prose", () => {
    expect(deriveTitle("## **Bold** and `code`")).toBe("Bold and code");
  });

  it("strips list and todo markers", () => {
    expect(deriveTitle("- [ ] buy milk")).toBe("buy milk");
    expect(deriveTitle("1. first item")).toBe("first item");
  });

  it("skips a fence line rather than showing its backticks", () => {
    expect(deriveTitle("```typescript\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("is empty for an empty note", () => {
    expect(deriveTitle("")).toBe("");
    expect(deriveTitle("\n   \n")).toBe("");
  });

  it("truncates a very long first line", () => {
    const title = deriveTitle("x".repeat(200));
    expect(title.length).toBe(120);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("deriveExcerpt", () => {
  it("is the first prose after the title line", () => {
    expect(deriveExcerpt("# Title\n\nFirst body line\nSecond")).toBe("First body line");
  });

  it("is empty when the note is only a title", () => {
    expect(deriveExcerpt("# Title")).toBe("");
  });

  it("skips blank lines between title and body", () => {
    expect(deriveExcerpt("Title\n\n\n\nBody")).toBe("Body");
  });
});

describe("displayTitle", () => {
  it("names an untitled note", () => {
    expect(displayTitle("")).toBe("Untitled");
    expect(displayTitle("   ")).toBe("Untitled");
  });

  it("passes a real title through", () => {
    expect(displayTitle("Groceries")).toBe("Groceries");
  });
});

describe("spoilers in derived text", () => {
  it("never shows a spoiler's answer in the title or excerpt", () => {
    const body = "Capital of France? ||Paris||\n\nThe answer is ||Paris|| too.";
    expect(deriveTitle(body)).toBe("Capital of France? ▒▒▒");
    expect(deriveExcerpt(body)).not.toContain("Paris");
  });
});
