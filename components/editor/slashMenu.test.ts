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
    expect(slashQuery("/ x")).toBeNull();
  });
});

describe("matchItems", () => {
  it("lists everything for a bare slash", () => {
    expect(matchItems("")).toHaveLength(SLASH_ITEMS.length);
  });

  it("matches label words before keywords", () => {
    expect(matchItems("h").map((i) => i.id).slice(0, 3)).toEqual(["h1", "h2", "h3"]);
    expect(matchItems("check").map((i) => i.id)).toEqual(["tpl-checklist", "todo"]);
    expect(matchItems("hr").map((i) => i.id)).toEqual(["divider"]);
    expect(matchItems("list")[0]!.id).toBe("bullet");
  });

  it("takes several words, each narrowing", () => {
    expect(slashQuery("/link to")).toEqual({ offset: 0, query: "link to" });
    expect(matchItems("link to").map((i) => i.id)).toEqual(["wikilink"]);
    expect(matchItems("link").map((i) => i.id)).toEqual(["link", "wikilink"]);
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
    const table = SLASH_ITEMS.find((i) => i.id === "table")!.insert as string;
    const { text, anchor, head } = template(table);
    expect(text.startsWith("| Column | Column |")).toBe(true);
    expect(text.slice(anchor, head)).toBe("Column");
  });

  it("every text item has a caret or a selection", () => {
    for (const item of SLASH_ITEMS.filter((i) => i.insert)) {
      const text = typeof item.insert === "function" ? item.insert(new Date(2026, 9, 4)) : item.insert!;
      expect([2, 3]).toContain(text.split("‸").length);
    }
  });

  it("templates: the daily note is dated and the interview one selects the company", () => {
    const daily = SLASH_ITEMS.find((i) => i.id === "tpl-daily")!.insert as (d: Date) => string;
    expect(daily(new Date(2026, 9, 4))).toMatch(/^# .*2026/);
    const interview = template(SLASH_ITEMS.find((i) => i.id === "tpl-interview")!.insert as string);
    expect(interview.text.slice(interview.anchor, interview.head)).toBe("Company");
    expect(matchItems("template").map((i) => i.id)).toEqual(["tpl-daily", "tpl-meeting", "tpl-interview", "tpl-checklist"]);
  });
});
