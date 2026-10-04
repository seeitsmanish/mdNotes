import { describe, expect, it } from "vitest";
import { cellAt, editTable, offsetOfCell, serialiseTable } from "./tableEdit";
import { parseTable } from "./table";

const src = "| Item | Price |\n| --- | ---: |\n| Rent | 900 |\n| Food | 300 |\n| Bus | 45 |";

describe("serialiseTable", () => {
  it("pads columns and keeps alignment", () => {
    expect(serialiseTable(parseTable(src)!)).toBe(
      "| Item | Price |\n| ---- | ----: |\n| Rent | 900   |\n| Food | 300   |\n| Bus  | 45    |",
    );
  });
  it("re-escapes pipes in cells", () => {
    expect(serialiseTable(parseTable("| a |\n| --- |\n| x \\| y |")!)).toContain("x \\| y");
  });
});

describe("cellAt", () => {
  it("finds the row and column under the caret", () => {
    const offset = src.indexOf("300") + 1;
    expect(cellAt(src, offset)).toEqual({ row: 1, col: 1 });
    expect(cellAt(src, 3)).toEqual({ row: -1, col: 0 });
  });
});

describe("editTable", () => {
  const rows = (s: string) => parseTable(s)!.rows.map((r) => r.join(","));
  it("adds a row below and a column to the right", () => {
    expect(rows(editTable(src, { row: 0, col: 0 }, { kind: "addRow" })!.source)).toEqual(["Rent,900", ",", "Food,300", "Bus,45"]);
    const withCol = editTable(src, { row: 0, col: 0 }, { kind: "addColumn" })!;
    expect(parseTable(withCol.source)!.headers).toEqual(["Item", "Column", "Price"]);
  });
  it("deletes a row or column, never the last column", () => {
    expect(rows(editTable(src, { row: 1, col: 0 }, { kind: "deleteRow" })!.source)).toEqual(["Rent,900", "Bus,45"]);
    expect(parseTable(editTable(src, { row: 0, col: 1 }, { kind: "deleteColumn" })!.source)!.headers).toEqual(["Item"]);
    expect(editTable("| a |\n| --- |\n| 1 |", { row: 0, col: 0 }, { kind: "deleteColumn" })).toBeNull();
    expect(editTable(src, { row: -1, col: 0 }, { kind: "deleteRow" })).toBeNull();
  });
  it("sorts numbers as numbers and text alphabetically", () => {
    expect(rows(editTable(src, { row: 0, col: 1 }, { kind: "sort", descending: false })!.source)).toEqual(["Bus,45", "Food,300", "Rent,900"]);
    expect(rows(editTable(src, { row: 0, col: 0 }, { kind: "sort", descending: true })!.source)).toEqual(["Rent,900", "Food,300", "Bus,45"]);
  });
});

describe("offsetOfCell", () => {
  it("points at the start of a cell's text", () => {
    const out = serialiseTable(parseTable(src)!);
    expect(out.slice(offsetOfCell(out, 1, 1), offsetOfCell(out, 1, 1) + 3)).toBe("300");
    expect(out.slice(offsetOfCell(out, -1, 0), offsetOfCell(out, -1, 0) + 4)).toBe("Item");
  });
});
