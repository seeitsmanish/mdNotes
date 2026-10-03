import { describe, expect, it } from "vitest";
import { GFM, parser } from "@lezer/markdown";
import { BearMarkup } from "./bearMarkup";

/**
 * The editor's parser, configured exactly as the editor configures it. These
 * run against the real Lezer tree rather than a stand-in, so a regression here
 * is a regression on screen.
 */
const markdown = parser.configure([GFM, ...BearMarkup]);

function nodeNames(doc: string): string[] {
  const names: string[] = [];
  markdown.parse(doc).iterate({ enter: (node) => void names.push(node.name) });
  return names;
}

function textOf(doc: string, type: string): string[] {
  const found: string[] = [];
  markdown.parse(doc).iterate({
    enter: (node) => {
      if (node.name === type) found.push(doc.slice(node.from, node.to));
    },
  });
  return found;
}

describe("the # rule", () => {
  const cases: Array<[input: string, tags: string[], note: string]> = [
    ["#tag", ["#tag"], "hash + non-space is a tag"],
    ["#work/nested", ["#work/nested"], "slash nests, it does not terminate"],
    ["#multi word tag#", ["#multi word tag#"], "closing hash permits spaces"],
    ["#multi word", ["#multi"], "no closer, so the tag stops at whitespace"],
    ["##tag", ["##tag"], "a leading run of hashes collapses"],
    ["C#", [], "hash not at a token start"],
    ["issue #42", [], "hash followed by a digit is a reference"],
    ["#one and #two#", ["#one", "#two#"], "a tag opener ends the multi-word scan"],
    ["#a, #b.", ["#a", "#b"], "trailing sentence punctuation is shed"],
    ["Ship #work today", ["#work"], "tags parse mid-line"],
  ];

  for (const [input, tags, note] of cases) {
    it(`${JSON.stringify(input)} → [${tags.join(", ")}] — ${note}`, () => {
      expect(textOf(input, "BearTag")).toEqual(tags);
    });
  }

  it("reads a leading hash + space as a heading, not a tag", () => {
    const names = nodeNames("# Heading");
    expect(names).toContain("ATXHeading1");
    expect(names).not.toContain("BearTag");
  });

  it("keeps ## Heading a heading at level 2", () => {
    expect(nodeNames("## Heading")).toContain("ATXHeading2");
  });

  it("leaves a tag inside inline code alone", () => {
    const names = nodeNames("`#tag`");
    expect(names).toContain("InlineCode");
    expect(names).not.toContain("BearTag");
  });

  it("leaves a tag inside a fenced block alone", () => {
    const doc = ["```sh", "# not a heading, #not-a-tag", "```"].join("\n");
    const names = nodeNames(doc);
    expect(names).toContain("FencedCode");
    expect(names).not.toContain("BearTag");
  });
});

describe("Bear emphasis", () => {
  it("reads ::highlight::", () => {
    expect(nodeNames("::marked::")).toContain("Highlight");
    expect(textOf("::marked::", "Highlight")).toEqual(["::marked::"]);
  });

  it("reads /slash italic/", () => {
    expect(nodeNames("a /slanted/ b")).toContain("SlashEmphasis");
  });

  it("closes slash italic before sentence punctuation", () => {
    expect(textOf("Type /also italic/, then stop", "SlashEmphasis")).toEqual(["/also italic/"]);
  });

  it("does not read a file path as slash italic", () => {
    expect(nodeNames("lib/db/notes.ts and lib/markdown/derive.ts")).not.toContain("SlashEmphasis");
  });

  it("does not read a URL as slash italic", () => {
    expect(nodeNames("see https://example.com/a/b for more")).not.toContain("SlashEmphasis");
  });

  it("still reads standard emphasis and strikethrough", () => {
    const names = nodeNames("**bold** *italic* ~~struck~~");
    expect(names).toContain("StrongEmphasis");
    expect(names).toContain("Emphasis");
    expect(names).toContain("Strikethrough");
  });
});

describe("GFM constructs the editor relies on", () => {
  it("reads task markers", () => {
    expect(textOf("- [x] done\n- [ ] not", "TaskMarker")).toEqual(["[x]", "[ ]"]);
  });

  it("reads a fence's language as CodeInfo", () => {
    expect(textOf("```json\n{}\n```", "CodeInfo")).toEqual(["json"]);
  });

  it("reads tables", () => {
    const doc = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    expect(nodeNames(doc)).toContain("Table");
  });

  it("reads links and autolinks", () => {
    expect(nodeNames("[label](https://example.com)")).toContain("Link");
    expect(nodeNames("https://example.com")).toContain("URL");
  });
});

describe("performance", () => {
  it("parses a 50k-character note well inside a frame budget", () => {
    const doc = "# Section\n\nSome #work text with **bold** and `code`.\n".repeat(1000);
    expect(doc.length).toBeGreaterThan(50_000);
    const started = performance.now();
    markdown.parse(doc);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
