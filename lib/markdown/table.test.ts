import { describe, expect, it } from "vitest";
import { isDelimiterRow, parseTable, splitRow } from "./table";

describe("splitRow", () => {
  it("splits a fully piped row", () => {
    expect(splitRow("| a | b | c |")).toEqual(["a", "b", "c"]);
  });

  it("splits a row without outer pipes", () => {
    expect(splitRow("a | b | c")).toEqual(["a", "b", "c"]);
  });

  it("keeps empty interior cells", () => {
    expect(splitRow("| a |  | c |")).toEqual(["a", "", "c"]);
  });

  it("honours escaped pipes rather than splitting on them", () => {
    expect(splitRow("| a \\| b | c |")).toEqual(["a | b", "c"]);
  });

  it("keeps other backslash escapes intact", () => {
    expect(splitRow("| a \\n b | c |")).toEqual(["a \\n b", "c"]);
  });

  it("trims surrounding whitespace per cell", () => {
    expect(splitRow("|   a   |   b |")).toEqual(["a", "b"]);
  });
});

describe("isDelimiterRow", () => {
  it("recognises the delimiter row in all its forms", () => {
    for (const row of ["| --- | --- |", "|:---|---:|", "| :---: | - |", "---|---"]) {
      expect(isDelimiterRow(row)).toBe(true);
    }
  });

  it("rejects a content row", () => {
    expect(isDelimiterRow("| a | b |")).toBe(false);
    expect(isDelimiterRow("| --- | b |")).toBe(false);
  });
});

describe("parseTable", () => {
  const source = ["| Step | Owner | Done |", "| --- | :---: | ---: |", "| Drain | Priya | yes |", "| DNS | Sam | no |"].join("\n");

  it("reads headers, alignment and rows", () => {
    const table = parseTable(source)!;
    expect(table.headers).toEqual(["Step", "Owner", "Done"]);
    expect(table.align).toEqual([null, "center", "right"]);
    expect(table.rows).toEqual([
      ["Drain", "Priya", "yes"],
      ["DNS", "Sam", "no"],
    ]);
  });

  it("reads a header-only table", () => {
    expect(parseTable("| a | b |\n| --- | --- |")!.rows).toEqual([]);
  });

  it("pads a short row so columns do not shift", () => {
    const table = parseTable("| a | b | c |\n| - | - | - |\n| 1 |")!;
    expect(table.rows).toEqual([["1", "", ""]]);
  });

  it("truncates an over-long row", () => {
    const table = parseTable("| a | b |\n| - | - |\n| 1 | 2 | 3 |")!;
    expect(table.rows).toEqual([["1", "2"]]);
  });

  it("ignores blank lines inside the block", () => {
    expect(parseTable("| a |\n| - |\n\n| 1 |")!.rows).toEqual([["1"]]);
  });

  it("returns null when there is no delimiter row, so the raw text is kept", () => {
    expect(parseTable("| a | b |\n| 1 | 2 |")).toBeNull();
  });

  it("returns null for a single line", () => {
    expect(parseTable("| a | b |")).toBeNull();
  });

  it("keeps an escaped pipe inside a cell", () => {
    const table = parseTable("| expr |\n| --- |\n| a \\| b |")!;
    expect(table.rows).toEqual([["a | b"]]);
  });
});
