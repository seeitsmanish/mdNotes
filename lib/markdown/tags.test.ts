import { describe, expect, it } from "vitest";
import { extractTags, normaliseTag, tagTree } from "./tags";

describe("extractTags", () => {
  it("finds simple, nested and multi-word tags", () => {
    expect(extractTags("Plan #work/meetings and #home\n\n#multi word tag# done").sort()).toEqual([
      "home",
      "multi word tag",
      "work/meetings",
    ]);
  });

  it("ignores headings, code and URLs", () => {
    const body = "# Heading\n\n`#notatag`\n\n```\n#nope\n```\n\nhttps://example.com/#anchor and #real";
    expect(extractTags(body)).toEqual(["real"]);
  });

  it("folds case and repeats", () => {
    expect(extractTags("#Work #work #WORK")).toEqual(["work"]);
  });
});

describe("normaliseTag", () => {
  it("strips hashes and stray slashes", () => {
    expect(normaliseTag("##Work//Ideas/")).toBe("work/ideas");
    expect(normaliseTag("#multi  word#")).toBe("multi word");
  });
});

describe("tagTree", () => {
  it("nests by slash and counts a note once per branch", () => {
    const tree = tagTree([["work", "work/meetings"], ["work/ideas"], ["home"]]);
    expect(tree.map((n) => [n.path, n.count])).toEqual([
      ["home", 1],
      ["work", 2],
    ]);
    expect(tree[1]!.children.map((n) => [n.name, n.count])).toEqual([
      ["ideas", 1],
      ["meetings", 1],
    ]);
  });
});
