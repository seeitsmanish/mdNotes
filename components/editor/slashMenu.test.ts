import { describe, expect, it } from "vitest";
import { matchItems, SLASH_ITEMS, slashQuery, template } from "./slashMenu";

describe("slashQuery", () => {
  it("opens on / at the start of a line, indented or not", () => {
    expect(slashQuery("/")).toEqual({ offset: 0, query: "" });
    expect(slashQuery("  /Ta")).toEqual({ offset: 2, query: "ta" });
  });

  it("stays shut mid-line, in paths and URLs, and after a space in the query", () => {
    expect(slashQuery("a/b")).toBeNull();
    expect(slashQuery("see /usr")).toBeNull();
    expect(slashQuery("https://x/")).toBeNull();
    expect(slashQuery("/to do")).toBeNull();
  });
});

describe("matchItems", () => {
  it("lists everything for a bare slash", () => {
    expect(matchItems("")).toHaveLength(SLASH_ITEMS.length);
  });

  it("matches label words before keywords", () => {
    expect(matchItems("h").map((i) => i.id).slice(0, 3)).toEqual(["h1", "h2", "h3"]);
    expect(matchItems("check").map((i) => i.id)).toEqual(["todo"]);
    expect(matchItems("hr").map((i) => i.id)).toEqual(["divider"]);
    expect(matchItems("list")[0]!.id).toBe("bullet");
  });

  it("returns nothing for nonsense", () => {
    expect(matchItems("zzz")).toEqual([]);
  });
});

describe("template", () => {
  it("removes the caret marker and reports where it was", () => {
    expect(template("# ‸")).toEqual({ text: "# ", anchor: 2, head: 2 });
    expect(template("||‸||")).toEqual({ text: "||||", anchor: 2, head: 2 });
  });

  it("keeps a table's pipes and selects its first placeholder", () => {
    const table = SLASH_ITEMS.find((i) => i.id === "table")!.insert!;
    const { text, anchor, head } = template(table);
    expect(text.startsWith("| Column | Column |")).toBe(true);
    expect(text.slice(anchor, head)).toBe("Column");
  });

  it("every text item has a caret or a selection", () => {
    for (const item of SLASH_ITEMS.filter((i) => i.insert)) {
      expect([2, 3]).toContain(item.insert!.split("‸").length);
    }
  });
});
