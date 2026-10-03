/**
 * Parsing a GFM pipe table into something renderable.
 *
 * Pure and separately tested: cell splitting has more edge cases than it looks
 * (escaped pipes, ragged rows, missing outer pipes), and getting one wrong
 * silently shifts every column after it.
 */

export type Alignment = "left" | "center" | "right" | null;

export interface ParsedTable {
  headers: string[];
  align: Alignment[];
  rows: string[][];
}

const DELIMITER_CELL = /^:?-{1,}:?$/;

/**
 * Split one row on pipes, honouring `\|` escapes and dropping the optional
 * leading and trailing pipes GFM allows.
 */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of line.trim()) {
    if (escaped) {
      // Keep the pipe, drop the backslash that protected it.
      current += char === "|" ? "|" : `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (escaped) current += "\\";
  cells.push(current);

  // A leading or trailing pipe produces an empty cell at each end.
  if (cells.length > 0 && cells[0]!.trim() === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1]!.trim() === "") cells.pop();

  return cells.map((cell) => cell.trim());
}

function alignmentOf(cell: string): Alignment {
  const trimmed = cell.trim();
  if (!DELIMITER_CELL.test(trimmed)) return null;
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

/** True when a line is a GFM delimiter row such as `| --- | :--: |`. */
export function isDelimiterRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL.test(cell.trim()));
}

/**
 * Parse a table's source. Returns null when it is not a well-formed table, so
 * the caller can fall back to showing the raw markdown rather than a mangled
 * rendering.
 */
export function parseTable(source: string): ParsedTable | null {
  const lines = source.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return null;

  const headers = splitRow(lines[0]!);
  if (headers.length === 0) return null;
  if (!isDelimiterRow(lines[1]!)) return null;

  const align = splitRow(lines[1]!).map(alignmentOf);

  const rows = lines.slice(2).map((line) => {
    const cells = splitRow(line);
    // Ragged rows are normalised to the header width: GFM drops extra cells
    // and pads short ones, and a mismatch should not shift the whole table.
    if (cells.length > headers.length) return cells.slice(0, headers.length);
    while (cells.length < headers.length) cells.push("");
    return cells;
  });

  return { headers, align, rows };
}
