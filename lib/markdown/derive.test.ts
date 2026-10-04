import { describe, expect, it } from "vitest";
import { deriveExcerpt, deriveTitle, displayExcerpt, displayTitle } from "./derive";

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

describe("previews of tables and images (PRD R38.2)", () => {
  it("reads a table row as its cells", () => {
    expect(deriveExcerpt("# T\n\n| Company | Round |\n|---|:--:|\n| Google | Phone |")).toBe("Company · Round");
  });

  it("skips the divider row", () => {
    expect(deriveExcerpt("# T\n\n|---|---|\n| a | b |")).toBe("a · b");
  });

  it("names an image by its alt text, or as Image", () => {
    expect(deriveExcerpt("# T\n\n![whiteboard](/api/attachments/x)")).toBe("whiteboard");
    expect(deriveExcerpt("# T\n\n![](/api/attachments/x)")).toBe("Image");
  });

  it("tidies an old stored excerpt, even one cut short", () => {
    expect(displayExcerpt("| Company | Round | Question asked | Answer…")).toBe("Company · Round · Question asked · Answer…");
    expect(displayExcerpt("plain words")).toBe("plain words");
  });

  it("still hides a spoiler inside a table row", () => {
    expect(displayExcerpt("| Q | ||answer|| |")).toBe("Q · ▒▒▒");
  });

  it("leaves a lone pipe in prose alone", () => {
    expect(displayExcerpt("a | b")).toBe("a | b");
  });
});

describe("deriveCover (PRD §4.51)", () => {
  it("takes the first uploaded or https image", async () => {
    const { deriveCover } = await import("./derive");
    expect(deriveCover("# T\n\ntext\n![a](/api/attachments/abc123)\n![b](https://x.org/b.png)")).toBe("/api/attachments/abc123");
    expect(deriveCover("![b](https://x.org/b.png)")).toBe("https://x.org/b.png");
  });

  it("ignores images in code blocks, other schemes and plain links", async () => {
    const { deriveCover } = await import("./derive");
    expect(deriveCover("```\n![a](/api/attachments/abc)\n```")).toBeNull();
    expect(deriveCover("![a](http://x.org/a.png) ![b](javascript:x) [c](https://x.org)")).toBeNull();
    expect(deriveCover("no images")).toBeNull();
  });
});
