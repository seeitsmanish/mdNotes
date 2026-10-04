/**
 * What a drag picks up, and where it lands (PRD §4.70). Pure: lines in, lines out.
 *
 * A block is the unit a reader sees as one thing: a list item with
 * everything nested under it, a heading, a fenced code block, or a
 * paragraph (a run of plain non-blank lines). Blank lines are never picked up.
 */

const LIST = /^(\s*)(?:[-*+]|\d{1,9}[.)])\s/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}#{1,6}\s/;

function indentOf(line: string): number {
  return (/^\s*/.exec(line)?.[0] ?? "").replace(/\t/g, "    ").length;
}

/** Index ranges of fenced code blocks, so their insides are never split. */
function fences(lines: string[]): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  let open = -1;
  lines.forEach((line, index) => {
    if (!FENCE.test(line)) return;
    if (open === -1) open = index;
    else {
      found.push([open, index]);
      open = -1;
    }
  });
  return found;
}

/** The block containing line `index`, as [first, last] inclusive, or null on a blank line. */
export function blockAt(lines: string[], index: number): [number, number] | null {
  const line = lines[index];
  if (line === undefined || !line.trim()) return null;

  const fence = fences(lines).find(([a, b]) => index >= a && index <= b);
  if (fence) return fence;

  if (HEADING.test(line)) return [index, index];

  const list = LIST.exec(line);
  if (list) {
    const base = indentOf(line);
    let end = index;
    while (end + 1 < lines.length) {
      const next = lines[end + 1]!;
      if (!next.trim()) break;
      // Nested items and wrapped continuation lines travel with their item.
      if (indentOf(next) > base) end += 1;
      else break;
    }
    return [index, end];
  }

  // A continuation line inside a list item belongs to that item.
  for (let up = index - 1; up >= 0; up -= 1) {
    const prev = lines[up]!;
    if (!prev.trim()) break;
    if (LIST.test(prev) && indentOf(prev) < indentOf(line)) return blockAt(lines, up);
    if (LIST.test(prev) || HEADING.test(prev)) break;
  }

  // A paragraph: neighbouring plain lines.
  const plain = (text: string | undefined) =>
    text !== undefined && text.trim() !== "" && !LIST.test(text) && !HEADING.test(text) && !FENCE.test(text);
  let start = index;
  let end = index;
  while (plain(lines[start - 1])) start -= 1;
  while (plain(lines[end + 1])) end += 1;
  return [start, end];
}

/**
 * Moves lines [from, to] so they start at what is now line `target` (0 to
 * lines.length). Returns the new lines and where the block ended up, or null
 * when the drop would leave everything where it was.
 */
export function moveBlock(
  lines: string[],
  [from, to]: [number, number],
  target: number,
): { lines: string[]; start: number } | null {
  if (target >= from && target <= to + 1) return null;
  const block = lines.slice(from, to + 1);
  const rest = [...lines.slice(0, from), ...lines.slice(to + 1)];
  const at = target > to ? target - block.length : target;
  return { lines: [...rest.slice(0, at), ...block, ...rest.slice(at)], start: at };
}
