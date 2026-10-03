/**
 * The questions in a note, for drill mode (PRD §4.23).
 *
 * Nothing has to be marked up: the library is question banks written as
 * ordinary markdown, so questions are recognised where they already are —
 *
 * - list items phrased as questions ("How will you…", "What is…", "…?");
 *   a list where at least half the items read as questions is a question
 *   bank, and every item in it counts, since "Situational question — where
 *   would you…" is a question too;
 * - headings that end in `?`, with the text under them as notes;
 * - plain lines that end in `?`, with the lines straight after as notes;
 * - `Question :: answer` lines.
 *
 * Whatever sits under a question — nested list items, a paragraph — is shown
 * when you reveal it, so notes you have written become the answer key.
 */

export interface Question {
  /** Stable across edits elsewhere in the note: a hash of the prompt. */
  id: string;
  prompt: string;
  /** Notes under the question, revealed on demand. Empty if there are none. */
  detail: string;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const QA = /^(.+?\S)\s+::\s+(\S.*)$/;
const QUESTION_START =
  /^(how|what|why|when|where|which|who|whom|whose|is|are|was|were|do|does|did|can|could|would|should|will|shall|have|has|explain|describe|define|compare|contrast|tell me|walk me|give|list|name|difference|differentiate)\b/i;

function indentOf(line: string): number {
  return (/^\s*/.exec(line)?.[0] ?? "").replace(/\t/g, "    ").length;
}

/** Markup stripped for display; the prompt is read, not edited. */
export function plainText(text: string): string {
  return text
    .replace(/\|\|([^|\n]+)\|\|/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/::([^:]+)::/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeQuestion(text: string): boolean {
  const plain = plainText(text);
  return plain.endsWith("?") || QUESTION_START.test(plain);
}

/** FNV-1a, so the id survives the question moving within the note. */
export function questionId(prompt: string): string {
  let hash = 0x811c9dc5;
  for (const ch of plainText(prompt).toLowerCase()) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

interface Item {
  line: number;
  indent: number;
  text: string;
}

export function extractQuestions(body: string): Question[] {
  const lines = body.split("\n");
  const inCode: boolean[] = [];
  let fenced = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      inCode.push(true);
      fenced = !fenced;
      continue;
    }
    inCode.push(fenced);
  }

  const found: Array<{ line: number; prompt: string; detail: string }> = [];

  // Lines belonging to an item: everything below it that is indented further
  // (blank lines included) until the next line at its own depth or shallower.
  const childrenOf = (index: number, indent: number): string[] => {
    const out: string[] = [];
    for (let i = index + 1; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (line.trim() === "") {
        out.push("");
        continue;
      }
      if (indentOf(line) <= indent) break;
      out.push(line);
    }
    return out;
  };

  // --- lists, grouped so a question bank counts as a whole ---------------
  const groups: Item[][] = [];
  let current: Item[] = [];
  let groupIndent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (inCode[i]) continue;
    const line = lines[i] ?? "";
    const match = LIST_ITEM.exec(line);
    if (match) {
      const indent = (match[1] ?? "").replace(/\t/g, "    ").length;
      if (current.length > 0 && indent > groupIndent) continue; // a child, not a sibling
      if (indent !== groupIndent && current.length > 0) {
        groups.push(current);
        current = [];
      }
      groupIndent = indent;
      current.push({ line: i, indent, text: match[3] ?? "" });
      continue;
    }
    if (line.trim() === "") continue; // a blank line does not end a list
    if (current.length > 0 && indentOf(line) > groupIndent) continue; // continuation
    if (current.length > 0) {
      groups.push(current);
      current = [];
      groupIndent = -1;
    }
  }
  if (current.length > 0) groups.push(current);

  const claimed = new Set<number>();
  for (const group of groups) {
    const questions = group.filter((item) => looksLikeQuestion(item.text)).length;
    const isBank = group.length >= 2 && questions * 2 >= group.length;
    for (const item of group) {
      if (!isBank && !looksLikeQuestion(item.text)) continue;
      const prompt = plainText(item.text);
      if (prompt.length === 0) continue;
      const children = childrenOf(item.line, item.indent);
      children.forEach((_, offset) => claimed.add(item.line + 1 + offset));
      claimed.add(item.line);
      found.push({ line: item.line, prompt, detail: dedent(children) });
    }
  }

  // --- headings, plain lines and Q :: A ----------------------------------
  for (let i = 0; i < lines.length; i += 1) {
    if (inCode[i] || claimed.has(i)) continue;
    const line = lines[i] ?? "";
    if (LIST_ITEM.test(line)) continue;

    const qa = QA.exec(line);
    // ` :: ` needs spaces on both sides, which `::highlight::` never has.
    if (qa) {
      found.push({ line: i, prompt: plainText(qa[1] ?? ""), detail: (qa[2] ?? "").trim() });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const text = plainText(heading[2] ?? "");
      if (!text.endsWith("?")) continue;
      const level = (heading[1] ?? "").length;
      const under: string[] = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = HEADING.exec(lines[j] ?? "");
        if (next && !inCode[j] && (next[1] ?? "").length <= level) break;
        under.push(lines[j] ?? "");
      }
      found.push({ line: i, prompt: text, detail: dedent(under) });
      continue;
    }

    const plain = plainText(line);
    if (plain.endsWith("?") && plain.length > 1) {
      const after: string[] = [];
      for (let j = i + 1; j < lines.length && (lines[j] ?? "").trim() !== ""; j += 1) {
        if (HEADING.test(lines[j] ?? "") || LIST_ITEM.test(lines[j] ?? "")) break;
        after.push(lines[j] ?? "");
      }
      found.push({ line: i, prompt: plain, detail: dedent(after) });
    }
  }

  found.sort((a, b) => a.line - b.line);
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const q of found) {
    const id = questionId(q.prompt);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, prompt: q.prompt, detail: q.detail });
  }
  return out;
}

/** Strip the common indent and surrounding blank lines from an answer. */
function dedent(lines: string[]): string {
  const body = [...lines];
  while (body.length > 0 && (body[0] ?? "").trim() === "") body.shift();
  while (body.length > 0 && (body[body.length - 1] ?? "").trim() === "") body.pop();
  const indents = body.filter((l) => l.trim() !== "").map(indentOf);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  return body.map((l) => l.replace(/\t/g, "    ").slice(common)).join("\n");
}
