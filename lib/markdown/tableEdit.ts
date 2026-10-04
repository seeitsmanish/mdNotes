import { type Alignment, parseTable, type ParsedTable } from "./table";

/**
 * Table tools (PRD §4.72): add, remove and sort rows and columns. Pure — a
 * table's source in, the new source out — and written back with padded,
 * aligned columns so the markdown stays readable as text.
 */

function escapeCell(cell: string): string {
  return cell.replace(/\|/g, "\\|");
}

function delimiter(align: Alignment, width: number): string {
  const dashes = "-".repeat(Math.max(3, width));
  if (align === "center") return `:${dashes.slice(2)}:`;
  if (align === "right") return `${dashes.slice(1)}:`;
  if (align === "left") return `:${dashes.slice(1)}`;
  return dashes;
}

export function serialiseTable(table: ParsedTable): string {
  const all = [table.headers, ...table.rows].map((row) => row.map(escapeCell));
  const widths = table.headers.map((_, col) => Math.max(3, ...all.map((row) => (row[col] ?? "").length)));
  const line = (cells: string[]) => `| ${cells.map((cell, col) => cell.padEnd(widths[col]!)).join(" | ")} |`;
  return [
    line(all[0]!),
    `| ${widths.map((width, col) => delimiter(table.align[col] ?? null, width)).join(" | ")} |`,
    ...all.slice(1).map(line),
  ].join("\n");
}

/** Which cell an offset in the table's source falls in: row -1 is the header, the delimiter row counts as the header. */
export function cellAt(source: string, offset: number): { row: number; col: number } {
  const before = source.slice(0, offset);
  const lineIndex = before.split("\n").length - 1;
  const lineText = before.slice(before.lastIndexOf("\n") + 1);
  // Count unescaped pipes before the caret on its line.
  let pipes = 0;
  for (let i = 0; i < lineText.length; i += 1) if (lineText[i] === "|" && lineText[i - 1] !== "\\") pipes += 1;
  const startsWithPipe = (source.split("\n")[lineIndex] ?? "").trimStart().startsWith("|");
  const col = Math.max(0, pipes - (startsWithPipe ? 1 : 0));
  return { row: lineIndex <= 1 ? -1 : lineIndex - 2, col };
}

export type TableOp =
  | { kind: "addRow" }
  | { kind: "addColumn" }
  | { kind: "deleteRow" }
  | { kind: "deleteColumn" }
  | { kind: "sort"; descending: boolean };

const NUMBER = /^[-+]?[\d,]*\.?\d+%?$/;

function compare(a: string, b: string): number {
  const na = a.replace(/[,%]/g, "");
  const nb = b.replace(/[,%]/g, "");
  if (NUMBER.test(a.trim()) && NUMBER.test(b.trim())) return Number(na) - Number(nb);
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/**
 * Applies an operation at a cell. Returns the new source and the cell the
 * caret should go to, or null when it does not apply (e.g. deleting the
 * only column, or a source that is not a table).
 */
export function editTable(
  source: string,
  at: { row: number; col: number },
  op: TableOp,
): { source: string; row: number; col: number } | null {
  const table = parseTable(source);
  if (!table) return null;
  const width = table.headers.length;
  const col = Math.min(at.col, width - 1);
  const t: ParsedTable = { headers: [...table.headers], align: [...table.align], rows: table.rows.map((r) => [...r]) };

  switch (op.kind) {
    case "addRow": {
      const index = at.row + 1; // below the current row; below the header for row -1
      t.rows.splice(index, 0, Array(width).fill(""));
      return { source: serialiseTable(t), row: index, col: 0 };
    }
    case "deleteRow": {
      if (at.row < 0 || t.rows.length === 0) return null;
      t.rows.splice(at.row, 1);
      return { source: serialiseTable(t), row: Math.min(at.row, t.rows.length - 1), col };
    }
    case "addColumn": {
      const index = col + 1;
      t.headers.splice(index, 0, "Column");
      t.align.splice(index, 0, null);
      for (const row of t.rows) row.splice(index, 0, "");
      return { source: serialiseTable(t), row: -1, col: index };
    }
    case "deleteColumn": {
      if (width <= 1) return null;
      t.headers.splice(col, 1);
      t.align.splice(col, 1);
      for (const row of t.rows) row.splice(col, 1);
      return { source: serialiseTable(t), row: at.row, col: Math.min(col, width - 2) };
    }
    case "sort": {
      t.rows.sort((a, b) => compare(a[col] ?? "", b[col] ?? "") * (op.descending ? -1 : 1));
      return { source: serialiseTable(t), row: -1, col };
    }
  }
}

/** The offset of a cell's text in serialised source, for placing the caret. */
export function offsetOfCell(source: string, row: number, col: number): number {
  const lines = source.split("\n");
  const lineIndex = row < 0 ? 0 : row + 2;
  let offset = lines.slice(0, lineIndex).reduce((sum, line) => sum + line.length + 1, 0);
  const line = lines[lineIndex] ?? "";
  let pipes = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "|" && line[i - 1] !== "\\") {
      if (pipes === col) return offset + i + 2;
      pipes += 1;
    }
  }
  return offset;
}
